use crate::*;
use anchor_lang::solana_program::pubkey::PUBKEY_BYTES;
use num_traits::ToPrimitive;

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
    /// Mint of the WL token that is minted against burning NFT.
    pub wl_token_mint: Pubkey,

    /// Governor of the [Locker].
    pub governor: Pubkey,

    /// Locker params.
    pub params: LockerParams,
}

impl Locker {
    pub const LEN: usize =
        PUBKEY_BYTES + 1 + PUBKEY_BYTES + 8 + PUBKEY_BYTES + PUBKEY_BYTES + LockerParams::LEN;
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

    pub fn calculate_reward_amount(&self, duration: i64) -> Option<u64> {
        if duration <= 0 {
            return None;
        }

        let mut duration: u64 = duration as u64;
        let mut reward_amount: u64 = 0;
        let mut count: u8 = 0;
        let mut amount_per_unit = self.nft_stake_base_reward;

        while let Some(next_duration) = duration.checked_sub(self.nft_stake_duration_unit as u64) {
            if count >= self.nft_reward_halving_starts_at {
                amount_per_unit /= 2;
            }
            reward_amount = reward_amount.checked_add(amount_per_unit)?;
            count += 1;
            duration = next_duration;
        }

        Some(reward_amount)
    }

    pub fn calculate_nft_max_stake_duration(&self) -> Option<i64> {
        self.nft_stake_duration_unit
            .checked_mul(self.nft_stake_duration_count as i64)
    }

    pub fn calculate_max_reward_amount(&self) -> Option<u64> {
        self.calculate_reward_amount(self.calculate_nft_max_stake_duration()?)
    }
}
