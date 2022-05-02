use crate::constants::*;
use crate::state::*;
use anchor_lang::prelude::*;
use govern::Governor;

#[derive(Accounts)]
pub struct MigrateLocker<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub base: Signer<'info>,
    #[account(
        seeds = [LOCKER_SEED.as_bytes(), base.key().as_ref()],
        bump = locker.bump
    )]
    pub locker: Box<Account<'info, Locker>>,
    pub new_base: Signer<'info>,
    #[account(
        init,
        seeds = [LOCKER_SEED.as_bytes(), new_base.key().as_ref()],
        bump,
        space = 8 + LockerV2::LEN,
        payer = payer
    )]
    pub new_locker: Box<Account<'info, LockerV2>>,

    pub governor: Box<Account<'info, Governor>>,
    /// CHECK:
    pub smart_wallet: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

impl<'info> MigrateLocker<'info> {
    pub fn process(&mut self, proposal_activation_min_votes: u64, bump: u8) -> Result<()> {
        let old_locker = &self.locker;
        let new_locker = &mut self.new_locker;

        new_locker.token_mint = old_locker.token_mint;
        new_locker.locked_supply = old_locker.locked_supply;
        new_locker.governor = self.governor.key();
        new_locker.base = self.new_base.key();
        new_locker.bump = bump;

        new_locker.params = LockerParamsV2 {
            whitelist_enabled: old_locker.params.whitelist_enabled,
            multiplier: old_locker.params.multiplier,
            max_stake_duration: old_locker.params.max_stake_duration,
            min_stake_duration: old_locker.params.min_stake_duration,
            proposal_activation_min_votes,
        };

        Ok(())
    }
}
