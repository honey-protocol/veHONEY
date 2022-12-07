use crate::*;

#[error_code]
pub enum ProtocolError {
    Uninitialized = 100,
    InvalidParams = 101,
    StartTimeFreezed = 102,
    InvalidOwner = 103,
    InvalidMint = 104,
    InvalidPool = 105,

    InsufficientFunds = 200,
    NotClaimable = 201,
    VarientViolated = 202,
    InvalidInputValue = 203,

    MathOverflow = 300,
}
