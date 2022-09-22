use crate::state::*;
use anchor_lang::{prelude::*, solana_program::pubkey::PUBKEY_BYTES};
use num_traits::ToPrimitive;
use vipers::unwrap_int;

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

    /// Governor of the [Locker].
    pub governor: Pubkey,

    /// Locker params.
    pub params: LockerParams,
}

impl Locker {
    pub const LEN: usize = PUBKEY_BYTES + 1 + PUBKEY_BYTES + 8 + PUBKEY_BYTES + LockerParams::LEN;
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
    /// Minimum number of votes required to activate a proposal.
    pub proposal_activation_min_votes: u64,
    /// NFT stake duration unit.
    pub nft_stake_duration_unit: i64,
    /// NFT stake base reward
    pub nft_stake_base_reward: u64,
    /// NFT stake duration count.
    pub nft_stake_duration_count: u8,
    /// First halving count.
    pub nft_reward_halving_starts_at: u8,
}

impl LockerParams {
    pub const LEN: usize = 8 + 8 + 1 + 1 + 8 + 8 + 8 + 1 + 1;

    pub fn calculate_voter_power(&self, escrow: &Escrow, now: i64) -> Option<u64> {
        if now == 0 {
            return None;
        }

        if escrow.escrow_started_at == 0 {
            return Some(0);
        }

        if now < escrow.escrow_started_at || now >= escrow.escrow_ends_at {
            return Some(0);
        }

        let lockup_duration = escrow
            .escrow_ends_at
            .checked_sub(escrow.escrow_started_at)?;

        let relevant_lockup_duration = lockup_duration.to_u64()?.min(self.max_stake_duration);

        let power_if_max_lockup = escrow.amount.checked_mul(self.multiplier.into())?;

        let power = (power_if_max_lockup as u128)
            .checked_mul(relevant_lockup_duration.into())?
            .checked_div(self.max_stake_duration.into())?
            .to_u64()?;

        Some(power)
    }

    pub fn calculate_reward_amount(&self, duration: i64) -> Result<u64> {
        let mut duration = duration;
        let mut amount: u64 = 0;
        let mut count: u8 = 0;
        let mut amount_per_unit = self.nft_stake_base_reward;

        while duration - self.nft_stake_duration_unit >= 0 {
            if count >= self.nft_reward_halving_starts_at {
                amount_per_unit = unwrap_int!(amount_per_unit.checked_div(2));
            }
            amount = unwrap_int!(amount.checked_add(amount_per_unit));
            duration = unwrap_int!(duration.checked_sub(self.nft_stake_duration_unit));
            count += 1;
        }

        Ok(amount)
    }

    pub fn calculate_nft_max_stake_duration(&self) -> Result<i64> {
        Ok(unwrap_int!(self
            .nft_stake_duration_unit
            .checked_mul(self.nft_stake_duration_count as i64)))
    }

    pub fn calculate_max_reward_amount(&self) -> Result<u64> {
        self.calculate_reward_amount(self.calculate_nft_max_stake_duration()?)
    }
}
