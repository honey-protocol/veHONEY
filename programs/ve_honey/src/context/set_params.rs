use crate::state::*;
use anchor_lang::prelude::*;
use vipers::*;

#[derive(Accounts)]
pub struct SetLockerParams<'info> {
    pub admin: Signer<'info>,
    #[account(mut)]
    pub locker: Box<Account<'info, Locker>>,
}

impl<'info> SetLockerParams<'info> {
    pub fn process(&mut self, params: LockerParams) -> Result<()> {
        self.locker.params = params;

        Ok(())
    }
}

impl<'info> Validate<'info> for SetLockerParams<'info> {
    fn validate(&self) -> Result<()> {
        assert_keys_eq!(self.admin, self.locker.admin);

        Ok(())
    }
}
