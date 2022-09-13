use crate::*;
use anchor_spl::token::{self, Mint, Token};

#[derive(Accounts)]
pub struct ReclaimMintAuthority<'info> {
    pub owner: Signer<'info>,
    #[account(
        has_one = owner @ ProtocolError::InvalidOwner,
        has_one = token_mint @ ProtocolError::InvalidMint,
    )]
    pub pool_info: Box<Account<'info, PoolInfo>>,
    #[account(mut)]
    pub token_mint: Box<Account<'info, Mint>>,
    /// CHECK:
    #[account(
        seeds = [
            AUTHORITY_SEED.as_bytes(),
            pool_info.key().as_ref()
        ],
        bump = pool_info.bump
    )]
    pub authority: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
}

impl<'info> Validate<'info> for ReclaimMintAuthority<'info> {
    fn validate(&self) -> Result<()> {
        invariant!(
            self.pool_info.version == STAKE_POOL_VERSION,
            ProtocolError::Uninitialized
        );

        Ok(())
    }
}

impl<'info> ReclaimMintAuthority<'info> {
    pub fn process(&self, mint_authority: Pubkey) -> Result<()> {
        let seeds = authority_seeds!(pool_info = self.pool_info.key(), bump = self.pool_info.bump);

        token::set_authority(
            CpiContext::new(
                self.token_program.to_account_info(),
                token::SetAuthority {
                    current_authority: self.authority.to_account_info(),
                    account_or_mint: self.token_mint.to_account_info(),
                },
            )
            .with_signer(&[&seeds[..]]),
            token::spl_token::instruction::AuthorityType::MintTokens,
            Some(mint_authority),
        )?;

        Ok(())
    }
}
