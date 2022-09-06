use crate::*;
use anchor_lang::AccountsClose;
use anchor_spl::token::{self, Mint, Token, TokenAccount};

#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(has_one = token_mint)]
    pub pool_info: Box<Account<'info, PoolInfo>>,
    /// CHECK:
    #[account(
        seeds = [
            AUTHORITY_SEED.as_bytes(),
            pool_info.key().as_ref()
        ],
        bump = pool_info.bump
    )]
    pub authority: UncheckedAccount<'info>,
    #[account(mut)]
    pub token_mint: Box<Account<'info, Mint>>,
    #[account(mut, has_one = pool_info)]
    pub user_info: Box<Account<'info, PoolUser>>,
    pub user_owner: Signer<'info>,
    #[account(mut)]
    pub destination: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
}

impl<'info> Validate<'info> for Claim<'info> {
    fn validate(&self) -> Result<()> {
        invariant!(
            self.pool_info.version == STAKE_POOL_VERSION,
            ProtocolError::Uninitialized
        );
        invariant!(
            self.pool_info.params.starts_at < Clock::get()?.unix_timestamp,
            ProtocolError::NotClaimable
        );
        assert_keys_eq!(self.user_info.owner, self.user_owner);
        assert_keys_eq!(self.destination.mint, self.token_mint);

        Ok(())
    }
}

impl<'info> Claim<'info> {
    pub fn process(&mut self) -> Result<()> {
        let claimable_amount = self.user_info.claim(self.pool_info.params)?;
        let seeds = authority_seeds!(pool_info = self.pool_info.key(), bump = self.pool_info.bump);

        token::mint_to(
            CpiContext::new(
                self.token_program.to_account_info(),
                token::MintTo {
                    mint: self.token_mint.to_account_info(),
                    to: self.destination.to_account_info(),
                    authority: self.authority.to_account_info(),
                },
            )
            .with_signer(&[&seeds[..]]),
            claimable_amount,
        )?;

        if self.user_info.count == self.pool_info.params.max_claim_count {
            self.user_info.close(self.payer.to_account_info())?;
        }

        Ok(())
    }
}
