use crate::constants::*;
use crate::state::*;
use anchor_lang::prelude::*;
use vipers::assert_keys_eq;

#[derive(Accounts)]
#[instruction(bump: u8)]
pub struct ReallocLocker<'info> {
    pub payer: Signer<'info>,
    pub admin: Signer<'info>,
    pub base: AccountInfo<'info>,
    #[account(
        mut,
        seeds = [LOCKER_SEED.as_bytes(), base.key().as_ref()],
        bump = bump,
    )]
    pub locker: AccountInfo<'info>,

    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
}

impl<'info> ReallocLocker<'info> {
    pub fn process(&mut self) -> Result<()> {
        let old_lamports = self.locker.lamports();
        let new_lamports = self.rent.minimum_balance(8 + Locker::LEN);

        if old_lamports < new_lamports {
            let lamports_to_transfer = new_lamports.saturating_sub(old_lamports);
            anchor_lang::solana_program::program::invoke(
                &anchor_lang::solana_program::system_instruction::transfer(
                    self.payer.key,
                    &self.locker.key(),
                    lamports_to_transfer,
                ),
                &[
                    self.payer.to_account_info(),
                    self.locker.to_account_info(),
                    self.system_program.to_account_info(),
                ],
            )?;
        }

        self.locker
            .to_account_info()
            .realloc(8 + Locker::LEN, true)?;

        let locker = Account::<Locker>::try_from(&self.locker)?;

        assert_keys_eq!(locker.governor, self.admin);

        Ok(())
    }
}
