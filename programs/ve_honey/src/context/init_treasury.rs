use crate::constants::*;
use crate::error::*;
use crate::state::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};
use vipers::*;

#[derive(Accounts)]
pub struct InitTreasury<'info> {
    /// payer of the initialization
    #[account(mut)]
    pub payer: Signer<'info>,
    /// the [Locker].
    pub locker: Box<Account<'info, Locker>>,
    /// the treasury token account to be initialized.
    #[account(
        init,
        token::mint = token_mint,
        token::authority = locker,
        seeds = [
            TREASURY_SEED.as_bytes(),
            locker.key().as_ref(),
            token_mint.key().as_ref(),
        ],
        bump,
        payer = payer,
    )]
    pub treasury: Box<Account<'info, TokenAccount>>,
    /// Mint of the token that can be used to join the [Locker].
    pub token_mint: Box<Account<'info, Mint>>,

    /// System program.
    pub system_program: Program<'info, System>,
    /// Token program.
    pub token_program: Program<'info, Token>,
    /// Rent sysvar
    pub rent: Sysvar<'info, Rent>,
}

impl<'info> InitTreasury<'info> {
    pub fn process(&self) -> Result<()> {
        Ok(())
    }
}

impl<'info> Validate<'info> for InitTreasury<'info> {
    fn validate(&self) -> Result<()> {
        assert_keys_eq!(
            self.locker.token_mint,
            self.token_mint,
            ProtocolError::InvalidLockerMint
        );

        Ok(())
    }
}
