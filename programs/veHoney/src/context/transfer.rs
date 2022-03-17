use crate::error::*;
use crate::state::*;
use anchor_lang::prelude::*;
use vipers::*;

#[derive(Accounts)]
pub struct TransferEscrow<'info> {
    /// [Locker].
    pub locker: Box<Account<'info, Locker>>,
    /// [Escrow] of the sender.
    #[account(mut)]
    pub source_escrow: Box<Account<'info, Escrow>>,
    /// Authority of [Escrow] of the sender.
    pub source_escrow_owner: Signer<'info>,
    /// [Escrow] of the receiver to be created.
    #[account(mut)]
    pub destination_escrow: Box<Account<'info, Escrow>>,
}

impl<'info> TransferEscrow<'info> {
    pub fn process(&mut self, amount: u64) -> Result<()> {
        invariant!(
            self.source_escrow.amount > amount,
            ProtocolError::EscrowNoBalance
        );

        let source_escrow = &mut self.source_escrow;
        let destination_escrow = &mut self.destination_escrow;

        destination_escrow.update_transfer_event(source_escrow, amount)?;

        emit!(TransferEvent {
            locker: self.locker.key(),
            source_escrow: source_escrow.key(),
            source_escrow_owner: source_escrow.owner,
            source_balance: source_escrow.amount,
            destination_escrow: destination_escrow.key(),
            destination_escrow_owner: destination_escrow.owner,
            destination_balance: destination_escrow.amount,
            amount,
            timestamp: Clock::get()?.unix_timestamp
        });

        Ok(())
    }
}

impl<'info> Validate<'info> for TransferEscrow<'info> {
    fn validate(&self) -> Result<()> {
        assert_keys_eq!(self.source_escrow.locker, self.locker);
        assert_keys_eq!(self.destination_escrow.locker, self.locker);
        assert_keys_eq!(self.source_escrow.owner, self.source_escrow_owner);
        let now = Clock::get()?.unix_timestamp;
        invariant!(
            self.source_escrow.escrow_ends_at > now,
            ProtocolError::EscrowExpired
        );
        invariant!(
            self.destination_escrow.amount == 0,
            ProtocolError::EscrowInUse
        );

        Ok(())
    }
}

#[event]
/// Event called in [ve_honey::transfer].
pub struct TransferEvent {
    /// [Locker] the transaction is processed through.
    #[index]
    pub locker: Pubkey,
    /// [Escrow] of the sender.
    #[index]
    pub source_escrow: Pubkey,
    /// Owner of the sender's [Escrow].
    pub source_escrow_owner: Pubkey,
    /// Balance of sender's [Escrow] after transaction.
    pub source_balance: u64,
    /// [Escrow] of the receiver.
    #[index]
    pub destination_escrow: Pubkey,
    /// Owner of the receiver's [Escrow].
    pub destination_escrow_owner: Pubkey,
    /// Balance of receiver's [Escrow] after transaction.
    pub destination_balance: u64,
    /// Amount transferred.
    pub amount: u64,
    /// Timestamp
    pub timestamp: i64,
}
