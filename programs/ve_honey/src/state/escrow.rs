use crate::state::*;
use anchor_lang::{prelude::*, solana_program::pubkey::PUBKEY_BYTES};
use vipers::*;

#[account]
#[derive(Debug, Default)]
pub struct Escrow {
    /// The [Locker] that this [Escrow] is part of.
    pub locker: Pubkey,
    /// The key of the account that is authorized to stake into/withdraw from this [Escrow].
    pub owner: Pubkey,
    /// bump seed
    pub bump: u8,

    /// The token account holding the escrow tokens.
    pub tokens: Pubkey,
    /// Amount of tokens staked.
    pub amount: u64,
    /// When the [Escrow::owner] started their escrow.
    pub escrow_started_at: i64,
    /// When the escrow unlocks; i.e. the [Escrow::owner] is scheduled to be allowed to withdraw their tokens.
    pub escrow_ends_at: i64,
    /// Count of receipts for NFTs burnt
    pub receipt_count: u64,

    /// Account that is authorized to vote on behalf of this [Escrow].
    /// Defaults to the [Escrow::owner].
    pub vote_delegate: Pubkey,
}

impl Escrow {
    pub const LEN: usize =
        PUBKEY_BYTES + PUBKEY_BYTES + 1 + PUBKEY_BYTES + 8 + 8 + 8 + 8 + PUBKEY_BYTES;

    pub fn update_lock_event(
        &mut self,
        locker: &mut Locker,
        lock_amount: u64,
        next_escrow_started_at: i64,
        next_escrow_ends_at: i64,
        receipt: bool,
    ) -> Result<()> {
        self.amount = unwrap_int!(self.amount.checked_add(lock_amount));
        self.escrow_started_at = next_escrow_started_at;
        self.escrow_ends_at = next_escrow_ends_at;

        if receipt {
            self.receipt_count = self.receipt_count + 1;
        }

        locker.locked_supply = unwrap_int!(locker.locked_supply.checked_add(lock_amount));

        Ok(())
    }

    pub fn voting_power_at_time(&self, locker: &LockerParams, timestamp: i64) -> Option<u64> {
        locker.calculate_voter_power(self, timestamp)
    }

    pub fn voting_power(&self, locker: &LockerParams) -> Result<u64> {
        Ok(unwrap_int!(self.voting_power_at_time(
            locker,
            Clock::get()?.unix_timestamp
        )))
    }
}
