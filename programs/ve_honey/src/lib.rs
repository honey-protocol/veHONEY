use anchor_lang::prelude::*;
use vipers::*;

pub mod constants;
pub mod context;
pub mod error;
pub mod macros;
pub mod state;
pub use context::*;
pub use state::*;

declare_id!("CKQapf8pWoMddT15grV8UCPjiLCTHa12NRgkKV63Lc7q");

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
    pub fn set_locker_params(ctx: Context<SetLockerParams>, params: LockerParams) -> Result<()> {
        ctx.accounts.process(params)?;
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
        if ctx.accounts.locker.params.whitelist_enabled {
            ctx.accounts.check_whitelisted(ctx.remaining_accounts)?;
        }
        ctx.accounts.process(amount, duration)?;

        Ok(())
    }

    #[access_control(ctx.accounts.validate())]
    pub fn exit(ctx: Context<Exit>) -> Result<()> {
        ctx.accounts.process()?;
        Ok(())
    }

    // Migration v1 to v2
    pub fn migrate_locker(
        ctx: Context<MigrateLocker>,
        proposal_activation_min_votes: u64,
    ) -> Result<()> {
        ctx.accounts.process(
            proposal_activation_min_votes,
            unwrap_bump!(ctx, "new_locker"),
        )?;
        Ok(())
    }

    pub fn migrate_escrow(ctx: Context<MigrateEscrow>) -> Result<()> {
        ctx.accounts.process(unwrap_bump!(ctx, "new_escrow"))?;
        Ok(())
    }

    pub fn migrate_whitelist(ctx: Context<MigrateWhitelist>) -> Result<()> {
        ctx.accounts
            .process(unwrap_bump!(ctx, "new_whitelist_entry"))?;
        Ok(())
    }

    // v2 instructions
    #[access_control(ctx.accounts.validate())]
    pub fn init_locker_v2(ctx: Context<InitLockerV2>, params: LockerParamsV2) -> Result<()> {
        ctx.accounts.process(unwrap_bump!(ctx, "locker"), params)?;
        Ok(())
    }

    #[access_control(ctx.accounts.validate())]
    pub fn init_escrow_v2(ctx: Context<InitEscrowV2>) -> Result<()> {
        ctx.accounts.process(unwrap_bump!(ctx, "escrow"))?;
        Ok(())
    }

    #[access_control(ctx.accounts.validate())]
    pub fn set_locker_params_v2(
        ctx: Context<SetLockerParamsV2>,
        params: LockerParamsV2,
    ) -> Result<()> {
        ctx.accounts.process(params)?;
        Ok(())
    }

    #[access_control(ctx.accounts.validate())]
    pub fn approve_program_lock_privilege_v2(
        ctx: Context<ApproveProgramLockPrivilegeV2>,
    ) -> Result<()> {
        ctx.accounts.process(unwrap_bump!(ctx, "whitelist_entry"))?;
        Ok(())
    }

    #[access_control(ctx.accounts.validate())]
    pub fn revoke_program_lock_privilege_v2(
        ctx: Context<RevokeProgramLockPrivilegeV2>,
    ) -> Result<()> {
        ctx.accounts.process()?;
        Ok(())
    }

    #[access_control(ctx.accounts.validate())]
    pub fn lock_v2<'info>(
        ctx: Context<'_, '_, '_, 'info, LockV2<'info>>,
        amount: u64,
        duration: i64,
    ) -> Result<()> {
        if ctx.accounts.locker.params.whitelist_enabled {
            ctx.accounts.check_whitelisted(ctx.remaining_accounts)?;
        }
        ctx.accounts.process(amount, duration)?;
        Ok(())
    }

    #[access_control(ctx.accounts.validate())]
    pub fn exit_v2(ctx: Context<ExitV2>) -> Result<()> {
        ctx.accounts.process()?;
        Ok(())
    }

    #[access_control(ctx.accounts.validate())]
    pub fn activate_proposal(ctx: Context<ActivateProposal>) -> Result<()> {
        ctx.accounts.process()?;
        Ok(())
    }

    #[access_control(ctx.accounts.validate())]
    pub fn cast_vote(ctx: Context<CastVote>, side: u8) -> Result<()> {
        ctx.accounts.process(side)?;
        Ok(())
    }

    // pub fn realloc_locker(
    //     ctx: Context<ReallocLocker>,
    //     _bump: u8,
    //     proposal_activation_min_votes: u64,
    // ) -> Result<()> {
    //     ctx.accounts.process(proposal_activation_min_votes)?;
    //     Ok(())
    // }
}
