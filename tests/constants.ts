import * as anchor from "@project-serum/anchor";

import { GovernorParams, LockerParams } from "./mock/governor";

export const POOL_INFO_SEED = "PoolInfo";
export const POOL_USER_SEED = "PoolUser";
export const TOKEN_VAULT_SEED = "TokenVault";
export const VAULT_AUTHORITY_SEED = "VaultAuthority";
export const STAKE_POOL_VERSION = 1;
export const CLAIM_PERIOD_UNIT = 86_400;
export const CLAIM_MAX_COUNT = 21;

export const LOCKER_SEED = "Locker";
export const ESCROW_SEED = "Escrow";
export const WHITELIST_ENTRY_SEED = "LockerWhitelistEntry";
export const TREASURY_SEED = "Treasury";
export const PROOF_SEED = "Proof";
export const NFT_RECEIPT_SEED = "Receipt";

// external seeds
export const SMART_WALLET_SEED = "GokiSmartWallet";
export const TRANSACTION_SEED = "GokiTransaction";
export const SUBACCOUNT_INFO_SEED = "GokiSubaccountInfo";
export const GOVERNOR_SEED = "TribecaGovernor";
export const PROPOSAL_SEED = "TribecaProposal";
export const PROPOSAL_META_SEED = "TribecaProposalMeta";
export const VOTE_SEED = "TribecaVote";

export const DEFAULT_DECIMALS = 6;

export const DEFAULT_GOVERNOR_PARAMS: GovernorParams = {
  votingDelay: new anchor.BN(1),
  votingPeriod: new anchor.BN(5),
  quorumVotes: new anchor.BN(50).muln(10 ** DEFAULT_DECIMALS),
  timelockDelaySeconds: new anchor.BN(0),
};

export const DEFAULT_LOCKER_PARAMS: LockerParams = {
  minStakeDuration: new anchor.BN(1),
  maxStakeDuration: new anchor.BN(10),
  whitelistEnabled: true,
  multiplier: 1,
  proposalActivationMinVotes: new anchor.BN(10).muln(10 ** 6),
};
