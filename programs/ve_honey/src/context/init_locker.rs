use crate::*;
use anchor_spl::token::Mint;
use govern::Governor;

#[derive(Accounts)]
pub struct InitLocker<'info> {
    /// Payer of initialization.
    #[account(mut)]
    pub payer: Signer<'info>,
    /// Base.
    pub base: Signer<'info>,
    /// [Locker].
    #[account(
        init,
        seeds = [
            LOCKER_SEED.as_bytes(),
            base.key().as_ref()
        ],
        bump,
        space = 8 + Locker::LEN,
        payer = payer
    )]
    pub locker: Box<Account<'info, Locker>>,
    /// Mint of the token that can be used to join the [Locker].
    pub token_mint: Box<Account<'info, Mint>>,
    /// Mint of the token that can be used to mint against burning NFT.
    pub wl_token_mint: Box<Account<'info, Mint>>,
    /// [Governor] associated with the [Locker].
    pub governor: Box<Account<'info, Governor>>,

    /// System program.
    pub system_program: Program<'info, System>,
}

impl<'info> InitLocker<'info> {
    pub fn process(&mut self, bump: u8, params: LockerParams) -> Result<()> {
        let locker = &mut self.locker;
        locker.token_mint = self.token_mint.key();
        locker.wl_token_mint = self.wl_token_mint.key();
        locker.governor = self.governor.key();
        locker.base = self.base.key();
        locker.bump = bump;
        locker.params = params;

        emit!(InitLockerEvent {
            locker: locker.key(),
            token_mint: locker.token_mint,
            governor: locker.governor,
            params,
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
    /// The governor of the [Locker].
    pub governor: Pubkey,
    /// [LockerParams].
    pub params: LockerParams,
}
