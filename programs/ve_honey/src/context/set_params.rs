use crate::error::*;
use crate::state::*;
use anchor_lang::prelude::*;
use govern::Governor;
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

#[derive(Accounts)]
pub struct SetLockerParamsV2<'info> {
    /// The [Locker].
    #[account(mut)]
    pub locker: Box<Account<'info, LockerV2>>,
    /// The [Governor].
    pub governor: Box<Account<'info, Governor>>,
    /// The smart wallet on the [Governor].
    pub smart_wallet: Signer<'info>,
}

impl<'info> SetLockerParamsV2<'info> {
    pub fn process(&mut self, params: LockerParamsV2) -> Result<()> {
        self.locker.params = params;

        Ok(())
    }
}

impl<'info> Validate<'info> for SetLockerParamsV2<'info> {
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
