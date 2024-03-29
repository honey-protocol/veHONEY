use crate::*;
use govern::program::Govern;
use govern::{Governor, Proposal, ProposalState, Vote};

#[derive(Accounts)]
pub struct CastVote<'info> {
    /// The [Locker].
    pub locker: Box<Account<'info, Locker>>,
    /// The [Escrow] that is voting.
    pub escrow: Box<Account<'info, Escrow>>,
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
        govern::cpi::set_vote(self.to_set_vote_context(seeds), side, voting_power)?;

        Ok(())
    }

    fn to_set_vote_context<'a, 'b, 'c>(
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
        self.escrow.voting_power(&self.locker.params)
    }
}

impl<'info> Validate<'info> for CastVote<'info> {
    fn validate(&self) -> Result<()> {
        assert_keys_eq!(
            self.escrow.locker,
            self.locker,
            ProtocolError::InvalidLocker
        );
        assert_keys_eq!(
            self.escrow.vote_delegate,
            self.vote_delegate,
            ProtocolError::InvalidVoteDelegate
        );
        assert_keys_eq!(
            self.locker.governor,
            self.governor,
            ProtocolError::GovernorMismatch
        );
        assert_keys_eq!(
            self.proposal.governor,
            self.governor,
            ProtocolError::GovernorMismatch
        );
        assert_keys_eq!(
            self.vote.proposal,
            self.proposal,
            ProtocolError::ProposalMismatch
        );
        assert_keys_eq!(
            self.vote.voter,
            self.escrow.owner,
            ProtocolError::VoterMismatch
        );
        invariant!(
            self.proposal.get_state()? == ProposalState::Active,
            ProtocolError::ProposalMustBeActive
        );
        Ok(())
    }
}
