use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount};
use spl_token::instruction::AuthorityType;

declare_id!("4V68qajTiVHm3Pm9fQoV8D4tEYBmq3a34R9NV5TymLr7");

pub mod constants {
    pub const TOKEN_VAULT_SEED: &str = "TokenVault";
    pub const AUTHORITY_SEED: &str = "VaultAuthority";
}

#[program]
pub mod stake {
    use super::*;

    pub fn initialize(_ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }

    pub fn set_mint_authority(ctx: Context<SetMintAuthority>, _bump: u8) -> Result<()> {
        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::SetAuthority {
                current_authority: ctx.accounts.origin_authority.to_account_info(),
                account_or_mint: ctx.accounts.token_mint.to_account_info(),
            },
        );
        token::set_authority(
            cpi_ctx,
            AuthorityType::MintTokens,
            Some(ctx.accounts.authority.key()),
        )?;

        Ok(())
    }

    pub fn reclaim_mint_authority(
        ctx: Context<ReclaimMintAuthority>,
        bump: u8,
        mint_authority: Pubkey,
    ) -> Result<()> {
        let seeds = authority_seeds!(token_mint = ctx.accounts.token_mint.key(), bump = bump);
        let signer: &[&[&[u8]]] = &[&seeds[..]];

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token::SetAuthority {
                current_authority: ctx.accounts.authority.to_account_info(),
                account_or_mint: ctx.accounts.token_mint.to_account_info(),
            },
            signer,
        );
        token::set_authority(cpi_ctx, AuthorityType::MintTokens, Some(mint_authority))?;

        Ok(())
    }

    pub fn stake<'info>(
        ctx: Context<'_, '_, '_, 'info, Stake<'info>>,
        bump: u8,
        amount: u64,
        duration: i64,
    ) -> Result<()> {
        assert!(amount != 0);

        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::Burn {
                mint: ctx.accounts.p_token_mint.to_account_info(),
                to: ctx.accounts.p_token_from.to_account_info(),
                authority: ctx.accounts.user_authority.to_account_info(),
            },
        );

        token::burn(cpi_ctx, amount)?;

        let seeds = authority_seeds!(token_mint = ctx.accounts.token_mint.key(), bump = bump);
        let signer: &[&[&[u8]]] = &[&seeds[..]];

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token::MintTo {
                mint: ctx.accounts.token_mint.to_account_info(),
                to: ctx.accounts.token_vault.to_account_info(),
                authority: ctx.accounts.authority.to_account_info(),
            },
            signer,
        );

        token::mint_to(cpi_ctx, amount)?;

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.locker_program.to_account_info(),
            ve_honey::cpi::accounts::Lock {
                locker: ctx.accounts.locker.to_account_info(),
                escrow: ctx.accounts.escrow.to_account_info(),
                locked_tokens: ctx.accounts.locked_tokens.to_account_info(),
                escrow_owner: ctx.accounts.user_authority.to_account_info(),
                source_tokens: ctx.accounts.token_vault.to_account_info(),
                source_tokens_authority: ctx.accounts.authority.to_account_info(),
                token_program: ctx.accounts.token_program.to_account_info(),
            },
            signer,
        )
        .with_remaining_accounts(ctx.remaining_accounts.to_vec());

        ve_honey::cpi::lock(cpi_ctx, amount, duration)?;

        Ok(())
    }
}

#[macro_export]
macro_rules! token_vault_seeds {
    (
        token_mint = $token_mint:expr,
        p_token_mint = $p_token_mint:expr,
        bump = $bump:expr
    ) => {
        &[
            constants::TOKEN_VAULT_SEED.as_bytes(),
            &$token_mint.to_bytes()[..],
            &$p_token_mint.to_bytes()[..],
            &[$bump],
        ]
    };
}

#[macro_export]
macro_rules! authority_seeds {
    (
        token_mint = $token_mint:expr,
        bump = $bump:expr
    ) => {
        &[
            constants::AUTHORITY_SEED.as_bytes(),
            &$token_mint.to_bytes()[..],
            &[$bump],
        ]
    };
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub token_mint: Box<Account<'info, Mint>>,
    pub p_token_mint: Box<Account<'info, Mint>>,
    #[account(
        init,
        token::mint = token_mint,
        token::authority = authority,
        seeds = [
            constants::TOKEN_VAULT_SEED.as_bytes(),
            token_mint.key().as_ref(),
            p_token_mint.key().as_ref()
        ],
        bump,
        payer = payer
    )]
    pub token_vault: Box<Account<'info, TokenAccount>>,
    /// CHECK: authortiy of the vault.
    #[account(
        seeds = [
            constants::AUTHORITY_SEED.as_bytes(),
            token_mint.key().as_ref(),
        ],
        bump
    )]
    pub authority: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(bump: u8)]
pub struct SetMintAuthority<'info> {
    #[account(mut)]
    pub token_mint: Box<Account<'info, Mint>>,
    pub p_token_mint: Box<Account<'info, Mint>>,
    #[account(
        seeds = [
            constants::TOKEN_VAULT_SEED.as_bytes(),
            token_mint.key().as_ref(),
            p_token_mint.key().as_ref()
        ],
        bump,
        constraint = token_vault.owner == authority.key()
    )]
    pub token_vault: Box<Account<'info, TokenAccount>>,
    /// CHECK: authority to be set as mint authority.
    #[account(
        seeds = [
            constants::AUTHORITY_SEED.as_bytes(),
            token_mint.key().as_ref(),
        ],
        bump = bump
    )]
    pub authority: UncheckedAccount<'info>,
    /// the previous mint authoirity of the token
    #[account(address = token_mint.mint_authority.unwrap())]
    pub origin_authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(bump: u8)]
pub struct ReclaimMintAuthority<'info> {
    #[account(mut)]
    pub token_mint: Box<Account<'info, Mint>>,
    pub p_token_mint: Box<Account<'info, Mint>>,
    #[account(
        seeds = [
            constants::TOKEN_VAULT_SEED.as_bytes(),
            token_mint.key().as_ref(),
            p_token_mint.key().as_ref()
        ],
        bump,
        constraint = token_vault.owner == authority.key()
    )]
    pub token_vault: Box<Account<'info, TokenAccount>>,
    /// CHECK:
    #[account(
        seeds = [
            constants::AUTHORITY_SEED.as_bytes(),
            token_mint.key().as_ref()
        ],
        bump = bump
    )]
    pub authority: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(bump: u8)]
pub struct Stake<'info> {
    #[account(mut)]
    pub token_mint: Box<Account<'info, Mint>>,
    #[account(mut)]
    pub p_token_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        constraint = p_token_from.mint == p_token_mint.key()
    )]
    pub p_token_from: Box<Account<'info, TokenAccount>>,
    pub user_authority: Signer<'info>,

    #[account(
        mut,
        seeds = [
            constants::TOKEN_VAULT_SEED.as_bytes(),
            token_mint.key().as_ref(),
            p_token_mint.key().as_ref()
        ],
        bump,
        constraint = token_vault.owner == authority.key()
    )]
    pub token_vault: Box<Account<'info, TokenAccount>>,
    /// CHECK:
    #[account(
        seeds = [
            constants::AUTHORITY_SEED.as_bytes(),
            token_mint.key().as_ref()
        ],
        bump = bump
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
