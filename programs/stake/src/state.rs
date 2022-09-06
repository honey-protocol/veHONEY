use crate::*;
use num_traits::ToPrimitive;

#[account]
#[derive(Default)]
pub struct PoolInfo {
    pub version: u8,
    pub p_token_mint: Pubkey,
    pub token_mint: Pubkey,
    pub owner: Pubkey,
    pub bump: u8,
    pub params: PoolParams,
}

impl PoolInfo {
    pub const LEN: usize = 1 + 32 + 32 + 32 + 1 + 8 + 8 + 1;
}

#[derive(Default, Clone, Copy, AnchorDeserialize, AnchorSerialize)]
pub struct PoolParams {
    pub starts_at: i64,
    pub claim_period_unit: i64,
    pub max_claim_count: u8,
}

impl PoolParams {
    pub fn get_claim_period(&self) -> Result<i64> {
        let max_claim_count = unwrap_int!(self.max_claim_count.to_i64());
        let claim_period = unwrap_int!(self.claim_period_unit.checked_mul(max_claim_count));
        Ok(claim_period)
    }
}

#[account]
#[derive(Default)]
pub struct PoolUser {
    pub pool_info: Pubkey,
    pub owner: Pubkey,
    pub deposit_amount: u64,
    pub claimed_amount: u64,
    pub deposited_at: i64,
    pub count: u8,
}

impl PoolUser {
    pub const LEN: usize = 32 + 32 + 8 + 8 + 8 + 1;

    pub fn deposit(&mut self, amount: u64) -> Result<()> {
        let remaining_amount = unwrap_int!(self.deposit_amount.checked_sub(self.claimed_amount));
        self.deposit_amount = unwrap_int!(remaining_amount.checked_add(amount));
        self.claimed_amount = 0;

        let now = Clock::get()?.unix_timestamp;

        self.deposited_at = now;
        self.count = 0;

        Ok(())
    }

    pub fn claim(&mut self, pool_params: PoolParams) -> Result<u64> {
        let (claimable_amount, count) = self.get_claimable_amount(pool_params)?;

        if count == pool_params.max_claim_count {
            self.claimed_amount = self.deposit_amount;
        } else {
            self.claimed_amount = unwrap_int!(self.claimed_amount.checked_add(claimable_amount));
        }

        self.count = count;

        Ok(claimable_amount)
    }

    pub fn get_claimable_amount(&self, pool_params: PoolParams) -> Result<(u64, u8)> {
        let now = Clock::get()?.unix_timestamp;
        let claim_starts_at = if self.deposited_at > pool_params.starts_at {
            self.deposited_at
        } else {
            pool_params.starts_at
        };
        let duration = unwrap_int!(now.checked_sub(claim_starts_at));

        if duration > pool_params.get_claim_period()? {
            // rest amount is claimable
            return Ok((
                unwrap_int!(self.deposit_amount.checked_sub(self.claimed_amount)),
                pool_params.max_claim_count,
            ));
        } else {
            let count = unwrap_opt!((duration / pool_params.claim_period_unit).to_u8());
            invariant!(count > self.count, ProtocolError::NotClaimable);
            let delta = count - self.count;
            let delta = unwrap_opt!((self.deposit_amount as u128).checked_mul(delta as u128));
            let delta = unwrap_opt!(delta.checked_div(pool_params.max_claim_count as u128));

            return Ok((unwrap_int!(delta.to_u64()), count));
        }
    }
}
