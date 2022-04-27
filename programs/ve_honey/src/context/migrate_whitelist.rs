use crate::state::*;
use anchor_lang::prelude::*;
use vipers::*;

#[derive(Accounts)]
pub struct MigrateWhitelist<'info> {
    pub old_locker: Box<Account<'info, Locker>>,
    pub new_locker: Box<Account<'info, LockerV2>>,

    pub locker_admin: Signer<'info>,

    #[account(mut)]
    pub whitelist_entry: Box<Account<'info, WhitelistEntry>>,
}

impl<'info> MigrateWhitelist<'info> {
    pub fn process(&mut self) -> Result<()> {
        self.whitelist_entry.locker = self.new_locker.key();

        Ok(())
    }
}

impl<'info> Validate<'info> for MigrateWhitelist<'info> {
    fn validate(&self) -> Result<()> {
        assert_keys_eq!(self.locker_admin, self.old_locker.admin);
        assert_keys_eq!(self.locker_admin, self.new_locker.governor);
        assert_keys_eq!(self.old_locker, self.whitelist_entry.locker);

        Ok(())
    }
}
