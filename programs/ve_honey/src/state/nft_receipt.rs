use crate::error::*;
use anchor_lang::prelude::*;
use anchor_lang::solana_program::pubkey::PUBKEY_BYTES;
use vipers::*;

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
    pub const LEN: usize = 8 + PUBKEY_BYTES + PUBKEY_BYTES + 8 + 8;

    pub fn update_receipt(&mut self, now: i64) -> Result<u64> {
        if now <= self.vest_started_at {
            return Err(error!(ProtocolError::NotClaimable));
        }

        let amount_to_be_claimed = self.claimable_amount(now.min(self.vest_ends_at))?;

        let claimable_amount = unwrap_int!(amount_to_be_claimed.checked_sub(self.claimed_amount));

        self.claimed_amount = amount_to_be_claimed;

        Ok(claimable_amount)
    }

    pub fn claimable_amount(&mut self, due: i64) -> Result<u64> {
        let mut duration = unwrap_int!(due.checked_sub(self.vest_started_at));
        let mut amount: u64 = 0;
        let mut year: u8 = 0;
        let mut halving_amount = BASE_REWARD_AMOUNT;

        while duration - UNIT_VEST_DURATION >= 0 {
            if year >= 2 {
                halving_amount = unwrap_int!(halving_amount.checked_div(2));
            }
            amount = unwrap_int!(amount.checked_add(halving_amount));
            duration = unwrap_int!(duration.checked_sub(UNIT_VEST_DURATION));
            year = year + 1;
        }

        Ok(amount)
    }
}
