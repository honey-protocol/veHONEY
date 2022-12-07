use crate::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub owner: Signer<'info>,
    pub token_mint: Box<Account<'info, Mint>>,
    pub p_token_mint: Box<Account<'info, Mint>>,
    #[account(
        init,
        seeds = [
            POOL_INFO_SEED.as_bytes(),
            token_mint.key().as_ref(),
            p_token_mint.key().as_ref()
        ],
        bump,
        space = 8 + PoolInfo::LEN,
        payer = payer
    )]
    pub pool_info: Box<Account<'info, PoolInfo>>,
    #[account(
        init,
        token::mint = token_mint,
        token::authority = authority,
        seeds = [
            TOKEN_VAULT_SEED.as_bytes(),
            token_mint.key().as_ref(),
            p_token_mint.key().as_ref()
        ],
        bump,
        payer = payer
    )]
    pub token_vault: Box<Account<'info, TokenAccount>>,
    /// CHECK:
    #[account(
        seeds = [
            AUTHORITY_SEED.as_bytes(),
            pool_info.key().as_ref(),
        ],
        bump
    )]
    pub authority: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

impl<'info> Validate<'info> for Initialize<'info> {
    fn validate(&self) -> Result<()> {
        Ok(())
    }
}

impl<'info> Initialize<'info> {
    pub fn process(&mut self, params: PoolParams, bump: u8) -> Result<()> {
        invariant!(
            params.starts_at > Clock::get()?.unix_timestamp,
            ProtocolError::InvalidParams
        );

        let pool_info = &mut self.pool_info;
        pool_info.version = STAKE_POOL_VERSION;
        pool_info.owner = self.owner.key();
        pool_info.token_mint = self.token_mint.key();
        pool_info.p_token_mint = self.p_token_mint.key();
        pool_info.bump = bump;
        pool_info.params = params;

        Ok(())
    }
}
