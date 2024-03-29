use crate::*;
use anchor_spl::token::{Mint, Token, TokenAccount};
use govern::Governor;

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
    /// The [Governor].
    pub governor: Box<Account<'info, Governor>>,
    /// The smart wallet on the [Governor].
    pub smart_wallet: Signer<'info>,

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
        assert_keys_eq!(
            self.locker.governor,
            self.governor,
            ProtocolError::GovernorMismatch
        );
        assert_keys_eq!(
            self.governor.smart_wallet,
            self.smart_wallet,
            ProtocolError::SmartWalletMismatch
        );

        Ok(())
    }
}
