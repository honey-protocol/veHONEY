use crate::*;
use anchor_lang::solana_program::pubkey::PUBKEY_BYTES;

#[account]
pub struct Proof {
    /// [Locker] that this proof belongs to.
    pub locker: Pubkey,
    /// Proof type.
    pub proof_type: u8,
    /// Whitelisted address.
    pub proof_address: Pubkey,
}

impl Proof {
    pub const LEN: usize = PUBKEY_BYTES + 1 + PUBKEY_BYTES;

    pub fn read_type(proof_type: u8) -> Result<ProofType> {
        ProofType::from_bits(proof_type).ok_or_else(|| error!(ProtocolError::InvariantViolated))
    }

    pub fn reset_type(&mut self, proof_type: ProofType) {
        self.proof_type = proof_type.bits();
    }

    pub fn contains_type(&self, expected_proof_type: ProofType) -> Result<()> {
        let proof_type = Proof::read_type(self.proof_type)?;
        if !proof_type.contains(expected_proof_type) {
            return Err(error!(ProtocolError::InvalidProofType));
        }
        Ok(())
    }
}

bitflags::bitflags! {
   pub struct ProofType: u8 {
       const CREATOR = 1 << 0;
       const MINT = 1 << 1;
   }
}
