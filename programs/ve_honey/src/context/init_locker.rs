use crate::constants::*;
use crate::state::*;
use anchor_lang::prelude::*;
use anchor_spl::token::Mint;
use govern::Governor;
use vipers::*;

#[derive(Accounts)]
pub struct InitLocker<'info> {
    /// Payer of the initialization.
    #[account(mut)]
    pub payer: Signer<'info>,
    /// Base.
    pub base: Signer<'info>,
    /// [Locker].
    #[account(
        init,
        seeds = [LOCKER_SEED.as_bytes(), base.key().as_ref()],
        bump,
        payer = payer
    )]
    pub locker: Box<Account<'info, Locker>>,
    /// Mint of the token that can be used to join the [Locker].
    pub token_mint: Box<Account<'info, Mint>>,

    /// System program.
    pub system_program: Program<'info, System>,
}

impl<'info> InitLocker<'info> {
    pub fn process(&mut self, bump: u8, admin: Pubkey, params: LockerParams) -> Result<()> {
        let locker = &mut self.locker;

        locker.token_mint = self.token_mint.key();
        locker.base = self.base.key();
        locker.bump = bump;
        locker.admin = admin;
        locker.params = params;

        emit!(InitLockerEvent {
            locker: locker.key(),
            token_mint: locker.token_mint,
            admin,
            params
        });

        Ok(())
    }
}

impl<'info> Validate<'info> for InitLocker<'info> {
    fn validate(&self) -> Result<()> {
        Ok(())
    }
}

#[event]
/// Event called in [ve_honey::init_locker].
pub struct InitLockerEvent {
    /// The [Locker] being created.
    #[index]
    pub locker: Pubkey,
    /// Mint of the token that can be used to join the [Locker].
    pub token_mint: Pubkey,
    /// Admin of the [Locker].
    pub admin: Pubkey,
    /// [LockerParams].
    pub params: LockerParams,
}

#[derive(Accounts)]
pub struct InitLockerV2<'info> {
    /// Payer of initialization.
    #[account(mut)]
    pub payer: Signer<'info>,
    /// Base.
    pub base: Signer<'info>,
    /// [Locker].
    #[account(
        init,
        seeds = [LOCKER_SEED.as_bytes(), base.key().as_ref()],
        bump,
        space = 8 + LockerV2::LEN,
        payer = payer
    )]
    pub locker: Box<Account<'info, LockerV2>>,
    /// Mint of the token that can be used to join the [Locker].
    pub token_mint: Box<Account<'info, Mint>>,
    /// [Governor] associated with the [Locker].
    pub governor: Box<Account<'info, Governor>>,

    /// System program.
    pub system_program: Program<'info, System>,
}

impl<'info> InitLockerV2<'info> {
    pub fn process(&mut self, bump: u8, params: LockerParamsV2) -> Result<()> {
        let locker = &mut self.locker;
        locker.token_mint = self.token_mint.key();
        locker.governor = self.governor.key();
        locker.base = self.base.key();
        locker.bump = bump;
        locker.params = params;

        emit!(InitLockerV2Event {
            locker: locker.key(),
            token_mint: locker.token_mint,
            governor: locker.governor,
            params,
        });

        Ok(())
    }
}

impl<'info> Validate<'info> for InitLockerV2<'info> {
    fn validate(&self) -> Result<()> {
        Ok(())
    }
}

#[event]
/// Event called in [ve_honey::init_locker].
pub struct InitLockerV2Event {
    /// The [Locker] being created.
    #[index]
    pub locker: Pubkey,
    /// Mint of the token that can be used to join the [Locker].
    pub token_mint: Pubkey,
    /// The governor of the [Locker].
    pub governor: Pubkey,
    /// [LockerParams].
    pub params: LockerParamsV2,
}

// #[derive(Accounts)]
// #[instruction(bump: u8)]
// pub struct ReallocLocker<'info> {
//     pub payer: Signer<'info>,
//     pub base: AccountInfo<'info>,
//     #[account(
//         mut,
//         seeds = [LOCKER_SEED.as_bytes(), base.key().as_ref()],
//         bump = bump,
//     )]
//     pub locker: AccountInfo<'info>,

//     pub rent: Sysvar<'info, Rent>,
//     pub system_program: Program<'info, System>,
// }

// impl<'info> ReallocLocker<'info> {
//     pub fn process(&mut self, proposal_activation_min_votes: u64) -> Result<()> {
//         let old_lamports = self.locker.lamports();
//         let new_lamports = self.rent.minimum_balance(8 + LockerV2::LEN);

//         if old_lamports < new_lamports {
//             let lamports_to_transfer = new_lamports.saturating_sub(old_lamports);
//             anchor_lang::solana_program::program::invoke(
//                 &anchor_lang::solana_program::system_instruction::transfer(
//                     self.payer.key,
//                     &self.locker.key(),
//                     lamports_to_transfer,
//                 ),
//                 &[
//                     self.payer.to_account_info(),
//                     self.locker.to_account_info(),
//                     self.system_program.to_account_info(),
//                 ],
//             )?;
//         }

//         self.locker
//             .to_account_info()
//             .realloc(8 + LockerV2::LEN, true)?;

//         AccountLoader::load_mut(&self)

//         let mut locker = Account::<LockerV2>::try_from_unchecked(&self.locker.to_account_info())?;

//         locker.params.proposal_activation_min_votes = proposal_activation_min_votes;

//         // emit!(ReallocEvent {
//         //     base: self.locker.base,
//         //     token_mint: self.locker.token_mint,
//         //     params: self.locker.params
//         // });

//         Ok(())
//     }
// }

// #[event]
// pub struct ReallocEvent {
//     base: Pubkey,
//     token_mint: Pubkey,
//     params: LockerParams,
// }
