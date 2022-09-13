use crate::*;

#[derive(Accounts)]
pub struct ModifyParams<'info> {
    pub owner: Signer<'info>,
    #[account(
        mut,
        has_one = owner @ ProtocolError::InvalidOwner,
    )]
    pub pool_info: Box<Account<'info, PoolInfo>>,
}

impl<'info> Validate<'info> for ModifyParams<'info> {
    fn validate(&self) -> Result<()> {
        invariant!(
            self.pool_info.version == STAKE_POOL_VERSION,
            ProtocolError::Uninitialized
        );
        invariant!(
            self.pool_info.params.starts_at > Clock::get()?.unix_timestamp,
            ProtocolError::StartTimeFreezed
        );

        Ok(())
    }
}

impl<'info> ModifyParams<'info> {
    pub fn process(&mut self, params: PoolParams) -> Result<()> {
        invariant!(
            params.starts_at > Clock::get()?.unix_timestamp,
            ProtocolError::InvalidParams
        );

        self.pool_info.params = params;

        Ok(())
    }
}
