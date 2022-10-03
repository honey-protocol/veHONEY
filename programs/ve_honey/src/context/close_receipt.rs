use crate::*;

#[derive(Accounts)]
pub struct CloseReceipt<'info> {
    /// [Locker].
    pub locker: Box<Account<'info, Locker>>,
    /// [Escrow].
    #[account(mut)]
    pub escrow: Box<Account<'info, Escrow>>,
    /// [NftReceipts].
    #[account(mut, close = funds_receiver)]
    pub nft_receipt: Box<Account<'info, NftReceipt>>,
    /// escrow owner.
    pub escrow_owner: Signer<'info>,

    /// funds receiver
    #[account(mut)]
    pub funds_receiver: UncheckedAccount<'info>,
}

impl<'info> CloseReceipt<'info> {
    pub fn process(&mut self) -> Result<()> {
        Ok(())
    }
}

impl<'info> Validate<'info> for CloseReceipt<'info> {
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
            self.escrow_owner,
            self.escrow.owner,
            ProtocolError::InvalidAccountOwner
        );
        assert_keys_eq!(
            self.escrow_owner,
            self.nft_receipt.owner,
            ProtocolError::InvalidAccountOwner
        );
        let now = Clock::get()?.unix_timestamp;
        msg!(
            "now: {}; vest_ends_at: {}",
            now,
            self.nft_receipt.vest_ends_at
        );
        invariant!(
            self.nft_receipt.vest_ends_at < now,
            ProtocolError::ReceiptNotEnded
        );
        let max_reward_amount = self.locker.params.calculate_max_reward_amount();
        invariant!(
            max_reward_amount == Some(self.nft_receipt.claimed_amount),
            ProtocolError::CloseNonZeroReceipt
        );

        Ok(())
    }
}
