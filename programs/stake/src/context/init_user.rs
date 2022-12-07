use crate::*;

#[derive(Accounts)]
pub struct InitializeUser<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub pool_info: Box<Account<'info, PoolInfo>>,
    #[account(
        init,
        seeds = [
            POOL_USER_SEED.as_bytes(),
            pool_info.key().as_ref(),
            user_owner.key().as_ref()
        ],
        bump,
        space = 8 + PoolUser::LEN,
        payer = payer
    )]
    pub user_info: Box<Account<'info, PoolUser>>,
    pub user_owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

impl<'info> Validate<'info> for InitializeUser<'info> {
    fn validate(&self) -> Result<()> {
        invariant!(
            self.pool_info.version == STAKE_POOL_VERSION,
            ProtocolError::Uninitialized
        );

        Ok(())
    }
}

impl<'info> InitializeUser<'info> {
    pub fn process(&mut self) -> Result<()> {
        let user_info = &mut self.user_info;
        user_info.pool_info = self.pool_info.key();
        user_info.owner = self.user_owner.key();
        user_info.deposit_amount = 0;
        user_info.claimed_amount = 0;
        user_info.deposited_at = 0;
        user_info.count = 0;

        Ok(())
    }
}
