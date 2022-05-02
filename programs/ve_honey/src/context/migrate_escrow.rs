use crate::constants::*;
use crate::escrow_seeds;
use crate::state::*;
use anchor_lang::prelude::*;
use anchor_spl::associated_token;
use anchor_spl::token::{self, Token, TokenAccount};
use vipers::*;

#[derive(Accounts)]
pub struct MigrateEscrow<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub locker_admin: Signer<'info>,

    pub old_locker: Box<Account<'info, Locker>>,
    pub new_locker: Box<Account<'info, LockerV2>>,

    #[account(
        mut,
        seeds = [
            ESCROW_SEED.as_bytes(),
            old_locker.key().as_ref(),
            escrow_owner.key().as_ref()
        ],
        bump = old_escrow.bump,
        close = payer
    )]
    pub old_escrow: Box<Account<'info, Escrow>>,
    #[account(
        init,
        seeds = [
            ESCROW_SEED.as_bytes(),
            new_locker.key().as_ref(),
            escrow_owner.key().as_ref()
        ],
        bump,
        space = 8 + EscrowV2::LEN,
        payer = payer
    )]
    pub new_escrow: Box<Account<'info, EscrowV2>>,

    #[account(mut)]
    pub old_locked_tokens: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub new_locked_tokens: Box<Account<'info, TokenAccount>>,

    /// CHECK: escrow owner pubkey.
    pub escrow_owner: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

impl<'info> MigrateEscrow<'info> {
    pub fn process(&mut self, bump: u8) -> Result<()> {
        let old_escrow = &self.old_escrow;
        let new_escrow = &mut self.new_escrow;

        new_escrow.locker = self.new_locker.key();
        new_escrow.owner = old_escrow.owner;
        new_escrow.bump = bump;

        new_escrow.tokens = associated_token::get_associated_token_address(
            &new_escrow.key(),
            &self.new_locker.token_mint,
        );

        assert_keys_eq!(new_escrow.tokens, self.new_locked_tokens);

        if old_escrow.amount > 0 {
            let seeds: &[&[&[u8]]] = escrow_seeds!(self.old_escrow);

            token::transfer(
                CpiContext::new(
                    self.token_program.to_account_info(),
                    token::Transfer {
                        from: self.old_locked_tokens.to_account_info(),
                        to: self.new_locked_tokens.to_account_info(),
                        authority: self.old_escrow.to_account_info(),
                    },
                )
                .with_signer(seeds),
                old_escrow.amount,
            )?;

            token::close_account(
                CpiContext::new(
                    self.token_program.to_account_info(),
                    token::CloseAccount {
                        account: self.old_locked_tokens.to_account_info(),
                        destination: self.payer.to_account_info(),
                        authority: self.old_escrow.to_account_info(),
                    },
                )
                .with_signer(seeds),
            )?;
        }

        new_escrow.amount = old_escrow.amount;
        new_escrow.escrow_started_at = old_escrow.escrow_started_at;
        new_escrow.escrow_ends_at = old_escrow.escrow_ends_at;
        new_escrow.vote_delegate = self.escrow_owner.key();

        Ok(())
    }
}

impl<'info> Validate<'info> for MigrateEscrow<'info> {
    fn validate(&self) -> Result<()> {
        assert_keys_eq!(self.escrow_owner, self.old_escrow.owner);
        assert_keys_eq!(self.locker_admin, self.old_locker.admin);
        assert_keys_eq!(self.locker_admin, self.new_locker.governor);
        assert_keys_eq!(self.old_locked_tokens, self.old_escrow.tokens);

        Ok(())
    }
}
