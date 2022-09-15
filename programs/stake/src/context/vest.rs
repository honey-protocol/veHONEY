use crate::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount};

#[derive(Accounts)]
pub struct Vest<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        has_one = token_mint @ ProtocolError::InvalidMint,
        has_one = p_token_mint @ ProtocolError::InvalidMint,
    )]
    pub pool_info: Box<Account<'info, PoolInfo>>,
    #[account(mut)]
    pub token_mint: Box<Account<'info, Mint>>,
    #[account(mut)]
    pub p_token_mint: Box<Account<'info, Mint>>,
    #[account(mut)]
    pub p_token_from: Box<Account<'info, TokenAccount>>,
    pub user_authority: Signer<'info>,
    #[account(
        mut,
        seeds = [
            TOKEN_VAULT_SEED.as_bytes(),
            token_mint.key().as_ref(),
            p_token_mint.key().as_ref()
        ],
        bump,
    )]
    pub token_vault: Box<Account<'info, TokenAccount>>,
    /// CHECK:
    #[account(
        seeds = [
            AUTHORITY_SEED.as_bytes(),
            pool_info.key().as_ref()
        ],
        bump = pool_info.bump
    )]
    pub authority: UncheckedAccount<'info>,

    /// CHECK: veHoney locker
    #[account(mut)]
    pub locker: UncheckedAccount<'info>,
    /// CHECK: veHoney escrow that belongs to user wallets.
    #[account(mut)]
    pub escrow: UncheckedAccount<'info>,
    /// CHECK: locked tokens of the escrow.
    #[account(mut)]
    pub locked_tokens: UncheckedAccount<'info>,
    /// CHECK: locker program.
    pub locker_program: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
}

impl<'info> Validate<'info> for Vest<'info> {
    fn validate(&self) -> Result<()> {
        invariant!(
            self.pool_info.version == STAKE_POOL_VERSION,
            ProtocolError::Uninitialized
        );
        invariant!(
            self.pool_info.params.starts_at < Clock::get()?.unix_timestamp,
            ProtocolError::NotClaimable
        );
        assert_keys_eq!(
            self.p_token_from.mint,
            self.p_token_mint,
            ProtocolError::InvalidMint
        );
        assert_keys_eq!(
            self.p_token_from.owner,
            self.user_authority,
            ProtocolError::InvalidOwner
        );
        assert_keys_eq!(
            self.token_vault.owner,
            self.authority,
            ProtocolError::InvalidOwner
        );

        Ok(())
    }
}

impl<'info> Vest<'info> {
    pub fn process(&mut self, amount: u64, duration: i64) -> Result<()> {
        invariant!(
            self.p_token_from.amount >= amount,
            ProtocolError::InsufficientFunds
        );
        invariant!(amount > 0, ProtocolError::InvalidParams);

        token::burn(
            CpiContext::new(
                self.token_program.to_account_info(),
                token::Burn {
                    from: self.p_token_from.to_account_info(),
                    mint: self.p_token_mint.to_account_info(),
                    authority: self.user_authority.to_account_info(),
                },
            ),
            amount,
        )?;

        let seeds = authority_seeds!(pool_info = self.pool_info.key(), bump = self.pool_info.bump);
        let amount_to_mint = unwrap_int!(amount.checked_mul(conversion_ratio(duration)?));

        token::mint_to(
            CpiContext::new(
                self.token_program.to_account_info(),
                token::MintTo {
                    to: self.token_vault.to_account_info(),
                    mint: self.token_mint.to_account_info(),
                    authority: self.authority.to_account_info(),
                },
            )
            .with_signer(&[&seeds[..]]),
            amount_to_mint,
        )?;

        self.token_vault.reload()?;

        ve_honey::cpi::lock(
            CpiContext::new(
                self.locker_program.to_account_info(),
                ve_honey::cpi::accounts::Lock {
                    locker: self.locker.to_account_info(),
                    escrow: self.escrow.to_account_info(),
                    locked_tokens: self.locked_tokens.to_account_info(),
                    escrow_owner: self.user_authority.to_account_info(),
                    source_tokens: self.token_vault.to_account_info(),
                    source_tokens_authority: self.authority.to_account_info(),
                    token_program: self.token_program.to_account_info(),
                },
            )
            .with_signer(&[&seeds[..]]),
            amount_to_mint,
            duration,
        )?;

        Ok(())
    }
}
