use crate::*;
use anchor_spl::token::{self, Token, TokenAccount};

/// Claim with [NftReceipt] account that locked NFT.
#[derive(Accounts)]
pub struct Claim<'info> {
    /// [Locker].
    #[account(mut)]
    pub locker: Box<Account<'info, Locker>>,
    /// [Escrow] that is being claimed
    #[account(mut)]
    pub escrow: Box<Account<'info, Escrow>>,
    /// authority of [Escrow].
    pub escrow_owner: Signer<'info>,
    /// tokens locked up in the [Locker].
    #[account(mut)]
    pub locked_tokens: Box<Account<'info, TokenAccount>>,
    /// destination for the tokens claimed
    #[account(mut)]
    pub destination_tokens: Box<Account<'info, TokenAccount>>,
    /// NFT receipt
    #[account(mut)]
    pub nft_receipt: Box<Account<'info, NftReceipt>>,

    /// token program
    pub token_program: Program<'info, Token>,
}

impl<'info> Claim<'info> {
    pub fn process(&mut self) -> Result<()> {
        let claim_amount = unwrap_int!(self
            .nft_receipt
            .calculate_reward_amount_at_time(&self.locker.params, Clock::get()?.unix_timestamp));

        invariant!(claim_amount > 0, ProtocolError::ClaimError);

        let seeds: &[&[&[u8]]] = escrow_seeds!(self.escrow);

        token::transfer(
            CpiContext::new(
                self.token_program.to_account_info(),
                token::Transfer {
                    from: self.locked_tokens.to_account_info(),
                    to: self.destination_tokens.to_account_info(),
                    authority: self.escrow.to_account_info(),
                },
            )
            .with_signer(seeds),
            claim_amount,
        )?;

        let locker = &mut self.locker;
        let escrow = &mut self.escrow;
        let nft_receipt = &mut self.nft_receipt;

        nft_receipt.update_receipt(locker, escrow, claim_amount)?;

        if escrow.amount == 0 {
            escrow.escrow_started_at = 0;
            escrow.escrow_ends_at = 0;
        }

        Ok(())
    }
}

impl<'info> Validate<'info> for Claim<'info> {
    fn validate(&self) -> Result<()> {
        assert_keys_eq!(
            self.locker,
            self.escrow.locker,
            ProtocolError::InvalidLocker
        );
        assert_keys_eq!(
            self.locker,
            self.nft_receipt.locker,
            ProtocolError::InvalidLocker
        );
        assert_keys_eq!(
            self.escrow.owner,
            self.escrow_owner,
            ProtocolError::InvalidAccountOwner
        );
        assert_keys_eq!(
            self.nft_receipt.owner,
            self.escrow_owner,
            ProtocolError::InvalidAccountOwner
        );
        assert_keys_eq!(
            self.escrow.tokens,
            self.locked_tokens,
            ProtocolError::InvalidToken
        );
        assert_keys_neq!(
            self.locked_tokens,
            self.destination_tokens,
            ProtocolError::InvalidToken
        );
        invariant!(
            self.escrow.receipt_count > self.nft_receipt.receipt_id,
            ProtocolError::InvariantViolated
        );

        Ok(())
    }
}
