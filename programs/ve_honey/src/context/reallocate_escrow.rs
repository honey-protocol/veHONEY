use crate::constants::*;
use crate::state::*;
use anchor_lang::prelude::*;
use vipers::*;

#[derive(Accounts)]
#[instruction(bump: u8)]
pub struct ReallocateEscrow<'info> {
    /// Payer for the reallocation.
    #[account(mut)]
    pub payer: Signer<'info>,
    /// Admin of the [Locker].
    pub admin: Signer<'info>,
    /// [Locker].
    pub locker: Box<Account<'info, Locker>>,
    #[account(
        mut,
        seeds = [
            ESCROW_SEED.as_bytes(),
            locker.key().as_ref(),
            escrow_owner.key().as_ref(),
        ],
        bump = bump,
    )]
    pub escrow: AccountInfo<'info>,
    /// Authority of the [Escrow] to be reallocated.
    pub escrow_owner: AccountInfo<'info>,

    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
}

impl<'info> ReallocateEscrow<'info> {
    pub fn process(&mut self) -> Result<()> {
        let old_lamports = self.escrow.lamports();
        let new_lamports = self.rent.minimum_balance(8 + Escrow::LEN);

        if old_lamports < new_lamports {
            let lamports_to_transfer = new_lamports.saturating_sub(old_lamports);
            anchor_lang::solana_program::program::invoke(
                &anchor_lang::solana_program::system_instruction::transfer(
                    self.payer.key,
                    &self.escrow.key(),
                    lamports_to_transfer,
                ),
                &[
                    self.payer.to_account_info(),
                    self.escrow.to_account_info(),
                    self.system_program.to_account_info(),
                ],
            )?;
        }

        self.escrow
            .to_account_info()
            .realloc(8 + Escrow::LEN, true)?;

        let mut escrow = Account::<Escrow>::try_from(&self.escrow)?;

        assert_keys_eq!(escrow.owner, self.escrow_owner);

        escrow.vote_delegate = self.escrow_owner.key();

        escrow.exit(&crate::id())?;

        Ok(())
    }
}

impl<'info> Validate<'info> for ReallocateEscrow<'info> {
    fn validate(&self) -> Result<()> {
        assert_keys_eq!(self.locker.governor, self.admin, "Invalid admin");
        
        Ok(())
    }
}
