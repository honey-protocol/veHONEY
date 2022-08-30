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
    /// [Escrow] that is being exited.
    #[account(mut, has_one = locker)]
    pub escrow: Box<Account<'info, Escrow>>,
    /// Authority of the [Escrow].
    pub escrow_owner: Signer<'info>,
    /// Tokens locked up in the [Locker].
    #[account(mut)]
    pub locked_tokens: Box<Account<'info, TokenAccount>>,
    /// Destination for the tokens to unlock.
    #[account(mut)]
    pub destination_tokens: Box<Account<'info, TokenAccount>>,

    /// Token program.
    pub token_program: Program<'info, Token>,
}

impl<'info> Exit<'info> {
    pub fn process(&mut self, ra: &[AccountInfo]) -> Result<()> {
        let unlock_amount = self.check_receipts(ra)?;

        let seeds: &[&[&[u8]]] = escrow_seeds!(self.escrow);

        if unlock_amount > 0 {
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
                unlock_amount,
            )?;
        }

        let escrow = &mut self.escrow;
        let locker = &mut self.locker;
        escrow.amount = unwrap_int!(escrow.amount.checked_sub(unlock_amount));
        locker.locked_supply = unwrap_int!(locker.locked_supply.checked_sub(self.escrow.amount));

        emit!(ExitEscrowEvent {
            escrow_owner: self.escrow.owner,
            locker: locker.key(),
            locked_supply: locker.locked_supply,
            timestamp: Clock::get()?.unix_timestamp,
            released_amount: self.escrow.amount
        });

        Ok(())
    }

    // check receipts and return the amount to unlock.
    fn check_receipts(&self, ra: &[AccountInfo]) -> Result<u64> {
        let receipt_count = self.escrow.receipt_count;

        invariant!(
            receipt_count as usize == ra.len(),
            ProtocolError::InvalidRemainingAccountsLength
        );

        let mut remaining_rewards_amount: u64 = 0;
        let accounts_iter = &mut ra.iter();
        for _ in 0..receipt_count {
            let receipt_info = next_account_info(accounts_iter)?;
            let receipt = Account::<NftReceipt>::try_from(receipt_info)?;
            assert_keys_eq!(
                receipt.owner,
                self.escrow_owner,
                ProtocolError::InvalidAccountOwner
            );
            assert_keys_eq!(receipt.locker, self.locker, ProtocolError::InvalidLocker);
            let remaining_amount = receipt.remaining_amount()?;
            remaining_rewards_amount =
                unwrap_int!(remaining_rewards_amount.checked_add(remaining_amount));
        }

        Ok(unwrap_int!(self
            .escrow
            .amount
            .checked_sub(remaining_rewards_amount)))
    }
}

impl<'info> Validate<'info> for Exit<'info> {
    fn validate(&self) -> Result<()> {
        assert_keys_eq!(self.locker, self.escrow.locker);
        assert_keys_eq!(self.escrow.owner, self.escrow_owner);
        assert_keys_eq!(self.escrow.tokens, self.locked_tokens);
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

        assert_keys_neq!(self.locked_tokens, self.destination_tokens);

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
    pub locked_supply: u64,
    /// The amount released from the [Escrow].
    pub released_amount: u64,
}
