use crate::constants::*;
use crate::error::*;
use crate::escrow_seeds;
use crate::state::*;
use anchor_lang::prelude::*;
use anchor_lang::AccountsClose;
use anchor_spl::token::{self, Token, TokenAccount};
use vipers::*;

// Close [Escrow] along with [NftReceipt] accounts.
#[derive(Accounts)]
pub struct CloseEscrow<'info> {
    /// the [Locker].
    pub locker: Box<Account<'info, Locker>>,
    /// the [Escrow] that is being closed
    #[account(mut)]
    pub escrow: Box<Account<'info, Escrow>>,
    /// authority of the [Escrow].
    pub escrow_owner: Signer<'info>,
    /// tokens locked up in the [Locker].
    #[account(mut)]
    pub locked_tokens: Box<Account<'info, TokenAccount>>,
    /// destination for the tokens to unlock
    pub destination_tokens: Box<Account<'info, TokenAccount>>,
    /// funds receiver
    /// CHECK:
    #[account(mut)]
    pub funds_receiver: UncheckedAccount<'info>,

    /// token program
    pub token_program: Program<'info, Token>,
}

impl<'info> CloseEscrow<'info> {
    pub fn process(&mut self, ra: &[AccountInfo<'info>]) -> Result<()> {
        self.close_receipts(ra)?;

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

        let locker = &mut self.locker;
        locker.locked_supply = unwrap_int!(locker.locked_supply.checked_sub(self.escrow.amount));
        self.escrow.close(self.funds_receiver.to_account_info())?;

        Ok(())
    }

    fn close_receipts(&self, ra: &[AccountInfo<'info>]) -> Result<()> {
        let receipt_count = self.escrow.receipt_count;

        invariant!(
            receipt_count as usize == ra.len(),
            ProtocolError::InvalidRemainingAccounts
        );

        let accounts_iter = &mut ra.iter();
        let mut receipt_ids: Vec<u64> = vec![];
        for _ in 0..receipt_count {
            let receipt_info = next_account_info(accounts_iter)?;
            invariant!(receipt_info.is_writable, ProtocolError::InvariantViolated);
            let receipt = Account::<NftReceipt>::try_from(receipt_info)?;
            assert_keys_eq!(
                receipt.owner,
                self.escrow_owner,
                ProtocolError::InvalidAccountOwner
            );
            assert_keys_eq!(receipt.locker, self.locker, ProtocolError::InvalidLocker);
            invariant!(
                !receipt_ids.contains(&receipt.receipt_id),
                ProtocolError::InvalidRemainingAccounts
            );
            receipt_ids.push(receipt.receipt_id);

            let remaining_amount =
                receipt.get_claim_amount_at(&self.locker.params, receipt.vest_ends_at)?;

            invariant!(remaining_amount == 0, ProtocolError::InvariantViolated);
            receipt.close(self.funds_receiver.to_account_info())?;
        }

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

        Ok(())
    }
}
