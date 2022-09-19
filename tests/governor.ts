import * as anchor from "@project-serum/anchor";
import { AnchorProvider } from "@project-serum/anchor";
import { assert } from "chai";

import { MockGovernor, LockerParams } from "./mock/governor";
import { MockMint } from "./mock/mint";
import * as constants from "./constants";
import {
  checkLocker,
  checkTokenAccount,
  checkWhitelistEntry,
} from "./utils/check";

describe("governor in locker", () => {
  const provider = AnchorProvider.env();
  anchor.setProvider(provider);

  let governor: MockGovernor;
  let tokenMint: MockMint;

  beforeEach(async () => {
    tokenMint = await MockMint.create(provider, 6);
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
  });

  it("can be initialized", async () => {
    const lockerAccount = await governor.fetchLocker();
    checkLocker({
      account: lockerAccount,
      base: governor.lockerBase.publicKey,
      tokenMint: tokenMint.address,
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
    };

    await governor.setLockerParams({ ...newParams });

    const lockerAccount = await governor.fetchLocker();
    checkLocker({
      account: lockerAccount,
      base: governor.lockerBase.publicKey,
      tokenMint: tokenMint.address,
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
});
