use crate::state::Locker;
use anchor_lang::prelude::*;
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
}

impl Escrow {
    pub fn update_lock_event(
        &mut self,
        locker: &mut Locker,
        lock_amount: u64,
        next_escrow_started_at: i64,
        next_escrow_ends_at: i64,
    ) -> Result<()> {
        self.amount = unwrap_int!(self.amount.checked_add(lock_amount));
        self.escrow_started_at = next_escrow_started_at;
        self.escrow_ends_at = next_escrow_ends_at;

        locker.locked_supply = unwrap_int!(locker.locked_supply.checked_add(lock_amount));

        Ok(())
    }

    pub fn update_transfer_event() -> Result<()> {
        Ok(())
    }
}
