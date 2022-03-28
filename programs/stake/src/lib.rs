use anchor_lang::__private::CLOSED_ACCOUNT_DISCRIMINATOR;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount};
use num_traits::ToPrimitive;
use spl_token::instruction::AuthorityType;
use vipers::*;

use std::io::Write;

declare_id!("4V68qajTiVHm3Pm9fQoV8D4tEYBmq3a34R9NV5TymLr7");

pub mod constants {
    pub const POOL_INFO_SEED: &str = "PoolInfo";
    pub const POOL_USER_SEED: &str = "PoolUser";
    pub const TOKEN_VAULT_SEED: &str = "TokenVault";
    pub const AUTHORITY_SEED: &str = "VaultAuthority";
    pub const STAKE_POOL_VERSION: u8 = 1;
    pub const CLAIM_PERIOD_UNIT: i64 = 86_400;
    pub const CLAIM_MAX_COUNT: u8 = 21;
}

#[program]
pub mod stake {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, params: PoolParams) -> Result<()> {
        invariant!(
            params.starts_at > Clock::get()?.unix_timestamp,
            ErrorCode::InvalidParam
        );

        let pool_info = &mut ctx.accounts.pool_info;
        pool_info.version = constants::STAKE_POOL_VERSION;
        pool_info.owner = ctx.accounts.owner.key();
        pool_info.token_mint = ctx.accounts.token_mint.key();
        pool_info.p_token_mint = ctx.accounts.p_token_mint.key();
        pool_info.bump = unwrap_bump!(ctx, "authority");
        pool_info.params = params;

        Ok(())
    }

    #[access_control(assert_initialized(&ctx.accounts.pool_info))]
    pub fn modify_params(ctx: Context<ModifyParams>, params: PoolParams) -> Result<()> {
        let pool_info = &mut ctx.accounts.pool_info;
        let now = Clock::get()?.unix_timestamp;

        invariant!(params.starts_at > now, ErrorCode::InvalidParam);
        invariant!(
            pool_info.params.starts_at > now,
            ErrorCode::StartTimeFreezed
        );

        pool_info.params = params;

        Ok(())
    }

    #[access_control(assert_initialized(&ctx.accounts.pool_info))]
    pub fn set_mint_authority(ctx: Context<SetMintAuthority>) -> Result<()> {
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

    #[access_control(assert_initialized(&ctx.accounts.pool_info))]
    pub fn reclaim_mint_authority(
        ctx: Context<ReclaimMintAuthority>,
        mint_authority: Pubkey,
    ) -> Result<()> {
        let seeds = authority_seeds!(
            token_mint = ctx.accounts.token_mint.key(),
            bump = ctx.accounts.pool_info.bump
        );
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

    #[access_control(assert_initialized(&ctx.accounts.pool_info))]
    pub fn initialize_user(ctx: Context<InitializeUser>) -> Result<()> {
        let user_info = &mut ctx.accounts.user_info;
        user_info.pool_info = ctx.accounts.pool_info.key();
        user_info.owner = ctx.accounts.user_owner.key();
        user_info.deposit_amount = 0;
        user_info.claimed_amount = 0;
        user_info.deposited_at = 0;
        user_info.count = 0;

        Ok(())
    }

    #[access_control(assert_initialized(&ctx.accounts.pool_info))]
    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        invariant!(
            ctx.accounts.source.amount > amount,
            ErrorCode::InsufficientFunds
        );
        invariant!(amount > 0, ErrorCode::InvalidParam);

        ctx.accounts.user_info.deposit(amount)?;

        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::Burn {
                mint: ctx.accounts.p_token_mint.to_account_info(),
                to: ctx.accounts.source.to_account_info(),
                authority: ctx.accounts.user_authority.to_account_info(),
            },
        );
        token::burn(cpi_ctx, amount)?;

        Ok(())
    }

    #[access_control(assert_initialized(&ctx.accounts.pool_info) assert_claimable(ctx.accounts.pool_info.params))]
    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        let claimable_amount = ctx
            .accounts
            .user_info
            .claim(ctx.accounts.pool_info.params)?;

        let seeds = authority_seeds!(
            token_mint = ctx.accounts.token_mint.key(),
            bump = ctx.accounts.pool_info.bump
        );
        let signer: &[&[&[u8]]] = &[&seeds[..]];

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token::MintTo {
                mint: ctx.accounts.token_mint.to_account_info(),
                to: ctx.accounts.destination.to_account_info(),
                authority: ctx.accounts.authority.to_account_info(),
            },
            signer,
        );
        token::mint_to(cpi_ctx, claimable_amount)?;

        if ctx.accounts.user_info.count == ctx.accounts.pool_info.params.max_claim_count {
            close_account(
                &mut ctx.accounts.user_info.to_account_info(),
                &mut ctx.accounts.payer.to_account_info(),
            )?;
        }

        Ok(())
    }

    #[access_control(assert_claimable(ctx.accounts.pool_info.params))]
    pub fn stake<'info>(
        ctx: Context<'_, '_, '_, 'info, Stake<'info>>,
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

        let seeds = authority_seeds!(
            token_mint = ctx.accounts.token_mint.key(),
            bump = ctx.accounts.pool_info.bump
        );
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

        let amount_to_mint = unwrap_int!(amount.checked_mul(conversion_ratio(duration)?));

        token::mint_to(cpi_ctx, amount_to_mint)?;

        ctx.accounts.token_vault.reload()?;

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

        ve_honey::cpi::lock(cpi_ctx, amount_to_mint, duration)?;

        Ok(())
    }
}

pub fn conversion_ratio(duration: i64) -> Result<u64> {
    if duration >= 7_689_600 && duration <= 7_948_800 {
        return Ok(2);
    } else if duration >= 15_638_400 && duration <= 15_897_600 {
        return Ok(5);
    } else if duration >= 31_536_000 && duration <= 31_622_400 {
        return Ok(10);
    }

    // for tests
    // if duration == 1 {
    //     return Ok(2);
    // } else if duration == 3 {
    //     return Ok(5);
    // } else if duration == 12 {
    //     return Ok(10);
    // }

    return Err(ErrorCode::InvalidParam.into());
}

pub fn close_account(account: &mut AccountInfo, destination: &mut AccountInfo) -> Result<()> {
    let dest_starting_lamports = destination.lamports();

    **destination.lamports.borrow_mut() = dest_starting_lamports
        .checked_add(account.lamports())
        .ok_or(ErrorCode::MathOverflow)?;
    **account.lamports.borrow_mut() = 0;

    let mut data = account.data.borrow_mut();
    let dst: &mut [u8] = &mut data;
    let mut cursor = std::io::Cursor::new(dst);
    cursor
        .write_all(&CLOSED_ACCOUNT_DISCRIMINATOR)
        .map_err(|_| ErrorCode::AnchorSerializationError)?;

    Ok(())
}

fn assert_initialized(pool_info: &PoolInfo) -> Result<()> {
    invariant!(
        pool_info.version == constants::STAKE_POOL_VERSION,
        ErrorCode::Uninitialized
    );

    Ok(())
}

fn assert_claimable(pool_params: PoolParams) -> Result<()> {
    invariant!(
        pool_params.starts_at < Clock::get()?.unix_timestamp,
        NotClaimable
    );

    Ok(())
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

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid params")]
    InvalidParam,
    #[msg("Started time can't be modified")]
    StartTimeFreezed,
    #[msg("Insufficient funds")]
    InsufficientFunds,
    #[msg("Not claimable")]
    NotClaimable,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Pool is not initialized")]
    Uninitialized,
    #[msg("Anchor serialization error")]
    AnchorSerializationError,
}

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
            constants::POOL_INFO_SEED.as_bytes(),
            token_mint.key().as_ref(),
            p_token_mint.key().as_ref()
        ],
        bump,
        payer = payer
    )]
    pub pool_info: Box<Account<'info, PoolInfo>>,
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
    /// CHECK
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
pub struct ModifyParams<'info> {
    pub owner: Signer<'info>,
    #[account(
        mut,
        has_one = owner
    )]
    pub pool_info: Box<Account<'info, PoolInfo>>,
}

#[derive(Accounts)]
pub struct SetMintAuthority<'info> {
    pub owner: Signer<'info>,
    #[account(
        has_one = token_mint,
        has_one = owner
    )]
    pub pool_info: Box<Account<'info, PoolInfo>>,
    #[account(mut)]
    pub token_mint: Box<Account<'info, Mint>>,
    /// CHECK: authority to be set as mint authority.
    #[account(
        seeds = [
            constants::AUTHORITY_SEED.as_bytes(),
            token_mint.key().as_ref(),
        ],
        bump = pool_info.bump
    )]
    pub authority: UncheckedAccount<'info>,
    /// the previous mint authority of the token
    #[account(address = token_mint.mint_authority.unwrap())]
    pub origin_authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ReclaimMintAuthority<'info> {
    pub owner: Signer<'info>,
    #[account(
        has_one = token_mint,
        has_one = owner
    )]
    pub pool_info: Box<Account<'info, PoolInfo>>,
    #[account(mut)]
    pub token_mint: Box<Account<'info, Mint>>,
    /// CHECK:
    #[account(
        seeds = [
            constants::AUTHORITY_SEED.as_bytes(),
            token_mint.key().as_ref()
        ],
        bump = pool_info.bump
    )]
    pub authority: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct InitializeUser<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub pool_info: Box<Account<'info, PoolInfo>>,
    #[account(
        init,
        seeds = [
            constants::POOL_USER_SEED.as_bytes(),
            pool_info.key().as_ref(),
            user_owner.key().as_ref()
        ],
        bump,
        payer = payer
    )]
    pub user_info: Box<Account<'info, PoolUser>>,
    pub user_owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(
        has_one = p_token_mint
    )]
    pub pool_info: Box<Account<'info, PoolInfo>>,
    #[account(
        mut,
        has_one = pool_info,
        constraint = user_info.owner == user_owner.key()
    )]
    pub user_info: Box<Account<'info, PoolUser>>,
    pub user_owner: Signer<'info>,
    #[account(mut)]
    pub p_token_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        constraint = source.mint == p_token_mint.key(),
        constraint = source.owner == user_authority.key()
    )]
    pub source: Box<Account<'info, TokenAccount>>,
    pub user_authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        has_one = token_mint
    )]
    pub pool_info: Box<Account<'info, PoolInfo>>,
    /// CHECK:
    #[account(
        seeds = [
            constants::AUTHORITY_SEED.as_bytes(),
            token_mint.key().as_ref()
        ],
        bump = pool_info.bump
    )]
    pub authority: UncheckedAccount<'info>,
    #[account(mut)]
    pub token_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        has_one = pool_info,
        constraint = user_info.owner == user_owner.key(),
    )]
    pub user_info: Box<Account<'info, PoolUser>>,
    pub user_owner: Signer<'info>,
    #[account(
        mut,
        constraint = destination.mint == token_mint.key()
    )]
    pub destination: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Stake<'info> {
    #[account(
        has_one = token_mint,
        has_one = p_token_mint,
    )]
    pub pool_info: Box<Account<'info, PoolInfo>>,
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

/// PoolInfo required for pool#1.
#[account]
#[derive(Default)]
pub struct PoolInfo {
    pub version: u8,
    pub p_token_mint: Pubkey,
    pub token_mint: Pubkey,
    pub owner: Pubkey,
    pub bump: u8,
    pub params: PoolParams,
}

#[derive(Default, Clone, Copy, AnchorDeserialize, AnchorSerialize)]
pub struct PoolParams {
    pub starts_at: i64,
    pub claim_period_unit: i64,
    pub max_claim_count: u8,
}

impl PoolParams {
    pub fn get_claim_period(&self) -> Result<i64> {
        let max_claim_count = unwrap_int!(self.max_claim_count.to_i64());
        let claim_period = unwrap_int!(self.claim_period_unit.checked_mul(max_claim_count));
        Ok(claim_period)
    }
}

/// User's info deposited to pool#1.
#[account]
#[derive(Default)]
pub struct PoolUser {
    pub pool_info: Pubkey,
    pub owner: Pubkey,
    pub deposit_amount: u64,
    pub claimed_amount: u64,
    pub deposited_at: i64,
    pub count: u8,
}

impl PoolUser {
    pub fn deposit(&mut self, amount: u64) -> Result<()> {
        let remaining_amount = unwrap_int!(self.deposit_amount.checked_sub(self.claimed_amount));
        self.deposit_amount = unwrap_int!(remaining_amount.checked_add(amount));
        self.claimed_amount = 0;

        let now = Clock::get()?.unix_timestamp;

        self.deposited_at = now;
        self.count = 0;

        Ok(())
    }

    pub fn claim(&mut self, pool_params: PoolParams) -> Result<u64> {
        let (claimable_amount, count) = self.get_claimable_amount(pool_params)?;

        if count == pool_params.max_claim_count {
            self.claimed_amount = self.deposit_amount;
        } else {
            self.claimed_amount = unwrap_int!(self.claimed_amount.checked_add(claimable_amount));
        }

        self.count = count;

        Ok(claimable_amount)
    }

    pub fn get_claimable_amount(&self, pool_params: PoolParams) -> Result<(u64, u8)> {
        let now = Clock::get()?.unix_timestamp;
        let claim_starts_at = if self.deposited_at > pool_params.starts_at {
            self.deposited_at
        } else {
            pool_params.starts_at
        };
        let duration = unwrap_int!(now.checked_sub(claim_starts_at));

        if duration > pool_params.get_claim_period()? {
            // rest amount is claimable
            return Ok((
                unwrap_int!(self.deposit_amount.checked_sub(self.claimed_amount)),
                pool_params.max_claim_count,
            ));
        } else {
            let count = unwrap_opt!((duration / pool_params.claim_period_unit).to_u8());
            invariant!(count > self.count, ErrorCode::NotClaimable);
            let delta = count - self.count;
            let delta = unwrap_opt!((self.deposit_amount as u128).checked_mul(delta as u128));
            let delta = unwrap_opt!(delta.checked_div(pool_params.max_claim_count as u128));

            return Ok((unwrap_int!(delta.to_u64()), count));
        }
    }
}
