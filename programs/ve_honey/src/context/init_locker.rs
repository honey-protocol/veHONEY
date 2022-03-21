use crate::constants::*;
use crate::state::*;
use anchor_lang::prelude::*;
use anchor_spl::token::Mint;
use vipers::*;

#[derive(Accounts)]
pub struct InitLocker<'info> {
    /// Payer of the initialization.
    #[account(mut)]
    pub payer: Signer<'info>,
    /// Base.
    pub base: Signer<'info>,
    /// [Locker].
    #[account(
        init,
        seeds = [LOCKER_SEED.as_bytes(), base.key().as_ref()],
        bump,
        payer = payer
    )]
    pub locker: Box<Account<'info, Locker>>,
    /// Mint of the token that can be used to join the [Locker].
    pub token_mint: Box<Account<'info, Mint>>,

    /// System program.
    pub system_program: Program<'info, System>,
}

impl<'info> InitLocker<'info> {
    pub fn process(&mut self, bump: u8, admin: Pubkey, params: LockerParams) -> Result<()> {
        let locker = &mut self.locker;

        locker.token_mint = self.token_mint.key();
        locker.base = self.base.key();
        locker.bump = bump;
        locker.admin = admin;
        locker.params = params;

        emit!(InitLockerEvent {
            locker: locker.key(),
            token_mint: locker.token_mint,
            admin,
            params
        });

        Ok(())
    }
}

impl<'info> Validate<'info> for InitLocker<'info> {
    fn validate(&self) -> Result<()> {
        Ok(())
    }
}

#[event]
/// Event called in [ve_honey::init_locker].
pub struct InitLockerEvent {
    /// The [Locker] being created.
    #[index]
    pub locker: Pubkey,
    /// Mint of the token that can be used to join the [Locker].
    pub token_mint: Pubkey,
    /// Admin of the [Locker].
    pub admin: Pubkey,
    /// [LockerParams].
    pub params: LockerParams,
}
