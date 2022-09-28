use crate::*;
use anchor_spl::token::{self, Token, TokenAccount};
// Close [Escrow] along with [NftReceipt] accounts.
#[derive(Accounts)]
pub struct CloseEscrow<'info> {
    /// the [Locker].
    #[account(mut)]
    pub locker: Box<Account<'info, Locker>>,
    /// the [Escrow] that is being closed
    #[account(mut, close = funds_receiver)]
    pub escrow: Box<Account<'info, Escrow>>,
    /// authority of the [Escrow].
    pub escrow_owner: Signer<'info>,
    /// tokens locked up in the [Locker].
    #[account(mut)]
    pub locked_tokens: Box<Account<'info, TokenAccount>>,
    /// destination for the tokens to unlock
    #[account(mut)]
    pub destination_tokens: Box<Account<'info, TokenAccount>>,
    /// funds receiver
    /// CHECK:
    #[account(mut)]
    pub funds_receiver: UncheckedAccount<'info>,

    /// token program
    pub token_program: Program<'info, Token>,
}

impl<'info> CloseEscrow<'info> {
    pub fn process(&mut self) -> Result<()> {
        let seeds: &[&[&[u8]]] = escrow_seeds!(self.escrow);

        if self.escrow.amount > 0 {
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
                self.escrow.amount,
            )?;
        }

        token::close_account(
            CpiContext::new(
                self.token_program.to_account_info(),
                token::CloseAccount {
                    account: self.locked_tokens.to_account_info(),
                    destination: self.funds_receiver.to_account_info(),
                    authority: self.escrow.to_account_info(),
                },
            )
            .with_signer(seeds),
        )?;

        self.locker.locked_supply =
            unwrap_int!(self.locker.locked_supply.checked_sub(self.escrow.amount));

        Ok(())
    }
}

impl<'info> Validate<'info> for CloseEscrow<'info> {
    fn validate(&self) -> Result<()> {
        assert_keys_eq!(
            self.locker,
            self.escrow.locker,
            ProtocolError::InvalidLocker
        );
        assert_keys_eq!(
            self.escrow.owner,
            self.escrow_owner,
            ProtocolError::InvalidAccountOwner
        );
        assert_keys_eq!(self.escrow.tokens, self.locked_tokens);
        assert_keys_neq!(self.locked_tokens, self.destination_tokens);
        assert_keys_eq!(self.locked_tokens.mint, self.destination_tokens.mint);
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
        invariant!(self.escrow.receipt_count == 0);

        Ok(())
    }
}
