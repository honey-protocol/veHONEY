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

    // v2 instructions
    #[access_control(ctx.accounts.validate())]
    pub fn init_locker(ctx: Context<InitLocker>, params: LockerParams) -> Result<()> {
        ctx.accounts.process(unwrap_bump!(ctx, "locker"), params)?;
        Ok(())
    }

    #[access_control(ctx.accounts.validate())]
    pub fn init_escrow(ctx: Context<InitEscrow>) -> Result<()> {
        ctx.accounts.process(unwrap_bump!(ctx, "escrow"))?;
        Ok(())
    }

    #[access_control(ctx.accounts.validate())]
    pub fn init_treasury(ctx: Context<InitTreasury>) -> Result<()> {
        ctx.accounts.process()?;
        Ok(())
    }

    #[access_control(ctx.accounts.validate())]
    pub fn set_locker_params(ctx: Context<SetLockerParams>, params: LockerParams) -> Result<()> {
        ctx.accounts.process(params)?;
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
    pub fn add_proof(ctx: Context<AddProof>, proof_type: u8) -> Result<()> {
        ctx.accounts.process(proof_type)?;
        Ok(())
    }

    #[access_control(ctx.accounts.validate())]
    pub fn remove_proof(ctx: Context<RemoveProof>) -> Result<()> {
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

    #[access_control(ctx.accounts.validate())]
    pub fn set_vote_delegate(ctx: Context<SetVoteDelegate>, new_delegate: Pubkey) -> Result<()> {
        ctx.accounts.process(new_delegate)?;
        Ok(())
    }
}
