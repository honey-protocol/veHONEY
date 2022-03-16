use anchor_lang::prelude::*;

#[account]
#[derive(Debug, Default)]
pub struct Locker {
    /// Base
    pub base: Pubkey,
    /// bump seed
    pub bump: u8,
    /// Mint of the token that must be locked in the locker.
    pub token_mint: Pubkey,
    /// Total number of tokens locked in the escrow.
    pub locked_supply: u64,

    /// Administrator of the [Locker].
    pub admin: Pubkey,

    /// Locker params.
    pub params: LockerParams,
}

#[derive(AnchorDeserialize, AnchorSerialize, Default, Debug, Clone, Copy, PartialEq, Eq)]
pub struct LockerParams {
    /// Minimum staking duration.
    pub min_stake_duration: u64,
    /// Maximum staking duration.
    pub max_stake_duration: u64,
    /// Whether or not the locking whitelist system is enabled.
    pub whitelist_enabled: bool,
    /// The weight of a maximum vote lock relative to the total number of tokens locked.
    pub multiplier: u8,
}
