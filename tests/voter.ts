require("./utils/setup");
import * as anchor from "@project-serum/anchor";
import { AnchorProvider } from "@project-serum/anchor";
import { assert, expect } from "chai";

import { MockMint } from "./mock/mint";
import { MockStakePool, StakePoolParams } from "./mock/stakePool";
import { MockWallet } from "./mock/wallet";
import * as constants from "./constants";
import { MockUser } from "./mock/user";
import { MockGovernor } from "./mock/governor";
import {
  checkEscrow,
  checkLocker,
  checkNftReceipt,
  checkTokenAccount,
} from "./utils/check";
import { sleep } from "./utils/util";
import { MockNFT } from "./mock/nft";

describe("locked voters", () => {
  const provider = AnchorProvider.env();

  let pTokenMint: MockMint;
  let tokenMint: MockMint;
  let wlTokenMint: MockMint;
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
    [pTokenMint, tokenMint, wlTokenMint, poolOwner] = await Promise.all([
      MockMint.create(provider, 6),
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
      wlTokenMint,
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
      amountToReceipt: new anchor.BN(0),
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
      'failed ({"err":{"InstructionError":[0,{"Custom":7003}]}})'
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
      amountToReceipt: new anchor.BN(0),
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
    await user.lock({ amount: lockAmount, duration: new anchor.BN(4) });

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

  it("escrow can be exited & closed", async () => {
    const minStakeDuration = new anchor.BN(1);
    const maxStakeDuration = new anchor.BN(5);
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
      amount: lockAmount,
      duration: new anchor.BN(3),
    });

    await sleep(4000);

    await user.exit();

    let [escrow, userTokenAccount, lockedTokens] = await Promise.all([
      user.fetchEscrow(),
      tokenMint.getAssociatedTokenAccount(user.wallet.publicKey),
      tokenMint.getAssociatedTokenAccount(user.escrow),
    ]);

    checkEscrow({
      account: escrow,
      locker: governor.locker,
      owner: user.wallet.publicKey,
      tokens: await user.getLockedTokensAddress(),
      amount: new anchor.BN(0),
      escrowStartedAt: new anchor.BN(0),
      escrowEndsAt: new anchor.BN(0),
      receiptCount: new anchor.BN(0),
      amountToReceipt: new anchor.BN(0),
      voteDelegate: user.wallet.publicKey,
    });
    checkTokenAccount({
      account: userTokenAccount,
      mint: tokenMint.address,
      amount: lockAmount,
    });
    checkTokenAccount({
      account: lockedTokens,
      mint: tokenMint.address,
      amount: new anchor.BN(0),
    });

    await user.closeEscrow();

    [escrow, lockedTokens] = await Promise.all([
      user.fetchEscrow(),
      await tokenMint.tryGetAssociatedTokenAccount(user.escrow),
    ]);
    assert.strictEqual(escrow, null);
    assert.strictEqual(lockedTokens, null);
  });

  it("vest duration verification", async () => {
    await stakePool.setMintAuthority();
    await governor.setLockerParams({
      ...constants.DEFAULT_LOCKER_PARAMS,
      whitelistEnabled: true,
      minStakeDuration: new anchor.BN(7_689_600),
      maxStakeDuration: new anchor.BN(31_622_400),
    });
    await governor.approveProgramLockPrivilege();
    const [user1, user2, user3] = await Promise.all([
      MockUser.create({
        provider,
        poolInfo: stakePool,
        governor,
      }),
      MockUser.create({
        provider,
        poolInfo: stakePool,
        governor,
      }),
      MockUser.create({
        provider,
        poolInfo: stakePool,
        governor,
      }),
    ]);
    const vestAmount = new anchor.BN(10_000_000);
    const vestDuration1 = new anchor.BN(7_689_600);
    const vestDuration2 = new anchor.BN(15_638_400);
    const vestDuration3 = new anchor.BN(31_536_000);
    await pTokenMint.mintTo(user1.wallet, vestAmount);
    await user1.vest({ amount: vestAmount, duration: vestDuration1 });

    let pTokenAccount = await pTokenMint.getAssociatedTokenAccount(
      user1.wallet.publicKey
    );
    let escrow = await user1.fetchEscrow();
    let lockedTokens = await tokenMint.getTokenAccount(
      await user1.getLockedTokensAddress()
    );
    let expectedTokenAmount = vestAmount.muln(2);
    checkTokenAccount({
      account: pTokenAccount,
      mint: pTokenMint.address,
      amount: new anchor.BN(0),
    });
    checkEscrow({
      account: escrow,
      locker: governor.locker,
      owner: user1.wallet.publicKey,
      tokens: await user1.getLockedTokensAddress(),
      amount: expectedTokenAmount,
      escrowStartedAt: escrow.escrowStartedAt,
      escrowEndsAt: escrow.escrowEndsAt,
      receiptCount: new anchor.BN(0),
      amountToReceipt: new anchor.BN(0),
      voteDelegate: user1.wallet.publicKey,
    });
    checkTokenAccount({
      account: lockedTokens,
      mint: tokenMint.address,
      amount: expectedTokenAmount,
    });

    await pTokenMint.mintTo(user2.wallet, vestAmount);
    await user2.vest({ amount: vestAmount, duration: vestDuration2 });

    pTokenAccount = await pTokenMint.getAssociatedTokenAccount(
      user2.wallet.publicKey
    );
    escrow = await user2.fetchEscrow();
    lockedTokens = await tokenMint.getTokenAccount(
      await user2.getLockedTokensAddress()
    );
    expectedTokenAmount = vestAmount.muln(5);
    checkTokenAccount({
      account: pTokenAccount,
      mint: pTokenMint.address,
      amount: new anchor.BN(0),
    });
    checkEscrow({
      account: escrow,
      locker: governor.locker,
      owner: user2.wallet.publicKey,
      tokens: await user2.getLockedTokensAddress(),
      amount: expectedTokenAmount,
      escrowStartedAt: escrow.escrowStartedAt,
      escrowEndsAt: escrow.escrowEndsAt,
      receiptCount: new anchor.BN(0),
      amountToReceipt: new anchor.BN(0),
      voteDelegate: user2.wallet.publicKey,
    });
    checkTokenAccount({
      account: lockedTokens,
      mint: tokenMint.address,
      amount: expectedTokenAmount,
    });

    await pTokenMint.mintTo(user3.wallet, vestAmount);
    await user3.vest({ amount: vestAmount, duration: vestDuration3 });

    pTokenAccount = await pTokenMint.getAssociatedTokenAccount(
      user3.wallet.publicKey
    );
    escrow = await user3.fetchEscrow();
    lockedTokens = await tokenMint.getTokenAccount(
      await user3.getLockedTokensAddress()
    );
    expectedTokenAmount = vestAmount.muln(10);
    checkTokenAccount({
      account: pTokenAccount,
      mint: pTokenMint.address,
      amount: new anchor.BN(0),
    });
    checkEscrow({
      account: escrow,
      locker: governor.locker,
      owner: user3.wallet.publicKey,
      tokens: await user3.getLockedTokensAddress(),
      amount: expectedTokenAmount,
      escrowStartedAt: escrow.escrowStartedAt,
      escrowEndsAt: escrow.escrowEndsAt,
      receiptCount: new anchor.BN(0),
      amountToReceipt: new anchor.BN(0),
      voteDelegate: user3.wallet.publicKey,
    });
    checkTokenAccount({
      account: lockedTokens,
      mint: tokenMint.address,
      amount: expectedTokenAmount,
    });
  });
});

describe("NFT locked voter", () => {
  const provider = AnchorProvider.env();

  let tokenMint: MockMint;
  let wlTokenMint: MockMint;
  let governor: MockGovernor;
  let nft: MockNFT;

  beforeEach(async () => {
    await initEnv();
  });

  async function initEnv() {
    [tokenMint, wlTokenMint, nft] = await Promise.all([
      MockMint.create(provider, 6),
      MockMint.create(provider, 6),
      MockNFT.create(provider),
    ]);

    governor = await MockGovernor.create({
      provider,
      tokenMint,
      wlTokenMint,
      governorParams: {
        ...constants.DEFAULT_GOVERNOR_PARAMS,
      },
      lockerParams: {
        ...constants.DEFAULT_LOCKER_PARAMS,
      },
    });

    await governor.initTreasury();
    await governor.setWlMintAuthority();
  }

  it("user can mint a nft", async () => {
    const user = await MockUser.create({
      provider,
      governor,
    });

    await nft.mintTo(user.wallet, new anchor.BN(1));

    const nftAccount = await nft.mint.getAssociatedTokenAccount(
      user.wallet.publicKey
    );

    checkTokenAccount({
      account: nftAccount,
      mint: nft.mint.address,
      amount: new anchor.BN(1),
    });
  });

  it("user can lock NFT, earn WL tokens, and earn reward", async () => {
    let treasuryAmount = new anchor.BN(1_000_000_000_000);

    await tokenMint.mintToAddress(
      await governor.getTreasuryAddress(),
      treasuryAmount
    );
    const user = await MockUser.create({
      provider,
      governor,
    });
    await nft.mintTo(user.wallet, new anchor.BN(1));
    await nft.createMasterEdition();

    await governor.addProof(
      new anchor.web3.PublicKey(nft.metadata.data.data.creators.at(0).address)
    );

    const receiptId = 0;

    await user.lockNft({
      duration: new anchor.BN(20),
      nft,
    });

    let [locker, escrow, treasury, lockedTokens, userNft, userWlTokens] =
      await Promise.all([
        governor.fetchLocker(),
        user.fetchEscrow(),
        tokenMint.getTokenAccount(await governor.getTreasuryAddress()),
        tokenMint.getAssociatedTokenAccount(user.escrow),
        nft.mint.tryGetAssociatedTokenAccount(user.wallet.publicKey),
        wlTokenMint.getAssociatedTokenAccount(user.wallet.publicKey),
      ]);

    const rewardAmount = await governor.calcRewardAmountAt();
    treasuryAmount = treasuryAmount.sub(rewardAmount);

    checkLocker({
      account: locker,
      base: governor.lockerBase.publicKey,
      tokenMint: tokenMint.address,
      wlTokenMint: wlTokenMint.address,
      lockedSupply: rewardAmount,
      governor: governor.governor.governorKey,
      params: {
        ...constants.DEFAULT_LOCKER_PARAMS,
      },
    });

    checkEscrow({
      account: escrow,
      locker: governor.locker,
      owner: user.wallet.publicKey,
      tokens: await user.getLockedTokensAddress(),
      amount: rewardAmount,
      escrowStartedAt: escrow.escrowStartedAt,
      escrowEndsAt: escrow.escrowEndsAt,
      receiptCount: new anchor.BN(receiptId + 1),
      amountToReceipt: new anchor.BN(rewardAmount),
      voteDelegate: user.wallet.publicKey,
    });

    checkTokenAccount({
      account: treasury,
      mint: tokenMint.address,
      amount: treasuryAmount,
    });

    checkTokenAccount({
      account: lockedTokens,
      mint: tokenMint.address,
      amount: rewardAmount,
    });

    // Check WL token mint against burning NFT
    checkTokenAccount({
      account: userWlTokens,
      mint: wlTokenMint.address,
      amount: new anchor.BN(1 * 10 ** 6),
    });

    assert.strictEqual(userNft, null);

    const receipts = await user.fetchReceipts();
    const receipt = receipts.find((r) => r.account.receiptId.eqn(receiptId));

    checkNftReceipt({
      account: receipt.account,
      receiptId: new anchor.BN(receiptId),
      locker: governor.locker,
      owner: user.wallet.publicKey,
      claimedAmount: new anchor.BN(0),
    });
  });

  it("NFT locked voter can claim rewards since 1 unit duration later", async () => {
    let treasuryAmount = new anchor.BN(1_000_000_000_000);
    await tokenMint.mintToAddress(
      await governor.getTreasuryAddress(),
      treasuryAmount
    );
    const user = await MockUser.create({
      provider,
      governor,
    });
    await nft.mintTo(user.wallet, new anchor.BN(1));
    await nft.createMasterEdition();

    await governor.addProof(
      new anchor.web3.PublicKey(nft.metadata.data.data.creators.at(0).address)
    );

    const receiptId = 0;

    await user.lockNft({
      duration: new anchor.BN(20),
      nft,
    });

    await sleep(2000);

    await user.claimNftReward(new anchor.BN(receiptId));

    const [escrow, lockedTokens, userToken] = await Promise.all([
      user.fetchEscrow(),
      tokenMint.getAssociatedTokenAccount(user.escrow),
      tokenMint.getAssociatedTokenAccount(user.wallet.publicKey),
    ]);

    const receipt = (await user.fetchReceipts()).find(
      (r) =>
        r.account.receiptId.eqn(receiptId) &&
        r.account.owner.equals(user.wallet.publicKey)
    );

    const rewardAmount = await governor.calcRewardAmountAt();
    const claimAmount = await governor.calcRewardAmountAt(1);
    const remainingAmount = rewardAmount.sub(claimAmount);

    checkEscrow({
      account: escrow,
      locker: governor.locker,
      owner: user.wallet.publicKey,
      tokens: await user.getLockedTokensAddress(),
      amount: remainingAmount,
      escrowStartedAt: escrow.escrowStartedAt,
      escrowEndsAt: escrow.escrowEndsAt,
      receiptCount: new anchor.BN(receiptId + 1),
      amountToReceipt: remainingAmount,
      voteDelegate: user.wallet.publicKey,
    });

    checkTokenAccount({
      account: lockedTokens,
      mint: tokenMint.address,
      amount: remainingAmount,
    });

    checkTokenAccount({
      account: userToken,
      mint: tokenMint.address,
      amount: claimAmount,
    });

    checkNftReceipt({
      account: receipt.account,
      receiptId: new anchor.BN(receiptId),
      locker: governor.locker,
      owner: user.wallet.publicKey,
      claimedAmount: claimAmount,
    });
  });

  it("after claimed for all receipts, can close escrow", async () => {
    let treasuryAmount = new anchor.BN(1_000_000_000_000);
    await tokenMint.mintToAddress(
      await governor.getTreasuryAddress(),
      treasuryAmount
    );
    const user = await MockUser.create({
      provider,
      governor,
    });
    await nft.mintTo(user.wallet, new anchor.BN(1));
    await nft.createMasterEdition();

    await governor.addProof(
      new anchor.web3.PublicKey(nft.metadata.data.data.creators.at(0).address)
    );

    const receiptId = 0;

    await user.lockNft({
      duration: new anchor.BN(20),
      nft,
    });

    await sleep(21000);

    await user.claimNftReward(new anchor.BN(receiptId));

    let [escrow, lockedTokens, userToken] = await Promise.all([
      user.fetchEscrow(),
      tokenMint.getAssociatedTokenAccount(user.escrow),
      tokenMint.getAssociatedTokenAccount(user.wallet.publicKey),
    ]);

    const receipt = (await user.fetchReceipts()).find(
      (r) =>
        r.account.receiptId.eqn(receiptId) &&
        r.account.owner.equals(user.wallet.publicKey)
    );

    const rewardAmount = await governor.calcRewardAmountAt();
    const claimAmount = rewardAmount;
    const remainingAmount = new anchor.BN(0);

    checkEscrow({
      account: escrow,
      locker: governor.locker,
      owner: user.wallet.publicKey,
      tokens: await user.getLockedTokensAddress(),
      amount: remainingAmount,
      escrowStartedAt: escrow.escrowStartedAt,
      escrowEndsAt: escrow.escrowEndsAt,
      receiptCount: new anchor.BN(receiptId + 1),
      amountToReceipt: remainingAmount,
      voteDelegate: user.wallet.publicKey,
    });

    checkTokenAccount({
      account: lockedTokens,
      mint: tokenMint.address,
      amount: remainingAmount,
    });

    checkTokenAccount({
      account: userToken,
      mint: tokenMint.address,
      amount: claimAmount,
    });

    checkNftReceipt({
      account: receipt.account,
      receiptId: new anchor.BN(receiptId),
      locker: governor.locker,
      owner: user.wallet.publicKey,
      claimedAmount: claimAmount,
    });

    await user.closeReceipt(new anchor.BN(receiptId));
    await user.closeEscrow();

    [escrow, lockedTokens] = await Promise.all([
      user.fetchEscrow(),
      tokenMint.tryGetAssociatedTokenAccount(user.escrow),
    ]);

    assert.strictEqual(escrow, null);
    assert.strictEqual(lockedTokens, null);
    assert.strictEqual(
      (await user.fetchReceipts()).filter((r) =>
        r.account.owner.equals(user.wallet.publicKey)
      ).length,
      0
    );
  });
});
