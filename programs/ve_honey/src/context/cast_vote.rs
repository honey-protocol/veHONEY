use crate::constants::*;
use crate::error::*;
use crate::locker_seeds;
use crate::state::*;
use anchor_lang::prelude::*;
use govern::program::Govern;
use govern::{Governor, Proposal, ProposalState, Vote};
use vipers::*;

#[derive(Accounts)]
pub struct CastVote<'info> {
    /// The [Locker].
    pub locker: Box<Account<'info, LockerV2>>,
    /// The [Escrow] that is voting.
    pub escrow: Box<Account<'info, EscrowV2>>,
    /// Vote delegate of the [Escrow].
    pub vote_delegate: Signer<'info>,

    /// The [Proposal] being voted on.
    #[account(mut)]
    pub proposal: Box<Account<'info, Proposal>>,
    /// The [Vote].
    #[account(mut)]
    pub vote: Box<Account<'info, Vote>>,
    /// The [Governor].
    pub governor: Box<Account<'info, Governor>>,
    /// The [govern] program.
    pub govern_program: Program<'info, Govern>,
}

impl<'info> CastVote<'info> {
    pub fn process(&mut self, side: u8) -> Result<()> {
        let voting_power = self.voting_power()?;

        if voting_power == 0 {
            return Ok(());
        }

        let seeds: &[&[&[u8]]] = locker_seeds!(self.locker);
        govern::cpi::set_vote(self.into_set_vote_context(seeds), side, voting_power)?;

        Ok(())
    }

    fn into_set_vote_context<'a, 'b, 'c>(
        &self,
        signer: &'a [&'b [&'c [u8]]],
    ) -> CpiContext<'a, 'b, 'c, 'info, govern::cpi::accounts::SetVote<'info>> {
        let cpi_accounts = govern::cpi::accounts::SetVote {
            governor: self.governor.to_account_info(),
            proposal: self.proposal.to_account_info(),
            vote: self.vote.to_account_info(),
            electorate: self.locker.to_account_info(),
        };
        let cpi_program = self.govern_program.to_account_info();
        CpiContext::new_with_signer(cpi_program, cpi_accounts, signer)
    }

    fn voting_power(&self) -> Result<u64> {
        Ok(unwrap_int!(self.escrow.voting_power_at_time(
            &self.locker.params,
            self.proposal.voting_ends_at
        )))
    }
}

impl<'info> Validate<'info> for CastVote<'info> {
    fn validate(&self) -> Result<()> {
        assert_keys_eq!(self.escrow.locker, self.locker);
        assert_keys_eq!(self.escrow.vote_delegate, self.vote_delegate);
        assert_keys_eq!(self.locker.governor, self.governor);
        assert_keys_eq!(self.proposal.governor, self.governor);
        assert_keys_eq!(self.vote.proposal, self.proposal);
        assert_keys_eq!(self.vote.voter, self.escrow.owner);
        invariant!(
            self.proposal.get_state()? == ProposalState::Active,
            ProtocolError::ProposalMustBeActive
        );
        Ok(())
    }
}
