import * as anchor from "@project-serum/anchor";
import { PublicKey } from "@solana/web3.js";
import { assert } from "chai";

import { StakePoolParams } from "../mock/stakePool";
import { LockerParams } from "../mock/governor";

export type CheckStakePoolArgs = {
  poolInfo: any;
  version: number;
  pTokenMint: PublicKey;
  tokenMint: PublicKey;
  owner: PublicKey;
  params: StakePoolParams;
};

export type CheckMintArgs = {
  account: any;
  decimals: number;
  mintAuthority: PublicKey | null;
};

export type CheckPoolUserArgs = {
  poolUser: any;
  poolInfo: PublicKey;
  owner: PublicKey;
  depositAmount: anchor.BN;
  claimedAmount: anchor.BN;
  count: number;
};

export type CheckTokenAccountArgs = {
  account: any;
  mint: PublicKey;
  amount: anchor.BN;
};

export type CheckLockerArgs = {
  account: any;
  base: PublicKey;
  tokenMint: PublicKey;
  lockedSupply: anchor.BN;
  governor: PublicKey;
  params: LockerParams;
};

export type CheckWhitelistEntryArgs = {
  account: any;
  locker: PublicKey;
  programId: PublicKey;
  owner: PublicKey;
};

export type CheckEscrowArgs = {
  account: any;
  locker: PublicKey;
  owner: PublicKey;
  tokens: PublicKey;
  amount: anchor.BN;
  escrowStartedAt: anchor.BN;
  escrowEndsAt: anchor.BN;
  receiptCount: anchor.BN;
  voteDelegate: PublicKey;
};

export function checkStakePool({
  poolInfo,
  version,
  pTokenMint,
  tokenMint,
  owner,
  params,
}: CheckStakePoolArgs) {
  assert.strictEqual(poolInfo.version, version, "version");
  checkPublicKey(poolInfo.pTokenMint, pTokenMint, "pTokenMint");
  checkPublicKey(poolInfo.tokenMint, tokenMint, "tokenMint");
  checkPublicKey(poolInfo.owner, owner, "owner");
  checkBN(poolInfo.params.startsAt, params.startsAt, "params.startsAt");
  checkBN(
    poolInfo.params.claimPeriodUnit,
    params.claimPeriodUnit,
    "params.claimPeriodUnit"
  );
  assert.strictEqual(
    poolInfo.params.maxClaimCount,
    params.maxClaimCount,
    "params.maxClaimCount"
  );
}

export function checkMint({ account, decimals, mintAuthority }: CheckMintArgs) {
  assert.strictEqual(account.decimals, decimals, "decimals");
  checkPublicKey(account.mintAuthority, mintAuthority, "mintAuthority");
}

export function checkPoolUser({
  poolUser,
  poolInfo,
  owner,
  depositAmount,
  claimedAmount,
  count,
}: CheckPoolUserArgs) {
  checkPublicKey(poolUser.poolInfo, poolInfo, "poolInfo");
  checkPublicKey(poolUser.owner, owner, "owner");
  checkBN(poolUser.depositAmount, depositAmount, "depositAmount");
  checkBN(poolUser.claimedAmount, claimedAmount, "claimedAmount");
  assert.strictEqual(poolUser.count, count, "count");
}

export function checkTokenAccount({
  account,
  mint,
  amount,
}: CheckTokenAccountArgs) {
  checkPublicKey(account.mint, mint, "mint");
  checkBN(account.amount, amount, "amount");
}

export function checkLocker({
  account,
  base,
  tokenMint,
  lockedSupply,
  governor,
  params,
}: CheckLockerArgs) {
  checkPublicKey(account.base, base, "base");
  checkPublicKey(account.tokenMint, tokenMint, "tokenMint");
  checkBN(account.lockedSupply, lockedSupply, "lockedSupply");
  checkPublicKey(account.governor, governor, "governor");
  checkBN(
    account.params.minStakeDuration,
    params.minStakeDuration,
    "params.minStakeDuration"
  );
  checkBN(
    account.params.maxStakeDuration,
    params.maxStakeDuration,
    "params.maxStakeDuration"
  );
  assert.strictEqual(
    account.params.whitelistEnabled,
    params.whitelistEnabled,
    "params.whitelistEnabled"
  );
  assert.strictEqual(
    account.params.multiplier,
    params.multiplier,
    "params.multiplier"
  );
  checkBN(
    account.params.proposalActivationMinVotes,
    params.proposalActivationMinVotes,
    "params.proposalActivationMinVotes"
  );
}

export function checkWhitelistEntry({
  account,
  locker,
  programId,
  owner,
}: CheckWhitelistEntryArgs) {
  checkPublicKey(account.locker, locker, "locker");
  checkPublicKey(account.programId, programId, "programId");
  checkPublicKey(account.owner, owner, "owner");
}

export function checkEscrow({
  account,
  locker,
  owner,
  tokens,
  amount,
  escrowStartedAt,
  escrowEndsAt,
  receiptCount,
  voteDelegate,
}: CheckEscrowArgs) {
  checkPublicKey(account.locker, locker, "locker");
  checkPublicKey(account.owner, owner, "owner");
  checkPublicKey(account.tokens, tokens, "tokens");
  checkBN(account.amount, amount, "amount");
  checkBN(account.escrowStartedAt, escrowStartedAt, "escrowStartedAt");
  checkBN(account.escrowEndsAt, escrowEndsAt, "escrowEndsAt");
  checkBN(account.receiptCount, receiptCount, "receiptCount");
  checkPublicKey(account.voteDelegate, voteDelegate, "voteDelegate");
}

export function checkPublicKey(
  actual: any,
  expected: PublicKey,
  propertyName: string
) {
  const expectedStr = expected.toBase58();
  assert.isNotNull(
    actual,
    `expected ${propertyName} to be ${expectedStr} but was null`
  );
  assert.isDefined(
    actual,
    `expected ${propertyName} to be ${expectedStr} but was undefined`
  );
  assert.strictEqual(actual.toBase58(), expectedStr, propertyName);
}

export function checkBN(
  actual: any,
  expected: anchor.BN,
  propertyName: string
) {
  const expectedStr = expected.toString(10);
  assert.isNotNull(
    actual,
    `expected ${propertyName} to be BN ${expectedStr} but was null`
  );
  assert.isDefined(
    actual,
    `expected ${propertyName} to be BN ${expectedStr} but was undefined`
  );
  let actualStr = actual;
  try {
    actualStr = actual.toString(10);
  } catch {
    // pass
  }
  assert.isTrue(
    expected.eq(actual),
    `actual ${propertyName} ${actualStr}` + ` != expected ${expectedStr}`
  );
}
