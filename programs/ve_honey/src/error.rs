use anchor_lang::prelude::*;

/// [ve_honey] errors.
#[error_code]
pub enum ProtocolError {
    #[msg("Escrow has not ended.")]
    EscrowNotEnded,
    #[msg("Invalid locker admin")]
    InvalidLockerAdmin,
    #[msg("Invalid locker")]
    InvalidLocker,
    #[msg("Lockup duration must at least be the min stake duration.")]
    LockupDurationTooShort,
    #[msg("Lockup duration must at most be the max stake duration.")]
    LockupDurationTooLong,
    #[msg("A voting escrow refresh cannot shorten the escrow time remaining.")]
    RefreshCannotShorten,
    #[msg("Program whitelist enabled; please provide whitelist entry and instructions sysvar")]
    MustProvideWhitelist,
    #[msg("CPI caller not whitelisted to invoke lock instruction.")]
    ProgramNotWhitelisted,
    #[msg("CPI caller not whitelisted for escrow owner to invoke lock instruction.")]
    EscrowOwnerNotWhitelisted,
    #[msg("Escrow was already expired.")]
    EscrowExpired,
    #[msg("Token lock failed, locked supply mismatches the exact amount.")]
    LockedSupplyMismatch,
    #[msg("The escrow has already locked.")]
    EscrowInUse,
    #[msg("The escrow doesn't have balance")]
    EscrowNoBalance,
    #[msg("The proposal must be active")]
    ProposalMustBeActive,
    #[msg("Governor mismatch")]
    GovernorMismatch,
    #[msg("Smart wallet on governor mismatch")]
    SmartWalletMismatch,
    #[msg("Program id must be executable")]
    ProgramIdMustBeExecutable,
    #[msg("Invalid account owner")]
    InvalidAccountOwner,
    #[msg("Insufficient voting power to activate a proposal")]
    InsufficientVotingPower,
    #[msg("Invalid locker token mint")]
    InvalidLockerMint,
    #[msg("Invariant violated")]
    InvariantViolated,
    #[msg("Invalid proof type")]
    InvalidProofType,
    #[msg("Invalid NFT proof")]
    InvalidProof,
    #[msg("No proof provided")]
    NoProofProvided,
    #[msg("Invalid token owner")]
    InvalidTokenOwner,
    #[msg("Invalid associated token account")]
    InvalidAssociatedTokenAccount,
    #[msg("NFT vesting duration exceeded")]
    VestingDurationExceeded,
    #[msg("Invalid remaining accounts len")]
    InvalidRemainingAccountsLength,
    #[msg("Not claimable")]
    NotClaimable,
}
