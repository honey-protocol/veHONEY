use crate::*;
use anchor_lang::solana_program::program::invoke;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use mpl_token_metadata::state::{Metadata, TokenMetadataAccount};
use num_traits::ToPrimitive;

#[derive(Accounts)]
#[instruction(receipt_id: u64)]
pub struct LockNft<'info> {
    /// payer of the initialization of [NftVault].
    #[account(mut)]
    pub payer: Signer<'info>,
    /// [Locker].
    #[account(mut)]
    pub locker: Box<Account<'info, Locker>>,
    /// [Escrow].
    #[account(mut)]
    pub escrow: Box<Account<'info, Escrow>>,
    /// [NftReceipt].
    #[account(
        init,
        seeds = [
            NFT_RECEIPT_SEED.as_bytes(),
            escrow.key().as_ref(),
            receipt_id.to_le_bytes().as_ref(),
        ],
        bump,
        payer = payer,
        space = 8 + NftReceipt::LEN,
    )]
    pub receipt: Box<Account<'info, NftReceipt>>,
    /// Authority of the [Escrow].
    pub escrow_owner: Signer<'info>,
    /// locked tokens.
    #[account(mut)]
    pub locked_tokens: Box<Account<'info, TokenAccount>>,
    /// locker treasury.
    #[account(mut)]
    pub locker_treasury: Box<Account<'info, TokenAccount>>,
    /// nft source token account.
    #[account(mut)]
    pub nft_source: Box<Account<'info, TokenAccount>>,
    /// authority of the nft.
    pub nft_source_authority: Signer<'info>,

    /// system program
    pub system_program: Program<'info, System>,
    /// token program
    pub token_program: Program<'info, Token>,
}

impl<'info> LockNft<'info> {
    pub fn process(&mut self, receipt_id: u64, duration: i64) -> Result<()> {
        if duration < self.locker.params.calculate_nft_max_stake_duration()? {
            return Err(error!(ProtocolError::VestingDurationExceeded));
        }

        let receipt = &mut self.receipt;

        receipt.receipt_id = receipt_id;
        receipt.locker = self.locker.key();
        receipt.owner = self.escrow_owner.key();
        receipt.vest_started_at = Clock::get()?.unix_timestamp;
        receipt.vest_ends_at = unwrap_int!(receipt.vest_started_at.checked_add(duration));
        receipt.claimed_amount = 0;

        let prev_escrow_ends_at = self.escrow.escrow_ends_at;
        let next_escrow_started_at = receipt.vest_started_at;
        let next_escrow_ends_at = unwrap_int!(receipt
            .vest_started_at
            .checked_add(unwrap_int!(self.locker.params.max_stake_duration.to_i64())));

        if prev_escrow_ends_at > next_escrow_ends_at {
            return Err(error!(ProtocolError::RefreshCannotShorten));
        }

        let seeds = &[
            LOCKER_SEED.as_bytes(),
            &self.locker.base.to_bytes()[..32],
            &[self.locker.bump],
        ];

        let max_reward_amount = self.locker.params.calculate_max_reward_amount()?;

        token::transfer(self.to_transfer_context(&[&seeds[..]]), max_reward_amount)?;

        let locker = &mut self.locker;
        let escrow = &mut self.escrow;

        escrow.update_lock_event(
            locker,
            max_reward_amount,
            next_escrow_started_at,
            next_escrow_ends_at,
            true,
        )?;

        Ok(())
    }

    fn to_transfer_context<'a, 'b, 'c>(
        &self,
        signer: &'a [&'b [&'c [u8]]],
    ) -> CpiContext<'a, 'b, 'c, 'info, Transfer<'info>> {
        CpiContext::new(
            self.token_program.to_account_info(),
            Transfer {
                from: self.locker_treasury.to_account_info(),
                to: self.locked_tokens.to_account_info(),
                authority: self.locker.to_account_info(),
            },
        )
        .with_signer(signer)
    }
}

fn assert_valid_metadata(
    metadata: &AccountInfo,
    metadata_program: &Pubkey,
    mint: &Pubkey,
) -> Result<Metadata> {
    assert_eq!(metadata.owner, metadata_program);

    let seed = &[
        b"metadata".as_ref(),
        &metadata_program.to_bytes()[..32],
        mint.as_ref(),
    ];

    let (metadata_addr, _bump) = Pubkey::find_program_address(seed, metadata_program);
    assert_eq!(metadata.key(), metadata_addr);

    Metadata::from_account_info(metadata).map_err(Into::into)
}

fn assert_valid_proof(
    proof_info: &AccountInfo,
    locker: &Pubkey,
    proof_address: &Pubkey,
    program_id: &Pubkey,
    expected_proof_type: ProofType,
) -> Result<()> {
    let seed = &[
        PROOF_SEED.as_bytes(),
        locker.as_ref(),
        proof_address.as_ref(),
    ];

    let (proof_addr, _bump) = Pubkey::find_program_address(seed, program_id);

    if proof_addr != proof_info.key() {
        return Err(error!(ProtocolError::InvalidProof));
    }

    let proof = Account::<Proof>::try_from(proof_info)?;

    proof.contains_type(expected_proof_type)
}

fn check_accounts(ctx: &Context<LockNft>) -> Result<()> {
    if ctx.remaining_accounts.len() < 5 {
        return Err(error!(ProtocolError::InvalidRemainingAccounts));
    }

    let accounts_iter = &mut ctx.remaining_accounts.iter();
    let proof_info = next_account_info(accounts_iter)?;
    let metaplex_metadata_program = next_account_info(accounts_iter)?;
    let nft_metadata = next_account_info(accounts_iter)?;
    let nft_mint = next_account_info(accounts_iter)?;

    if let Ok(()) = assert_valid_proof(
        proof_info,
        &ctx.accounts.locker.key(),
        &nft_mint.key(),
        ctx.program_id,
        ProofType::MINT,
    ) {
        return Ok(());
    }

    let metadata =
        assert_valid_metadata(nft_metadata, metaplex_metadata_program.key, nft_mint.key)?;

    for creator in metadata.data.creators.unwrap() {
        if !creator.verified {
            continue;
        }

        if let Ok(()) = assert_valid_proof(
            proof_info,
            &ctx.accounts.locker.key(),
            &creator.address,
            ctx.program_id,
            ProofType::CREATOR,
        ) {
            return Ok(());
        }
    }

    Err(error!(ProtocolError::InvalidProof))
}

fn burn_nft<'info>(ctx: &Context<'_, '_, '_, 'info, LockNft<'info>>) -> Result<()> {
    let accounts_iter = &mut ctx.remaining_accounts.iter();
    let _proof_info = next_account_info(accounts_iter)?;
    let metaplex_metadata_program = next_account_info(accounts_iter)?;
    let nft_metadata = next_account_info(accounts_iter)?;
    let nft_mint = next_account_info(accounts_iter)?;
    let nft_edition = next_account_info(accounts_iter)?;

    let mut account_infos: Vec<AccountInfo> = vec![
        metaplex_metadata_program.to_account_info(),
        nft_metadata.to_account_info(),
        ctx.accounts.nft_source_authority.to_account_info(),
        nft_mint.to_account_info(),
        ctx.accounts.nft_source.to_account_info(),
        nft_edition.to_account_info(),
        ctx.accounts.token_program.to_account_info(),
    ];

    let nft_collection_metadata = if ctx.remaining_accounts.len() == 6 {
        let nft_collection_metadata_info = next_account_info(accounts_iter)?;
        account_infos.append(&mut vec![nft_collection_metadata_info.to_account_info()]);
        Some(nft_collection_metadata_info.key())
    } else {
        None
    };

    invoke(
        &mpl_token_metadata::instruction::burn_nft(
            metaplex_metadata_program.key(),
            nft_metadata.key(),
            ctx.accounts.nft_source_authority.key(),
            nft_mint.key(),
            ctx.accounts.nft_source.key(),
            nft_edition.key(),
            ctx.accounts.token_program.key(),
            nft_collection_metadata,
        ),
        account_infos.as_slice(),
    )?;

    Ok(())
}

pub fn handler<'info>(
    ctx: Context<'_, '_, '_, 'info, LockNft<'info>>,
    receipt_id: u64,
    duration: i64,
) -> Result<()> {
    check_accounts(&ctx)?;

    ctx.accounts.process(receipt_id, duration)?;

    burn_nft(&ctx)?;

    Ok(())
}

impl<'info> Validate<'info> for LockNft<'info> {
    fn validate(&self) -> Result<()> {
        assert_keys_eq!(
            self.escrow.locker,
            self.locker,
            ProtocolError::InvalidLocker
        );
        assert_keys_eq!(
            self.escrow.tokens,
            self.locked_tokens,
            ProtocolError::InvalidToken
        );
        assert_keys_eq!(
            self.escrow.owner,
            self.escrow_owner,
            ProtocolError::InvalidAccountOwner
        );
        assert_keys_eq!(
            self.locker_treasury.owner,
            self.locker,
            ProtocolError::InvalidTokenOwner
        );
        assert_keys_eq!(
            self.locker_treasury.mint,
            self.locker.token_mint,
            ProtocolError::InvalidLockerMint
        );

        Ok(())
    }
}
