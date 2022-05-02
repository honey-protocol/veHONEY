use crate::constants::*;
use crate::state::*;
use anchor_lang::prelude::*;
use vipers::*;

#[derive(Accounts)]
pub struct MigrateWhitelist<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    pub old_locker: Box<Account<'info, Locker>>,
    pub new_locker: Box<Account<'info, LockerV2>>,

    pub locker_admin: Signer<'info>,

    #[account(mut)]
    pub whitelist_entry: Box<Account<'info, WhitelistEntry>>,

    #[account(
        init,
        seeds = [
            WHITELIST_ENTRY_SEED.as_bytes(),
            new_locker.key().as_ref(),
            whitelist_entry.program_id.as_ref(),
            whitelist_entry.owner.as_ref()
        ],
        bump,
        space = 8 + WhitelistEntry::LEN,
        payer = payer
    )]
    pub new_whitelist_entry: Box<Account<'info, WhitelistEntry>>,

    pub system_program: Program<'info, System>,
}

impl<'info> MigrateWhitelist<'info> {
    pub fn process(&mut self, bump: u8) -> Result<()> {
        self.new_whitelist_entry.locker = self.new_locker.key();
        self.new_whitelist_entry.bump = bump;
        self.new_whitelist_entry.program_id = self.whitelist_entry.program_id;
        self.new_whitelist_entry.owner = self.whitelist_entry.owner;

        Ok(())
    }
}

impl<'info> Validate<'info> for MigrateWhitelist<'info> {
    fn validate(&self) -> Result<()> {
        assert_keys_eq!(self.locker_admin, self.old_locker.admin);
        assert_keys_eq!(self.old_locker, self.whitelist_entry.locker);

        Ok(())
    }
}
