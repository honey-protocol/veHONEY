use anchor_lang::prelude::*;

/// [ve_honey] errors.
#[error_code]
pub enum ProtocolError {
    #[msg("Escrow has not ended.")]
    EscrowNotEnded,
    #[msg("Invalid locker admin")]
    InvalidLockerAdmin,
}
