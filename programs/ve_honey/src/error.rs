use crate::*;

/// [ve_honey] errors.
#[error_code]
pub enum ProtocolError {
    InvalidLocker = 1000,
    InvalidLockerMint,
    InvalidLockerWLMint,
    InvalidAccountOwner,
    InvalidTokenOwner,
    InvalidToken,
    InvalidAssociatedTokenAccount,
    InvalidRemainingAccounts,
    InvalidProofType,
    InvalidProof,
    InvalidGovernorParams,
    InvalidVoteDelegate,
    InvalidProgramId,

    EscrowNotEnded = 1100,
    EscrowExpired,
    EscrowInUse,
    EscrowNoBalance,
    LockupDurationTooShort,
    LockupDurationTooLong,
    RefreshCannotShorten,
    ClaimError,
    CloseNonZeroReceipt,
    ReceiptCountError,
    ReceiptNotEnded,

    MustProvideWhitelist = 1200,
    ProgramNotWhitelisted,
    EscrowOwnerNotWhitelisted,
    ProgramIdMustBeExecutable,
    NoProofProvided,

    GovernorMismatch = 1300,
    SmartWalletMismatch,
    ProposalMismatch,
    VoterMismatch,
    MetadataMismatch,
    ProposalMustBeActive,
    InsufficientVotingPower,
    LockedSupplyMismatch,

    InvariantViolated = 1400,
}
