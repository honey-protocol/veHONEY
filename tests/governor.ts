import * as anchor from "@project-serum/anchor";
import { AnchorProvider } from "@project-serum/anchor";
import { assert } from "chai";

import { MockGovernor, LockerParams } from "./mock/governor";
import { MintHelpers, MockMint } from "./mock/mint";
import * as constants from "./constants";
import {
  checkLocker,
  checkMint,
  checkProof,
  checkTokenAccount,
  checkWhitelistEntry,
} from "./utils/check";

describe("governor in locker", () => {
  const provider = AnchorProvider.env();
  anchor.setProvider(provider);

  let governor: MockGovernor;
  let tokenMint: MockMint;
  let wlTokenMint: MockMint;

  beforeEach(async () => {
    [tokenMint, wlTokenMint] = await Promise.all([
      MockMint.create(provider, 6),
      MockMint.create(provider, 6),
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
  });

  it("can be initialized", async () => {
    const lockerAccount = await governor.fetchLocker();
    checkLocker({
      account: lockerAccount,
      base: governor.lockerBase.publicKey,
      tokenMint: tokenMint.address,
      wlTokenMint: wlTokenMint.address,
      lockedSupply: new anchor.BN(0),
      governor: governor.governor.governorKey,
      params: {
        ...constants.DEFAULT_LOCKER_PARAMS,
      },
    });
  });

  it("governor can update locker params", async () => {
    const newParams: LockerParams = {
      minStakeDuration: new anchor.BN(2),
      maxStakeDuration: new anchor.BN(12),
      whitelistEnabled: false,
      multiplier: 3,
      proposalActivationMinVotes: new anchor.BN(0),
      nftStakeDurationUnit: new anchor.BN(1),
      nftStakeBaseReward: new anchor.BN(3_750_000_000),
      nftStakeDurationCount: 10,
      nftRewardHalvingStartsAt: 2,
    };

    await governor.setLockerParams({ ...newParams });

    const lockerAccount = await governor.fetchLocker();
    checkLocker({
      account: lockerAccount,
      base: governor.lockerBase.publicKey,
      tokenMint: tokenMint.address,
      wlTokenMint: wlTokenMint.address,
      lockedSupply: new anchor.BN(0),
      governor: governor.governor.governorKey,
      params: {
        ...newParams,
      },
    });
  });

  it("governor can initialize treasury token account", async () => {
    await governor.initTreasury();

    const treasuryAddr = await governor.getTreasuryAddress();
    const treasuryAccount = await tokenMint.getTokenAccount(treasuryAddr);

    checkTokenAccount({
      account: treasuryAccount,
      mint: tokenMint.address,
      amount: new anchor.BN(0),
    });
  });

  it("governor can approve/revoke lock privilege", async () => {
    await governor.approveProgramLockPrivilege();
    let whitelistEntryAccount = await governor.fetchWhitelistEntry();

    checkWhitelistEntry({
      account: whitelistEntryAccount,
      locker: governor.locker,
      programId: governor.stakeProgram.programId,
      owner: anchor.web3.SystemProgram.programId,
    });

    const whitelistEntry = await governor.getWhitelistEntryAddress(
      governor.stakeProgram.programId,
      anchor.web3.SystemProgram.programId
    );
    await governor.revokeProgramLockPrivilege(whitelistEntry);
    whitelistEntryAccount = await governor.fetchWhitelistEntry();
    assert.strictEqual(whitelistEntryAccount, null);
  });

  it("governor can add/remove proof", async () => {
    const proofAddress = anchor.web3.Keypair.generate();
    await governor.addProof(proofAddress.publicKey);

    let proofAccount = await governor.fetchProof(proofAddress.publicKey);

    checkProof({
      account: proofAccount,
      proofType: 1,
      proofAddress: proofAddress.publicKey,
      locker: governor.locker,
    });

    await governor.removeProof(proofAddress.publicKey);

    proofAccount = await governor.fetchProof(proofAddress.publicKey);

    assert.strictEqual(proofAccount, null);
  });

  it("can be set/reclaim mint authority of WL tokens", async () => {
    await governor.setWlMintAuthority();

    let wlMintAccount = await MintHelpers.getMintAccount(
      provider.connection,
      wlTokenMint.address
    );

    checkMint({
      account: wlMintAccount,
      decimals: 6,
      mintAuthority: governor.locker,
    });

    const newMintAuthority = anchor.web3.Keypair.generate();

    await governor.reclaimWlMintAuthority(newMintAuthority.publicKey);

    wlMintAccount = await MintHelpers.getMintAccount(
      provider.connection,
      wlTokenMint.address
    );

    checkMint({
      account: wlMintAccount,
      decimals: 6,
      mintAuthority: newMintAuthority.publicKey,
    });
  });
});
