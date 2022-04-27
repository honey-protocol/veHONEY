use anchor_lang::prelude::*;
use anchor_lang::solana_program::pubkey::PUBKEY_BYTES;

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

#[account]
#[derive(Debug, Default)]
pub struct LockerV2 {
    /// Base
    pub base: Pubkey,
    /// bump seed
    pub bump: u8,
    /// Mint of the token that must be locked in the locker.
    pub token_mint: Pubkey,
    /// Total number of tokens locked in the escrow.
    pub locked_supply: u64,

    /// Governor associated with the [Locker].
    pub governor: Pubkey,

    /// Locker params.
    pub params: LockerParamsV2,
}

impl LockerV2 {
    pub const LEN: usize = PUBKEY_BYTES + 1 + PUBKEY_BYTES + 8 + PUBKEY_BYTES + LockerParamsV2::LEN;
}

#[derive(AnchorDeserialize, AnchorSerialize, Default, Debug, Clone, Copy, PartialEq, Eq)]
pub struct LockerParamsV2 {
    /// Minimum staking duration.
    pub min_stake_duration: u64,
    /// Maximum staking duration.
    pub max_stake_duration: u64,
    /// Minimum number of votes required to activate a proposal.
    pub proposal_activation_min_votes: u64,
    /// Whether or not the locking whitelist system is enabled.
    pub whitelist_enabled: bool,
    /// The weight of a maximum vote lock relative to the total number of tokens locked.
    pub multiplier: u8,
}

impl LockerParamsV2 {
    pub const LEN: usize = 8 + 8 + 8 + 1 + 1;
}
