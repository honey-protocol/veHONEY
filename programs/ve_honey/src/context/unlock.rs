use crate::*;
use anchor_spl::token::{self, Token, TokenAccount};

#[derive(Accounts)]
pub struct Unlock<'info> {
    /// Payer.
    #[account(mut)]
    pub payer: Signer<'info>,
    /// [Locker].
    #[account(mut)]
    pub locker: Box<Account<'info, Locker>>,
    /// [Escrow] that is being exited.
    #[account(mut)]
    pub escrow: Box<Account<'info, Escrow>>,
    /// Authority of the [Escrow].
    pub escrow_owner: Signer<'info>,
    /// Tokens locked up in the [Locker].
    #[account(mut)]
    pub locked_tokens: Box<Account<'info, TokenAccount>>,
    /// Destination for the tokens to unlock.
    #[account(mut)]
    pub destination_tokens: Box<Account<'info, TokenAccount>>,

    /// Token program.
    pub token_program: Program<'info, Token>,
}

impl<'info> Unlock<'info> {
    pub fn process(&mut self) -> Result<()> {
        let unlock_amount = self.escrow.unlock_amount()?;

        invariant!(unlock_amount > 0, ProtocolError::EscrowNoBalance);

        let seeds: &[&[&[u8]]] = escrow_seeds!(self.escrow);

        token::transfer(
            CpiContext::new(
                self.token_program.to_account_info(),
                token::Transfer {
                    from: self.locked_tokens.to_account_info(),
                    to: self.destination_tokens.to_account_info(),
                    authority: self.escrow.to_account_info(),
                },
            )
            .with_signer(seeds),
            unlock_amount,
        )?;

        let escrow = &mut self.escrow;
        let locker = &mut self.locker;
        escrow.amount = unwrap_int!(escrow.amount.checked_sub(unlock_amount));
        locker.locked_supply = unwrap_int!(locker.locked_supply.checked_sub(unlock_amount));

        emit!(ExitEscrowEvent {
            escrow_owner: self.escrow.owner,
            locker: locker.key(),
            locked_supply: locker.locked_supply,
            timestamp: Clock::get()?.unix_timestamp,
            released_amount: self.escrow.amount
        });

        Ok(())
    }
}

impl<'info> Validate<'info> for Unlock<'info> {
    fn validate(&self) -> Result<()> {
        assert_keys_eq!(
            self.locker,
            self.escrow.locker,
            ProtocolError::InvalidLocker
        );
        assert_keys_eq!(
            self.escrow_owner,
            self.escrow.owner,
            ProtocolError::InvalidAccountOwner
        );
        assert_keys_eq!(
            self.locked_tokens,
            self.escrow.tokens,
            ProtocolError::InvalidToken
        );
        assert_keys_neq!(
            self.locked_tokens,
            self.destination_tokens,
            ProtocolError::InvalidToken
        );
        let now = Clock::get()?.unix_timestamp;
        msg!(
            "now: {}; escrow_ends_at: {}",
            now,
            self.escrow.escrow_ends_at
        );
        invariant!(
            self.escrow.escrow_ends_at < now,
            ProtocolError::EscrowNotEnded
        );

        Ok(())
    }
}

#[event]
/// Event called in [ve_honey::exit].
pub struct ExitEscrowEvent {
    /// The owner of the [Escrow].
    #[index]
    pub escrow_owner: Pubkey,
    /// [Locker] of the [Escrow].
    #[index]
    pub locker: Pubkey,
    /// Timestamp
    pub timestamp: i64,
    /// The amount of tokens locked inside the [Locker].
    pub locked_supply: u64,
    /// The amount released from the [Escrow].
    pub released_amount: u64,
}
