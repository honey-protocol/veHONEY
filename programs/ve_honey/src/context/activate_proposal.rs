use crate::constants::*;
use crate::error::*;
use crate::locker_seeds;
use crate::state::*;
use anchor_lang::prelude::*;
use govern::program::Govern;
use govern::{Governor, Proposal};
use vipers::*;

#[derive(Accounts)]
pub struct ActivateProposal<'info> {
    /// The [Locker].
    pub locker: Box<Account<'info, LockerV2>>,
    /// The [Governor].
    pub governor: Box<Account<'info, Governor>>,
    /// The [Proposal].
    #[account(mut)]
    pub proposal: Box<Account<'info, Proposal>>,
    /// The user's [Escrow].
    pub escrow: Box<Account<'info, EscrowV2>>,
    /// The [Escrow]'s owner.
    pub escrow_owner: Signer<'info>,
    /// The [govern] program.
    pub govern_program: Program<'info, Govern>,
}

impl<'info> ActivateProposal<'info> {
    /// Activates the proposal.
    pub fn process(&mut self) -> Result<()> {
        let seeds: &[&[&[u8]]] = locker_seeds!(self.locker);
        govern::cpi::activate_proposal(self.into_activate_proposal_context(seeds))?;

        Ok(())
    }

    fn into_activate_proposal_context<'a, 'b, 'c>(
        &self,
        signer: &'a [&'b [&'c [u8]]],
    ) -> CpiContext<'a, 'b, 'c, 'info, govern::cpi::accounts::ActivateProposal<'info>> {
        let cpi_accounts = govern::cpi::accounts::ActivateProposal {
            governor: self.governor.to_account_info(),
            proposal: self.proposal.to_account_info(),
            electorate: self.locker.to_account_info(),
        };
        let cpi_program = self.govern_program.to_account_info();
        CpiContext::new_with_signer(cpi_program, cpi_accounts, signer)
    }

    fn voting_power(&self) -> Result<u64> {
        self.escrow.voting_power(&self.locker.params)
    }
}

impl<'info> Validate<'info> for ActivateProposal<'info> {
    fn validate(&self) -> Result<()> {
        assert_keys_eq!(self.locker, self.governor.electorate);
        assert_keys_eq!(self.governor, self.locker.governor);
        assert_keys_eq!(self.proposal.governor, self.governor);
        assert_keys_eq!(self.escrow.locker, self.locker);
        assert_keys_eq!(self.escrow.owner, self.escrow_owner);

        invariant!(
            self.voting_power()? >= self.locker.params.proposal_activation_min_votes,
            ProtocolError::InsufficientVotingPower
        );

        Ok(())
    }
}
