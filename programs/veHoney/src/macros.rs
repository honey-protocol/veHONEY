/// Generates the signer seeds for a [Locker].
#[macro_export]
macro_rules! locker_seeds {
    ($locker: expr) => {
        &[&[
            LOCKER_SEED.as_bytes(),
            &$locker.base.to_bytes(),
            &[$locker.bump],
        ]]
    };
}

/// Generates the signer seeds for an [Escrow].
#[macro_export]
macro_rules! escrow_seeds {
    ($escrow: expr) => {
        &[&[
            ESCROW_SEED.as_bytes(),
            &$escrow.locker.to_bytes(),
            &$escrow.owner.to_bytes(),
            &[$escrow.bump],
        ]]
    };
}
