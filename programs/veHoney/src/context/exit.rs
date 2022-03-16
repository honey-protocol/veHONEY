use crate::constants::*;
use crate::error::*;
use crate::escrow_seeds;
use crate::state::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount};
use vipers::*;

#[derive(Accounts)]
pub struct Exit<'info> {
    /// Payer.
    #[account(mut)]
    pub payer: Signer<'info>,
    /// [Locker].
    #[account(mut)]
    pub locker: Box<Account<'info, Locker>>,
    /// [Escrow] that is being closed.
    #[account(mut, close = payer)]
    pub escrow: Box<Account<'info, Escrow>>,
    /// Authority of the [Escrow].
    pub escrow_owner: Signer<'info>,
    /// Tokens locked up in the [Escrow].
    #[account(mut)]
    pub escrow_tokens: Box<Account<'info, TokenAccount>>,
    /// Destination for the tokens to unlock.
    #[account(mut)]
    pub destination_tokens: Box<Account<'info, TokenAccount>>,

    /// Token program.
    pub token_program: Program<'info, Token>,
}

impl<'info> Exit<'info> {
    pub fn process(&mut self) -> Result<()> {
        let seeds: &[&[&[u8]]] = escrow_seeds!(self.escrow);

        if self.escrow.amount > 0 {
            token::transfer(
                CpiContext::new(
                    self.token_program.to_account_info(),
                    token::Transfer {
                        from: self.escrow_tokens.to_account_info(),
                        to: self.destination_tokens.to_account_info(),
                        authority: self.escrow.to_account_info(),
                    },
                )
                .with_signer(seeds),
                self.escrow.amount,
            )?;
        }

        let locker = &mut self.locker;
        locker.locked_supply = unwrap_int!(locker.locked_supply.checked_sub(self.escrow.amount));

        emit!(ExitEscrowEvent {
            escrow_owner: self.escrow.owner,
            locker: locker.key(),
            locker_supply: locker.locked_supply,
            timestamp: Clock::get()?.unix_timestamp,
            released_amount: self.escrow.amount
        });

        Ok(())
    }
}

impl<'info> Validate<'info> for Exit<'info> {
    fn validate(&self) -> Result<()> {
        assert_keys_eq!(self.locker, self.escrow.locker);
        assert_keys_eq!(self.escrow.owner, self.escrow_owner);
        assert_keys_eq!(self.escrow.tokens, self.escrow_tokens);
        let now = Clock::get()?.unix_timestamp;
        msg!(
            "now: {}; escrow_ends_at: {}",
            now,
            self.escrow.escrow_ends_at
        );
        invariant!(
            self.escrow.escrow_ends_at < now,
            ProtocolError::EscrowNotEnded
        );

        Ok(())
    }
}

#[event]
/// Event called in [ve_honey::exit].
pub struct ExitEscrowEvent {
    /// The owner of the [Escrow].
    #[index]
    pub escrow_owner: Pubkey,
    /// [Locker] of the [Escrow].
    #[index]
    pub locker: Pubkey,
    /// Timestamp
    pub timestamp: i64,
    /// The amount of tokens locked inside the [Locker].
    pub locker_supply: u64,
    /// The amount released from the [Escrow].
    pub released_amount: u64,
}
