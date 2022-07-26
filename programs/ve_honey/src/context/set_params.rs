use crate::error::*;
use crate::state::*;
use anchor_lang::prelude::*;
use govern::Governor;
use vipers::*;

#[derive(Accounts)]
pub struct SetLockerParams<'info> {
    /// The [Locker].
    #[account(mut)]
    pub locker: Box<Account<'info, Locker>>,
    /// The [Governor].
    pub governor: Box<Account<'info, Governor>>,
    /// The smart wallet on the [Governor].
    pub smart_wallet: Signer<'info>,
}

impl<'info> SetLockerParams<'info> {
    pub fn process(&mut self, params: LockerParams) -> Result<()> {
        self.locker.params = params;

        Ok(())
    }
}

impl<'info> Validate<'info> for SetLockerParams<'info> {
    fn validate(&self) -> Result<()> {
        assert_keys_eq!(
            self.governor,
            self.locker.governor,
            ProtocolError::GovernorMismatch
        );
        assert_keys_eq!(self.smart_wallet, self.governor.smart_wallet);

        Ok(())
    }
}
