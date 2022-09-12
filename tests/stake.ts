require("./utils/setup");
import * as anchor from "@project-serum/anchor";
import { AnchorProvider, Program } from "@project-serum/anchor";

import { Stake } from "../target/types/stake";
import * as constants from "./constants";
import { MockMint } from "./mock/mint";
import { StakePoolParams, MockStakePool } from "./mock/stakePool";
import { MockWallet } from "./mock/wallet";
import { checkStakePool } from "./utils/check";

describe("stake pool", () => {
  const provider = AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Stake as Program<Stake>;

  let version: number;
  let pTokenMint: MockMint;
  let tokenMint: MockMint;
  let owner: MockWallet;
  let stakePoolParams: StakePoolParams;

  let stakePool: MockStakePool;

  beforeEach(async () => {
    version = constants.STAKE_POOL_VERSION;
    [pTokenMint, tokenMint, owner] = await Promise.all([
      MockMint.create(provider, 6),
      MockMint.create(provider, 6),
      MockWallet.createWithBalance(provider, 1),
    ]);
    stakePoolParams = {
      startsAt: new anchor.BN(Math.floor(Date.now() / 1000) + 1),
      claimPeriodUnit: new anchor.BN(1),
      maxClaimCount: 21,
    };

    stakePool = await MockStakePool.create({
      provider,
      version,
      pTokenMint,
      tokenMint,
      owner,
      params: stakePoolParams,
    });
  });

  it("can be initialized", async () => {
    const stakePoolData = await stakePool.fetch();

    checkStakePool({
      poolInfo: stakePoolData,
      version,
      pTokenMint: pTokenMint.address,
      tokenMint: tokenMint.address,
      owner: owner.publicKey,
      params: stakePoolParams,
    });
  });
});
