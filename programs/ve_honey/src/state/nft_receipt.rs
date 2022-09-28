use crate::*;
use anchor_lang::solana_program::pubkey::PUBKEY_BYTES;

pub const MAX_VEST_DURATION: i64 = 315_360_000;
pub const UNIT_VEST_DURATION: i64 = 31_536_000;

// Year 1 = 3_750_000_000
// Year 2 = 3_750_000_000
// Year 3 = 1_875_000_000
// Year 4 = 937_500_000
// Year 5 = 468_750_000
// Year 6 = 234_375_000
// Year 7 = 117_187_500
// Year 8 = 58_593_750
// Year 9 = 29_296_875
// Year 10 = 14_648_438
pub const MAX_REWARD_AMOUNT: u64 = 3_750_000_000 * 2
    + 1_875_000_000
    + 937_500_000
    + 468_750_000
    + 234_375_000
    + 117_187_500
    + 58_593_750
    + 29_296_875
    + 14_648_438;
pub const BASE_REWARD_AMOUNT: u64 = 3_750_000_000;

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
        invariant!(claim_amount > 0, ProtocolError::InvariantViolated);

        locker.locked_supply = unwrap_int!(locker.locked_supply.checked_sub(claim_amount));
        escrow.amount = unwrap_int!(escrow.amount.checked_sub(claim_amount));

        self.claimed_amount = unwrap_int!(self.claimed_amount.checked_add(claim_amount));

        Ok(())
    }

    pub fn get_claim_amount_at(&self, locker: &LockerParams, timestamp: i64) -> Result<u64> {
        let due = timestamp.min(self.vest_ends_at);
        let duration = unwrap_int!(due.checked_sub(self.vest_started_at));
        let reward_amount = locker.calculate_reward_amount(duration)?;

        Ok(unwrap_int!(reward_amount.checked_sub(self.claimed_amount)))
    }
}
