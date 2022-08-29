use anchor_lang::prelude::*;
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
    pub const LEN: usize = 8 + PUBKEY_BYTES + PUBKEY_BYTES + 8 + 8;
}
