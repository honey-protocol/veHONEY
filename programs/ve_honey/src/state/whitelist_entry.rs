use anchor_lang::prelude::*;
use anchor_lang::solana_program::pubkey::PUBKEY_BYTES;

#[account]
#[derive(Debug, Default)]
pub struct WhitelistEntry {
    /// [Locker] that this whitelist entry belongs to
    pub locker: Pubkey,
    /// bump seed
    pub bump: u8,
    /// Key of the program_id allowed to call the `lock` CPI
    pub program_id: Pubkey,
    /// The account authorized to be the [Escrow::owner] with this CPI.
    /// If set to [anchor_lang::solana_program::system_program::ID],
    /// all accounts are allowed to be the [Escrow::owner]
    pub owner: Pubkey,
}

impl WhitelistEntry {
    pub const LEN: usize = 1 + PUBKEY_BYTES * 3;
}
