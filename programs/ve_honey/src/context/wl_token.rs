use crate::*;
use anchor_spl::token::{self, Mint, Token};
use govern::Governor;

#[derive(Accounts)]
pub struct SetWLMintAuthority<'info> {
    /// The [Locker].
    pub locker: Box<Account<'info, Locker>>,
    /// WL token mint
    #[account(mut)]
    pub wl_token_mint: Box<Account<'info, Mint>>,
    /// mint authority of WL token
    pub current_authority: Signer<'info>,

    /// Token program
    pub token_program: Program<'info, Token>,
}

impl<'info> SetWLMintAuthority<'info> {
    pub fn process(&self) -> Result<()> {
        token::set_authority(
            CpiContext::new(
                self.token_program.to_account_info(),
                token::SetAuthority {
                    account_or_mint: self.wl_token_mint.to_account_info(),
                    current_authority: self.current_authority.to_account_info(),
                },
            ),
            token::spl_token::instruction::AuthorityType::MintTokens,
            Some(self.locker.key()),
        )?;

        Ok(())
    }
}

impl<'info> Validate<'info> for SetWLMintAuthority<'info> {
    fn validate(&self) -> Result<()> {
        assert_keys_eq!(
            self.wl_token_mint,
            self.locker.wl_token_mint,
            ProtocolError::InvalidLockerWLMint
        );

        Ok(())
    }
}

#[derive(Accounts)]
pub struct ReclaimWLMintAuthority<'info> {
    /// The [Locker].
    pub locker: Box<Account<'info, Locker>>,
    /// WL token mint
    #[account(mut)]
    pub wl_token_mint: Box<Account<'info, Mint>>,
    /// [Governor] associated with [Locker].
    pub governor: Box<Account<'info, Governor>>,
    /// The smart wallet on the [Governor].
    pub smart_wallet: Signer<'info>,

    /// Token program.
    pub token_program: Program<'info, Token>,
}

impl<'info> ReclaimWLMintAuthority<'info> {
    pub fn process(&self, mint_authority: Pubkey) -> Result<()> {
        let seeds: &[&[&[u8]]] = locker_seeds!(self.locker);

        token::set_authority(
            CpiContext::new(
                self.token_program.to_account_info(),
                token::SetAuthority {
                    account_or_mint: self.wl_token_mint.to_account_info(),
                    current_authority: self.locker.to_account_info(),
                },
            )
            .with_signer(seeds),
            token::spl_token::instruction::AuthorityType::MintTokens,
            Some(mint_authority),
        )?;

        Ok(())
    }
}

impl<'info> Validate<'info> for ReclaimWLMintAuthority<'info> {
    fn validate(&self) -> Result<()> {
        assert_keys_eq!(
            self.wl_token_mint,
            self.locker.wl_token_mint,
            ProtocolError::InvalidLockerWLMint
        );
        assert_keys_eq!(
            self.governor,
            self.locker.governor,
            ProtocolError::GovernorMismatch
        );
        assert_keys_eq!(
            self.smart_wallet,
            self.governor.smart_wallet,
            ProtocolError::SmartWalletMismatch
        );

        Ok(())
    }
}
