use crate::*;
use govern::Governor;

#[derive(Accounts)]
pub struct AddProof<'info> {
    /// payer of the initialization.
    #[account(mut)]
    pub payer: Signer<'info>,
    /// the [Locker].
    pub locker: Box<Account<'info, Locker>>,
    /// the [Proof].
    #[account(
        init_if_needed,
        seeds = [
            PROOF_SEED.as_bytes(),
            locker.key().as_ref(),
            address.key().as_ref(),
        ],
        bump,
        space = 8 + Proof::LEN,
        payer = payer,
    )]
    pub proof: Box<Account<'info, Proof>>,
    /// proof address.
    pub address: UncheckedAccount<'info>,
    /// the [Governor].
    pub governor: Box<Account<'info, Governor>>,
    /// the smart wallet on the [Governor].
    pub smart_wallet: Signer<'info>,

    /// System program.
    pub system_program: Program<'info, System>,
}

impl<'info> AddProof<'info> {
    pub fn process(&mut self, proof_type: u8) -> Result<()> {
        let proof = &mut self.proof;

        let new_proof_type = Proof::read_type(proof_type)?;

        proof.reset_type(new_proof_type);
        proof.proof_address = self.address.key();
        proof.locker = self.locker.key();

        Ok(())
    }
}

impl<'info> Validate<'info> for AddProof<'info> {
    fn validate(&self) -> Result<()> {
        assert_keys_eq!(
            self.locker.governor,
            self.governor,
            ProtocolError::GovernorMismatch
        );
        assert_keys_eq!(
            self.governor.smart_wallet,
            self.smart_wallet,
            ProtocolError::SmartWalletMismatch
        );

        Ok(())
    }
}

#[derive(Accounts)]
pub struct RemoveProof<'info> {
    /// the [Locker].
    pub locker: Box<Account<'info, Locker>>,
    /// the [Proof].
    #[account(mut, close = funds_receiver)]
    pub proof: Box<Account<'info, Proof>>,
    /// CHECK: funds receiver
    #[account(mut)]
    pub funds_receiver: UncheckedAccount<'info>,
    /// the [Governor].
    pub governor: Box<Account<'info, Governor>>,
    /// the smart wallet on the [Governor].
    pub smart_wallet: Signer<'info>,
}

impl<'info> RemoveProof<'info> {
    pub fn process(&mut self) -> Result<()> {
        let proof = &mut self.proof;

        proof.proof_address = Pubkey::default();
        proof.locker = Pubkey::default();
        proof.proof_type = 0;

        Ok(())
    }
}

impl<'info> Validate<'info> for RemoveProof<'info> {
    fn validate(&self) -> Result<()> {
        assert_keys_eq!(self.locker, self.proof.locker, ProtocolError::InvalidLocker);
        assert_keys_eq!(
            self.locker.governor,
            self.governor,
            ProtocolError::GovernorMismatch
        );
        assert_keys_eq!(
            self.governor.smart_wallet,
            self.smart_wallet,
            ProtocolError::SmartWalletMismatch
        );

        Ok(())
    }
}
