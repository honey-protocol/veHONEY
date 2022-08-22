use crate::state::*;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct LockNft<'info> {
    /// [Locker].
    #[account(mut)]
    pub locker: Box<Account<'info, Locker>>,
}
