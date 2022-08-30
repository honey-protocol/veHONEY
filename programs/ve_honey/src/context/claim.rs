use crate::constants::*;
use crate::error::*;
use crate::escrow_seeds;
use crate::state::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount};
use vipers::*;

/// Claim with [NftReceipt] account that locked NFT.
#[derive(Accounts)]
pub struct Claim<'info> {
    /// [Locker].
    #[account(mut)]
    pub locker: Box<Account<'info, Locker>>,
    /// [Escrow] that is being claimed
    #[account(mut)]
    pub escrow: Box<Account<'info, Escrow>>,
    /// authority of [Escrow].
    pub escrow_owner: Signer<'info>,
    /// tokens locked up in the [Locker].
    #[account(mut)]
    pub locked_tokens: Box<Account<'info, TokenAccount>>,
    /// destination for the tokens claimed
    #[account(mut)]
    pub destination_tokens: Box<Account<'info, TokenAccount>>,
    /// NFT receipt
    #[account(mut)]
    pub nft_receipt: Box<Account<'info, NftReceipt>>,

    /// token program
    pub token_program: Program<'info, Token>,
}

impl<'info> Claim<'info> {
    pub fn process(&mut self) -> Result<()> {
        let claimable_amount = self
            .nft_receipt
            .update_receipt(Clock::get()?.unix_timestamp)?;

        let escrow = &mut self.escrow;
        let locker = &mut self.locker;

        escrow.amount = unwrap_int!(escrow.amount.checked_sub(claimable_amount));
        locker.locked_supply = unwrap_int!(locker.locked_supply.checked_sub(claimable_amount));

        let seeds: &[&[&[u8]]] = escrow_seeds!(self.escrow);

        token::transfer(
            CpiContext::new(
                self.token_program.to_account_info(),
                token::Transfer {
                    from: self.locked_tokens.to_account_info(),
                    to: self.destination_tokens.to_account_info(),
                    authority: self.escrow.to_account_info(),
                },
            ),
            claimable_amount,
        )?;

        Ok(())
    }
}

impl<'info> Validate<'info> for Claim<'info> {
    fn validate(&self) -> Result<()> {
        assert_keys_eq!(
            self.locker,
            self.escrow.locker,
            ProtocolError::InvalidLocker
        );
        assert_keys_eq!(
            self.locker,
            self.nft_receipt.locker,
            ProtocolError::InvalidLocker
        );
        assert_keys_eq!(
            self.escrow.owner,
            self.escrow_owner,
            ProtocolError::InvalidAccountOwner
        );
        assert_keys_eq!(
            self.nft_receipt.owner,
            self.escrow_owner,
            ProtocolError::InvalidAccountOwner
        );
        assert_keys_eq!(self.escrow.tokens, self.locked_tokens);
        assert_keys_neq!(self.locked_tokens, self.destination_tokens);

        Ok(())
    }
}
