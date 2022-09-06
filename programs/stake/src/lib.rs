use anchor_lang::prelude::*;
use vipers::*;

pub mod constants;
pub mod context;
pub mod errors;
pub mod state;
pub mod utils;

use constants::*;
use context::*;
use errors::*;
use state::*;
use utils::*;

declare_id!("4V68qajTiVHm3Pm9fQoV8D4tEYBmq3a34R9NV5TymLr7");

#[program]
pub mod stake {
    use super::*;

    #[access_control(ctx.accounts.validate())]
    pub fn initialize(ctx: Context<Initialize>, params: PoolParams) -> Result<()> {
        ctx.accounts
            .process(params, unwrap_bump!(ctx, "authority"))?;
        Ok(())
    }

    #[access_control(ctx.accounts.validate())]
    pub fn modify_params(ctx: Context<ModifyParams>, params: PoolParams) -> Result<()> {
        ctx.accounts.process(params)?;
        Ok(())
    }

    #[access_control(ctx.accounts.validate())]
    pub fn set_owner(ctx: Context<SetOwner>, new_owner: Pubkey) -> Result<()> {
        ctx.accounts.process(new_owner)?;
        Ok(())
    }

    #[access_control(ctx.accounts.validate())]
    pub fn set_mint_authority(ctx: Context<SetMintAuthority>) -> Result<()> {
        ctx.accounts.process()?;
        Ok(())
    }

    #[access_control(ctx.accounts.validate())]
    pub fn reclaim_mint_authority(
        ctx: Context<ReclaimMintAuthority>,
        mint_authority: Pubkey,
    ) -> Result<()> {
        ctx.accounts.process(mint_authority)?;
        Ok(())
    }

    #[access_control(ctx.accounts.validate())]
    pub fn initialize_user(ctx: Context<InitializeUser>) -> Result<()> {
        ctx.accounts.process()?;
        Ok(())
    }

    #[access_control(ctx.accounts.validate())]
    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        ctx.accounts.process(amount)?;
        Ok(())
    }

    #[access_control(ctx.accounts.validate())]
    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        ctx.accounts.process()?;
        Ok(())
    }

    #[access_control(ctx.accounts.validate())]
    pub fn stake<'info>(
        ctx: Context<'_, '_, '_, 'info, Stake<'info>>,
        amount: u64,
        duration: i64,
    ) -> Result<()> {
        ctx.accounts.process(amount, duration)?;
        Ok(())
    }
}
