use crate::*;

#[macro_export]
macro_rules! token_vault_seeds {
    (
        token_mint = $token_mint:expr,
        p_token_mint = $p_token_mint:expr,
        bump = $bump:expr
    ) => {
        &[
            constants::TOKEN_VAULT_SEED.as_bytes(),
            &$token_mint.to_bytes()[..],
            &$p_token_mint.to_bytes()[..],
            &[$bump],
        ]
    };
}

#[macro_export]
macro_rules! authority_seeds {
    (
        pool_info = $pool_info:expr,
        bump = $bump:expr
    ) => {
        &[
            constants::AUTHORITY_SEED.as_bytes(),
            &$pool_info.to_bytes()[..],
            &[$bump],
        ]
    };
}

pub fn conversion_ratio(duration: i64) -> Result<u64> {
    match duration {
        // 3 months option 89 - 92 days
        7_689_600..=7_948_800 => Ok(2),
        // 6 months
        15_638_400..=15_897_600 => Ok(5),
        // 12 months
        31_536_000..=31_622_400 => Ok(10),
        _ => Err(error!(ProtocolError::InvalidParams)),
    }

    // for tests
    // match duration {
    //     // 3 months option 89 - 92 days
    //     1 => Ok(2),
    //     // 6 months
    //     3 => Ok(5),
    //     // 12 months
    //     12 => Ok(10),
    //     _ => Err(ErrorCode::InvalidParam.into()),
    // }
}
