use crate::constants::*;
use crate::state::*;
use anchor_lang::prelude::*;
use vipers::*;

#[derive(Accounts)]
pub struct InitEscrow<'info> {
    /// Payer of the initialization.
    #[account(mut)]
    pub payer: Signer<'info>,
    /// [Locker].
    #[account(mut)]
    pub locker: Box<Account<'info, Locker>>,
    /// [Escrow].
    #[account(
        init,
        seeds = [
            ESCROW_SEED.as_bytes(),
            locker.key().as_ref(),
            locker.last_escrow_id.to_le_bytes().as_ref(),
            escrow_owner.key().as_ref(),
        ],
        bump,
        payer = payer
    )]
    pub escrow: Box<Account<'info, Escrow>>,
    /// CHECK: Authority of the [Escrow] to be created.
    pub escrow_owner: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

impl<'info> InitEscrow<'info> {
    pub fn process(&mut self, bump: u8) -> Result<()> {
        let escrow = &mut self.escrow;
        let locker = &mut self.locker;

        escrow.locker = locker.key();
        escrow.owner = self.escrow_owner.key();
        escrow.bump = bump;

        escrow.amount = 0;
        escrow.escrow_started_at = 0;
        escrow.escrow_ends_at = 0;
        escrow.escrow_id = locker.last_escrow_id;

        locker.last_escrow_id += 1;

        emit!(InitEscrowEvent {
            escrow: escrow.key(),
            escrow_id: escrow.escrow_id,
            escrow_owner: escrow.owner,
            locker: escrow.locker,
            timestamp: Clock::get()?.unix_timestamp
        });

        Ok(())
    }
}

impl<'info> Validate<'info> for InitEscrow<'info> {
    fn validate(&self) -> Result<()> {
        Ok(())
    }
}

#[event]
/// Event called in [ve_honey::init_escrow].
pub struct InitEscrowEvent {
    /// The [Escrow] being created.
    pub escrow: Pubkey,
    /// Id of this [Escrow].
    pub escrow_id: u64,
    /// The owner of the [Escrow].
    #[index]
    pub escrow_owner: Pubkey,
    /// The locker of the [Escrow].
    #[index]
    pub locker: Pubkey,
    /// Timetamp for the event.
    pub timestamp: i64,
}
