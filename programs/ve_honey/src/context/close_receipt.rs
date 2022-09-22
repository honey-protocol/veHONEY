use crate::error::*;
use crate::state::*;
use anchor_lang::prelude::*;
use vipers::*;

#[derive(Accounts)]
pub struct CloseReceipt<'info> {
    /// [Locker].
    pub locker: Box<Account<'info, Locker>>,
    /// [Escrow].
    #[account(mut, has_one = locker)]
    pub escrow: Box<Account<'info, Escrow>>,
    /// [NftReceipts].
    #[account(mut, has_one = locker, close = funds_receiver)]
    pub nft_receipt: Box<Account<'info, NftReceipt>>,
    /// escrow owner.
    pub escrow_owner: Signer<'info>,

    /// funds receiver
    #[account(mut)]
    pub funds_receiver: UncheckedAccount<'info>,
}

impl<'info> CloseReceipt<'info> {
    pub fn process(&mut self) -> Result<()> {
        self.escrow.receipt_count -= 1;

        Ok(())
    }
}

impl<'info> Validate<'info> for CloseReceipt<'info> {
    fn validate(&self) -> Result<()> {
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
        invariant!(
            self.escrow.receipt_count > 0,
            ProtocolError::InvariantViolated
        );
        let now = Clock::get()?.unix_timestamp;
        msg!(
            "now: {}; vest_ends_at: {}",
            now,
            self.nft_receipt.vest_ends_at
        );
        invariant!(
            now > self.nft_receipt.vest_ends_at,
            ProtocolError::ReceiptNotEnded
        );
        let total_reward = self.locker.params.calculate_max_reward_amount()?;
        invariant!(
            total_reward == self.nft_receipt.claimed_amount,
            ProtocolError::InvariantViolated
        );

        Ok(())
    }
}
