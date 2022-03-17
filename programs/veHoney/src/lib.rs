use anchor_lang::prelude::*;
use vipers::*;

pub mod constants;
pub mod context;
pub mod error;
pub mod macros;
pub mod state;
pub use context::*;
pub use state::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod ve_honey {
    use super::*;

    #[access_control(ctx.accounts.validate())]
    pub fn init_locker(
        ctx: Context<InitLocker>,
        admin: Pubkey,
        params: LockerParams,
    ) -> Result<()> {
        ctx.accounts
            .process(unwrap_bump!(ctx, "locker"), admin, params)?;
        Ok(())
    }

    #[access_control(ctx.accounts.validate())]
    pub fn init_escrow(ctx: Context<InitEscrow>) -> Result<()> {
        ctx.accounts.process(unwrap_bump!(ctx, "escrow"))?;
        Ok(())
    }

    #[access_control(ctx.accounts.validate())]
    pub fn approve_program_lock_privilege(ctx: Context<ApproveProgramLockPrivilege>) -> Result<()> {
        ctx.accounts.process(unwrap_bump!(ctx, "whitelist_entry"))?;
        Ok(())
    }

    #[access_control(ctx.accounts.validate())]
    pub fn revoke_program_lock_privilege(ctx: Context<RevokeProgramLockPrivilege>) -> Result<()> {
        ctx.accounts.process()?;
        Ok(())
    }

    #[access_control(ctx.accounts.validate())]
    pub fn lock<'info>(
        ctx: Context<'_, '_, '_, 'info, Lock<'info>>,
        amount: u64,
        duration: i64,
    ) -> Result<()> {
        // if ctx.accounts.locker.params.whitelist_enabled {
        //     ctx.accounts.check_whitelisted(ctx.remaining_accounts)?;
        // }
        ctx.accounts.process(amount, duration)?;

        Ok(())
    }

    #[access_control(ctx.accounts.validate())]
    pub fn exit(ctx: Context<Exit>) -> Result<()> {
        ctx.accounts.process()?;
        Ok(())
    }

    #[access_control(ctx.accounts.validate())]
    pub fn transfer(ctx: Context<TransferEscrow>, amount: u64) -> Result<()> {
        ctx.accounts.process(amount)?;
        Ok(())
    }
}
