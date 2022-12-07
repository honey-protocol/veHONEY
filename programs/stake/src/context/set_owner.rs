use crate::*;

#[derive(Accounts)]
pub struct SetOwner<'info> {
    pub owner: Signer<'info>,
    #[account(
        mut,
        has_one = owner @ ProtocolError::InvalidOwner,
    )]
    pub pool_info: Box<Account<'info, PoolInfo>>,
}

impl<'info> Validate<'info> for SetOwner<'info> {
    fn validate(&self) -> Result<()> {
        invariant!(
            self.pool_info.version == STAKE_POOL_VERSION,
            ProtocolError::Uninitialized
        );

        Ok(())
    }
}

impl<'info> SetOwner<'info> {
    pub fn process(&mut self, new_owner: Pubkey) -> Result<()> {
        self.pool_info.owner = new_owner;

        Ok(())
    }
}
