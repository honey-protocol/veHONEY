use crate::*;

#[error_code]
pub enum ProtocolError {
    #[msg("Invalid params")]
    InvalidParams = 6000,
    #[msg("Started time can't be modified")]
    StartTimeFreezed = 6001,
    #[msg("Insufficient funds")]
    InsufficientFunds = 6002,
    #[msg("Not claimable")]
    NotClaimable = 6003,
    #[msg("Math overflow")]
    MathOverflow = 6004,
    #[msg("Pool is not initialized")]
    Uninitialized = 6005,
}
