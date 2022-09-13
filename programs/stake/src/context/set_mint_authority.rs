use crate::*;
use anchor_spl::token::{self, Mint, SetAuthority, Token};

#[derive(Accounts)]
pub struct SetMintAuthority<'info> {
    pub owner: Signer<'info>,
    #[account(
        has_one = token_mint @ ProtocolError::InvalidMint,
        has_one = owner @ ProtocolError::InvalidOwner,
    )]
    pub pool_info: Box<Account<'info, PoolInfo>>,
    #[account(mut)]
    pub token_mint: Box<Account<'info, Mint>>,
    /// CHECK: authority to be set as mint authority.
    #[account(
        seeds = [
            AUTHORITY_SEED.as_bytes(),
            pool_info.key().as_ref(),
        ],
        bump = pool_info.bump
    )]
    pub authority: UncheckedAccount<'info>,
    /// the previous mint authority of the token
    pub origin_authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

impl<'info> Validate<'info> for SetMintAuthority<'info> {
    fn validate(&self) -> Result<()> {
        invariant!(
            self.pool_info.version == STAKE_POOL_VERSION,
            ProtocolError::Uninitialized
        );
        assert_keys_eq!(
            self.token_mint.mint_authority.unwrap(),
            self.origin_authority,
            ProtocolError::VarientViolated
        );

        Ok(())
    }
}

impl<'info> SetMintAuthority<'info> {
    pub fn process(&mut self) -> Result<()> {
        token::set_authority(
            CpiContext::new(
                self.token_program.to_account_info(),
                SetAuthority {
                    current_authority: self.origin_authority.to_account_info(),
                    account_or_mint: self.token_mint.to_account_info(),
                },
            ),
            token::spl_token::instruction::AuthorityType::MintTokens,
            Some(self.authority.key()),
        )?;

        Ok(())
    }
}
