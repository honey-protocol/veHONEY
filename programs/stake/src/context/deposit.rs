use crate::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount};

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(has_one = p_token_mint @ ProtocolError::InvalidMint)]
    pub pool_info: Box<Account<'info, PoolInfo>>,
    #[account(
        mut,
        has_one = pool_info @ ProtocolError::InvalidPool,
    )]
    pub user_info: Box<Account<'info, PoolUser>>,
    pub user_owner: Signer<'info>,
    #[account(mut)]
    pub p_token_mint: Box<Account<'info, Mint>>,
    #[account(mut)]
    pub source: Box<Account<'info, TokenAccount>>,
    pub user_authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

impl<'info> Validate<'info> for Deposit<'info> {
    fn validate(&self) -> Result<()> {
        invariant!(
            self.pool_info.version == STAKE_POOL_VERSION,
            ProtocolError::Uninitialized
        );
        assert_keys_eq!(
            self.user_info.owner,
            self.user_owner,
            ProtocolError::InvalidOwner
        );
        assert_keys_eq!(
            self.source.mint,
            self.p_token_mint,
            ProtocolError::InvalidMint
        );
        assert_keys_eq!(
            self.source.owner,
            self.user_authority,
            ProtocolError::InvalidOwner
        );

        Ok(())
    }
}

impl<'info> Deposit<'info> {
    pub fn process(&mut self, amount: u64) -> Result<()> {
        invariant!(
            self.source.amount >= amount,
            ProtocolError::InsufficientFunds
        );
        invariant!(amount > 0, ProtocolError::InvalidInputValue);

        self.user_info.deposit(amount)?;

        token::burn(
            CpiContext::new(
                self.token_program.to_account_info(),
                token::Burn {
                    from: self.source.to_account_info(),
                    mint: self.p_token_mint.to_account_info(),
                    authority: self.user_authority.to_account_info(),
                },
            ),
            amount,
        )?;

        Ok(())
    }
}
