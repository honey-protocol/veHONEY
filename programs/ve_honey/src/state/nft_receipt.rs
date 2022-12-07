use crate::*;
use anchor_lang::solana_program::pubkey::PUBKEY_BYTES;

#[account]
pub struct NftReceipt {
    // receipt id
    pub receipt_id: u64,
    // the [Locker] that this [NftVault] is part of.
    pub locker: Pubkey,
    // the owner of this [NftVault].
    pub owner: Pubkey,
    // when the [NftVault::owner] locked nft.
    pub vest_started_at: i64,
    // when the vault unlocks; i.e. the [NftVault::owner] is scheduled to be allowed to withdraw their token.
    pub vest_ends_at: i64,
    // claimed amount
    pub claimed_amount: u64,
}

impl NftReceipt {
    pub const LEN: usize = 8 + PUBKEY_BYTES + PUBKEY_BYTES + 8 + 8 + 8;

    pub fn update_receipt(
        &mut self,
        locker: &mut Locker,
        escrow: &mut Escrow,
        claim_amount: u64,
    ) -> Result<()> {
        locker.locked_supply = unwrap_int!(locker.locked_supply.checked_sub(claim_amount));
        escrow.amount = unwrap_int!(escrow.amount.checked_sub(claim_amount));
        escrow.amount_to_receipt = unwrap_int!(escrow.amount_to_receipt.checked_sub(claim_amount));

        self.claimed_amount = unwrap_int!(self.claimed_amount.checked_add(claim_amount));

        Ok(())
    }

    pub fn calculate_reward_amount_at_time(
        &self,
        locker: &LockerParams,
        timestamp: i64,
    ) -> Option<u64> {
        let due = timestamp.min(self.vest_ends_at);
        let duration = due.checked_sub(self.vest_started_at)?;

        locker
            .calculate_reward_amount(duration)?
            .checked_sub(self.claimed_amount)
    }

    pub fn calculate_remaining_reward_amount(&self, locker: &LockerParams) -> Option<u64> {
        self.calculate_reward_amount_at_time(locker, self.vest_ends_at)
    }
}
