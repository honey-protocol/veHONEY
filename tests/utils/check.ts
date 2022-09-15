import * as anchor from "@project-serum/anchor";
import { PublicKey } from "@solana/web3.js";
import { assert } from "chai";

import { StakePoolParams } from "../mock/stakePool";

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
  address: PublicKey;
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
  amount: bigint;
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

export function checkMint({
  account,
  address,
  decimals,
  mintAuthority,
}: CheckMintArgs) {
  assert.strictEqual(account.decimals, decimals, "decimals");
  checkPublicKey(account.address, address, "address");
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
  assert.strictEqual(account.amount, amount, "amount");
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
