use crate::*;

/// [ve_honey] errors.
#[error_code]
pub enum ProtocolError {
    InvalidLocker = 1000,
    InvalidLockerMint,
    InvalidAccountOwner,
    InvalidTokenOwner,
    InvalidAssociatedTokenAccount,
    InvalidRemainingAccounts,
    InvalidProofType,
    InvalidProof,
    InvalidGovernorParams,

    EscrowNotEnded = 1100,
    EscrowExpired,
    EscrowInUse,
    EscrowNoBalance,
    LockupDurationTooShort,
    LockupDurationTooLong,
    RefreshCannotShorten,
    ReceiptNotEnded,

    MustProvideWhitelist = 1200,
    ProgramNotWhitelisted,
    EscrowOwnerNotWhitelisted,
    ProgramIdMustBeExecutable,
    NoProofProvided,

    GovernorMismatch = 1300,
    SmartWalletMismatch,
    ProposalMustBeActive,
    InsufficientVotingPower,
    LockedSupplyMismatch,

    InvariantViolated = 1400,

    VestingDurationExceeded = 1500,
    NotClaimable,
}
