use crate::*;
use anchor_lang::solana_program::system_program;
use anchor_lang::solana_program::sysvar::instructions::get_instruction_relative;
use anchor_spl::token::{self, Token, TokenAccount};
use num_traits::ToPrimitive;

#[derive(Accounts)]
pub struct Lock<'info> {
    /// [Locker].
    #[account(mut)]
    pub locker: Box<Account<'info, Locker>>,
    /// [Escrow].
    #[account(mut)]
    pub escrow: Box<Account<'info, Escrow>>,
    /// Token account held by the [Locker].
    #[account(mut)]
    pub locked_tokens: Box<Account<'info, TokenAccount>>,
    /// Authority of the [Escrow].
    pub escrow_owner: Signer<'info>,
    /// The source of tokens.
    #[account(mut)]
    pub source_tokens: Box<Account<'info, TokenAccount>>,
    /// The authority of source_tokens.
    pub source_tokens_authority: Signer<'info>,

    /// Token program.
    pub token_program: Program<'info, Token>,
}

impl<'info> Lock<'info> {
    pub fn process(&mut self, amount: u64, duration: i64) -> Result<()> {
        invariant!(
            unwrap_int!(duration.to_u64()) >= self.locker.params.min_stake_duration,
            ProtocolError::LockupDurationTooShort
        );
        invariant!(
            unwrap_int!(duration.to_u64()) <= self.locker.params.max_stake_duration,
            ProtocolError::LockupDurationTooLong
        );

        let escrow = &self.escrow;
        let prev_escrow_ends_at = escrow.escrow_ends_at;
        let next_escrow_started_at = Clock::get()?.unix_timestamp;
        let next_escrow_ends_at = unwrap_int!(next_escrow_started_at.checked_add(duration));
        if prev_escrow_ends_at > next_escrow_ends_at {
            return Err(ProtocolError::RefreshCannotShorten.into());
        }

        if amount > 0 {
            token::transfer(
                CpiContext::new(
                    self.token_program.to_account_info(),
                    token::Transfer {
                        from: self.source_tokens.to_account_info(),
                        to: self.locked_tokens.to_account_info(),
                        authority: self.source_tokens_authority.to_account_info(),
                    },
                ),
                amount,
            )?;
        }

        let locker = &mut self.locker;
        let escrow = &mut self.escrow;

        escrow.update_lock_event(
            locker,
            amount,
            next_escrow_started_at,
            next_escrow_ends_at,
            false,
        )?;

        emit!(LockEvent {
            locker: locker.key(),
            locker_supply: locker.locked_supply,
            escrow_owner: escrow.owner,
            token_mint: locker.token_mint,
            amount,
            duration,
            prev_escrow_ends_at,
            next_escrow_ends_at,
            next_escrow_started_at
        });

        Ok(())
    }

    pub fn check_whitelisted(&self, remaining_accounts: &[AccountInfo]) -> Result<()> {
        invariant!(
            remaining_accounts.len() == 2,
            ProtocolError::MustProvideWhitelist
        );

        let accounts_iter = &mut remaining_accounts.iter();
        let ix_sysvar_account_info = next_account_info(accounts_iter)?;
        let program_id = get_instruction_relative(0, ix_sysvar_account_info)?.program_id;
        if program_id == crate::ID {
            return Ok(());
        }

        let whitelist_entry_account_info = next_account_info(accounts_iter)?;
        invariant!(
            !whitelist_entry_account_info.data_is_empty(),
            ProtocolError::ProgramNotWhitelisted
        );
        let whitelist_entry = Account::<WhitelistEntry>::try_from(whitelist_entry_account_info)?;
        assert_keys_eq!(whitelist_entry.locker, self.locker);
        assert_keys_eq!(whitelist_entry.program_id, program_id);
        if whitelist_entry.owner != system_program::ID {
            assert_keys_eq!(
                whitelist_entry.owner,
                self.escrow_owner,
                ProtocolError::EscrowOwnerNotWhitelisted
            );
        }

        Ok(())
    }
}

impl<'info> Validate<'info> for Lock<'info> {
    fn validate(&self) -> Result<()> {
        assert_keys_eq!(
            self.locker,
            self.escrow.locker,
            ProtocolError::InvalidLocker
        );
        assert_keys_eq!(
            self.escrow.tokens,
            self.locked_tokens,
            ProtocolError::InvalidToken
        );
        assert_keys_neq!(
            self.source_tokens,
            self.locked_tokens,
            ProtocolError::InvalidToken
        );
        assert_keys_eq!(
            self.escrow.owner,
            self.escrow_owner,
            ProtocolError::InvalidAccountOwner
        );
        assert_keys_eq!(
            self.source_tokens.owner,
            self.source_tokens_authority,
            ProtocolError::InvalidTokenOwner
        );
        assert_keys_eq!(
            self.source_tokens.mint,
            self.locker.token_mint,
            ProtocolError::InvalidLockerMint
        );

        Ok(())
    }
}

#[event]
/// Event called in [ve_honey::lock].
pub struct LockEvent {
    /// [Locker] of the [Escrow].
    #[index]
    pub locker: Pubkey,
    /// The owner of the [Escrow].
    pub escrow_owner: Pubkey,
    /// Mint of the token that for the [Locker].
    pub token_mint: Pubkey,
    /// Amount of tokens locked.
    pub amount: u64,
    /// Amount of tokens locked inside the [Locker].
    pub locker_supply: u64,
    /// Duration of lock time.
    pub duration: i64,
    /// The previous timestamp that the [Escrow] ended at.
    pub prev_escrow_ends_at: i64,
    /// The new [Escrow] end time.
    pub next_escrow_ends_at: i64,
    /// The new [Escrow] start time.
    pub next_escrow_started_at: i64,
}
