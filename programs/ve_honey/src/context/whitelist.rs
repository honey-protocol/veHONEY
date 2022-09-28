use crate::*;
use govern::Governor;

#[derive(Accounts)]
pub struct ApproveProgramLockPrivilege<'info> {
    /// Payer of initialization.
    #[account(mut)]
    pub payer: Signer<'info>,
    /// [Locker].
    #[account(has_one = governor)]
    pub locker: Box<Account<'info, Locker>>,
    /// [WhitelistEntry].
    #[account(
        init,
        seeds = [
            WHITELIST_ENTRY_SEED.as_bytes(),
            locker.key().as_ref(),
            executable_id.key().as_ref(),
            whitelisted_owner.key().as_ref()
        ],
        bump,
        space = 8 + WhitelistEntry::LEN,
        payer = payer
    )]
    pub whitelist_entry: Box<Account<'info, WhitelistEntry>>,
    /// Governor of the [Locker].
    pub governor: Box<Account<'info, Governor>>,
    /// Smart wallet on the [Governor].
    pub smart_wallet: Signer<'info>,

    /// CHECK: ProgramId of the program to whitelist.
    pub executable_id: UncheckedAccount<'info>,

    /// CHECK: Owner whitelisted. If set to [System], then the program is whitelisted for all accounts.
    pub whitelisted_owner: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

impl<'info> ApproveProgramLockPrivilege<'info> {
    pub fn process(&mut self, bump: u8) -> Result<()> {
        let whitelist_entry = &mut self.whitelist_entry;

        whitelist_entry.bump = bump;
        whitelist_entry.locker = self.locker.key();
        whitelist_entry.program_id = self.executable_id.key();
        whitelist_entry.owner = self.whitelisted_owner.key();

        emit!(ApproveLockPrivilegeEvent {
            locker: whitelist_entry.locker,
            program_id: whitelist_entry.program_id,
            owner: whitelist_entry.owner,
            timestamp: Clock::get()?.unix_timestamp
        });

        Ok(())
    }
}

impl<'info> Validate<'info> for ApproveProgramLockPrivilege<'info> {
    fn validate(&self) -> Result<()> {
        assert_keys_eq!(
            self.governor.smart_wallet,
            self.smart_wallet,
            ProtocolError::SmartWalletMismatch
        );
        invariant!(
            self.executable_id.executable,
            ProtocolError::ProgramIdMustBeExecutable
        );

        Ok(())
    }
}

#[derive(Accounts)]
pub struct RevokeProgramLockPrivilege<'info> {
    /// Payer.
    #[account(mut)]
    pub payer: Signer<'info>,
    /// [Locker].
    #[account(has_one = governor)]
    pub locker: Box<Account<'info, Locker>>,
    /// [WhitelistEntry].
    #[account(mut, has_one = locker, close = payer)]
    pub whitelist_entry: Box<Account<'info, WhitelistEntry>>,
    /// Governor of the [Locker].
    pub governor: Box<Account<'info, Governor>>,
    /// Smart wallet on the [Governor].
    pub smart_wallet: Signer<'info>,
}

impl<'info> RevokeProgramLockPrivilege<'info> {
    pub fn process(&self) -> Result<()> {
        emit!(RevokeLockPrivilegeEvent {
            locker: self.whitelist_entry.locker,
            program_id: self.whitelist_entry.program_id,
            timestamp: Clock::get()?.unix_timestamp
        });

        Ok(())
    }
}

impl<'info> Validate<'info> for RevokeProgramLockPrivilege<'info> {
    fn validate(&self) -> Result<()> {
        assert_keys_eq!(
            self.governor.smart_wallet,
            self.smart_wallet,
            ProtocolError::SmartWalletMismatch
        );

        Ok(())
    }
}

#[event]
/// Event called in [ve_honey::approve_program_lock_privilege].
pub struct ApproveLockPrivilegeEvent {
    /// [Locker].
    #[index]
    pub locker: Pubkey,
    /// ProgramId approved to make CPI calls to [ve_honey::lock].
    pub program_id: Pubkey,
    /// Owner of the [Escrow].
    pub owner: Pubkey,
    /// Timestamp
    pub timestamp: i64,
}

#[event]
pub struct RevokeLockPrivilegeEvent {
    /// [Locker].
    pub locker: Pubkey,
    /// ProgramId approved to make CPI calls to [ve_honey::lock].
    pub program_id: Pubkey,
    /// Timestamp.
    pub timestamp: i64,
}
