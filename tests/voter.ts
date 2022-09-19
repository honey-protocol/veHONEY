require("./utils/setup");
import * as anchor from "@project-serum/anchor";
import { AnchorProvider } from "@project-serum/anchor";
import { expect } from "chai";

import { MockMint } from "./mock/mint";
import { MockStakePool, StakePoolParams } from "./mock/stakePool";
import { MockWallet } from "./mock/wallet";
import * as constants from "./constants";
import { MockUser } from "./mock/user";
import { MockGovernor } from "./mock/governor";
import { checkEscrow, checkTokenAccount } from "./utils/check";
import { sleep } from "./utils/util";

describe("locked voters", () => {
  const provider = AnchorProvider.env();

  let pTokenMint: MockMint;
  let tokenMint: MockMint;
  let poolOwner: MockWallet;
  let stakePool: MockStakePool;
  let governor: MockGovernor;

  before(async () => {
    await initEnv({
      startsAt: new anchor.BN(Math.floor(Date.now() / 1000) + 1),
      claimPeriodUnit: new anchor.BN(1),
      maxClaimCount: 21,
    });
  });

  async function initEnv(params: StakePoolParams) {
    [pTokenMint, tokenMint, poolOwner] = await Promise.all([
      MockMint.create(provider, 6),
      MockMint.create(provider, 6),
      MockWallet.createWithBalance(provider, 1),
    ]);

    stakePool = await MockStakePool.create({
      provider,
      version: constants.STAKE_POOL_VERSION,
      pTokenMint,
      tokenMint,
      owner: poolOwner,
      params,
    });

    governor = await MockGovernor.create({
      provider,
      tokenMint,
      governorParams: {
        ...constants.DEFAULT_GOVERNOR_PARAMS,
      },
      lockerParams: {
        ...constants.DEFAULT_LOCKER_PARAMS,
      },
    });
  }

  it("escrow can be initialized", async () => {
    const user = await MockUser.create({
      provider,
      poolInfo: stakePool,
      governor,
    });

    const escrowAccount = await user.fetchEscrow();

    checkEscrow({
      account: escrowAccount,
      locker: governor.locker,
      owner: user.wallet.publicKey,
      tokens: await user.getLockedTokensAddress(),
      amount: new anchor.BN(0),
      escrowStartedAt: new anchor.BN(0),
      escrowEndsAt: new anchor.BN(0),
      receiptCount: new anchor.BN(0),
      voteDelegate: user.wallet.publicKey,
    });
  });

  it("invalid escrow owner cannot change vote delegate", async () => {
    const user = await MockUser.create({
      provider,
      poolInfo: stakePool,
      governor,
    });
    const [newDelegate, invalidOwner] = await Promise.all([
      MockWallet.createWithBalance(provider, 1),
      MockWallet.createWithBalance(provider, 1),
    ]);
    const setVoteDelegateWithFail = user.setVoteDelegate({
      newDelegate,
      owner: invalidOwner,
    });

    await expect(setVoteDelegateWithFail).to.eventually.be.rejectedWith(
      'failed ({"err":{"InstructionError":[0,{"Custom":7002}]}})'
    );
  });

  it("escrow owner can change vote delegate", async () => {
    const user = await MockUser.create({
      provider,
      poolInfo: stakePool,
      governor,
    });
    const newDelegate = await MockWallet.createWithBalance(provider, 1);
    await user.setVoteDelegate({ newDelegate });
    const escrowAccount = await user.fetchEscrow();

    checkEscrow({
      account: escrowAccount,
      locker: governor.locker,
      owner: user.wallet.publicKey,
      tokens: await user.getLockedTokensAddress(),
      amount: new anchor.BN(0),
      escrowStartedAt: new anchor.BN(0),
      escrowEndsAt: new anchor.BN(0),
      receiptCount: new anchor.BN(0),
      voteDelegate: user.voteDelegate.publicKey,
    });
  });

  it("direct-lock works while whitelistEnabled is not set", async () => {
    await governor.setLockerParams({
      ...constants.DEFAULT_LOCKER_PARAMS,
      whitelistEnabled: false,
    });
    const user = await MockUser.create({
      provider,
      poolInfo: stakePool,
      governor,
    });
    const lockAmount = new anchor.BN(10_000_000);
    await tokenMint.mintTo(user.wallet, lockAmount);
    await user.lock({ amount: lockAmount, duration: new anchor.BN(5) });

    const lockedTokensAccount = await tokenMint.tryGetAssociatedTokenAccount(
      user.escrow
    );

    checkTokenAccount({
      account: lockedTokensAccount,
      mint: tokenMint.address,
      amount: lockAmount,
    });
  });

  it("duration must be in range from min-max stake duration", async () => {
    const minStakeDuration = new anchor.BN(5);
    const maxStakeDuration = new anchor.BN(15);
    await governor.setLockerParams({
      ...constants.DEFAULT_LOCKER_PARAMS,
      whitelistEnabled: false,
      minStakeDuration,
      maxStakeDuration,
    });
    const user = await MockUser.create({
      provider,
      poolInfo: stakePool,
      governor,
    });
    const lockAmount = new anchor.BN(10_000_000);
    await tokenMint.mintTo(user.wallet, lockAmount);
    let lockWithFail = user.lock({
      amount: lockAmount,
      duration: minStakeDuration.subn(1),
    });

    await expect(lockWithFail).to.eventually.be.rejectedWith(
      'failed ({"err":{"InstructionError":[1,{"Custom":7104}]}})'
    );

    lockWithFail = user.lock({
      amount: lockAmount,
      duration: maxStakeDuration.addn(1),
    });

    await expect(lockWithFail).to.eventually.be.rejectedWith(
      'failed ({"err":{"InstructionError":[1,{"Custom":7105}]}})'
    );
  });

  it("refresh duration cannot shorten than before", async () => {
    const minStakeDuration = new anchor.BN(10);
    const maxStakeDuration = new anchor.BN(100);
    await governor.setLockerParams({
      ...constants.DEFAULT_LOCKER_PARAMS,
      whitelistEnabled: false,
      minStakeDuration,
      maxStakeDuration,
    });
    const user = await MockUser.create({
      provider,
      poolInfo: stakePool,
      governor,
    });
    const lockAmount = new anchor.BN(10_000_000);
    await tokenMint.mintTo(user.wallet, lockAmount);
    await user.lock({
      amount: lockAmount.divn(2),
      duration: new anchor.BN(30),
    });

    await sleep(3000);

    const refreshWithFail = user.lock({
      amount: lockAmount.divn(2),
      duration: new anchor.BN(10),
    });

    await expect(refreshWithFail).to.eventually.be.rejectedWith(
      'failed ({"err":{"InstructionError":[0,{"Custom":7106}]}})'
    );
  });
});
