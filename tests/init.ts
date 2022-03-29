const fs = require("fs");
import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";

import { VeHoney } from "../target/types/ve_honey";
import { Stake } from "../target/types/stake";
import * as constants from "./constants";

const clusterUrl = "https://api.devnet.solana.com";
const payer = anchor.web3.Keypair.generate();
const connection = new anchor.web3.Connection(clusterUrl, "processed");
const provider = new anchor.Provider(connection, new anchor.Wallet(payer), {
  skipPreflight: false,
  preflightCommitment: "processed",
  commitment: "processed",
});
anchor.setProvider(provider);

const veHoneyProgram = anchor.workspace.VeHoney as Program<VeHoney>;
const stakeProgram = anchor.workspace.Stake as Program<Stake>;

const publicConnection = new anchor.web3.Connection(clusterUrl, {
  commitment: "processed",
});

const SYSTEM_PROGRAM = anchor.web3.SystemProgram.programId;
const TOKEN_PROGRAM_ID = anchor.Spl.token().programId;
const SYSVAR_RENT_PK = anchor.web3.SYSVAR_RENT_PUBKEY;
const LAMPORTS_PER_SOL = anchor.web3.LAMPORTS_PER_SOL;

interface PoolParams {
  startsAt: anchor.BN;
  claimPeriodUnit: anchor.BN;
  maxClaimCount: number;
}

interface LockerParams {
  whitelistEnabled: boolean;
  minStakeDuration: anchor.BN;
  maxStakeDuration: anchor.BN;
  multiplier: number;
}

let ownerKey: anchor.web3.Keypair,
  lockerBaseKey: anchor.web3.Keypair,
  mintAuthorityKey: anchor.web3.Keypair,
  stakePool: anchor.web3.PublicKey,
  authority: anchor.web3.PublicKey,
  tokenVault: anchor.web3.PublicKey,
  pHoney: anchor.web3.PublicKey,
  honey: anchor.web3.PublicKey,
  locker: anchor.web3.PublicKey,
  poolParams: PoolParams,
  lockerParams: LockerParams;

async function find_address() {
  ownerKey = anchor.web3.Keypair.fromSecretKey(
    Uint8Array.from(
      JSON.parse(fs.readFileSync("./tests/keys/owner.json", "utf8"))
    )
  );
  lockerBaseKey = anchor.web3.Keypair.fromSecretKey(
    Uint8Array.from(
      JSON.parse(fs.readFileSync("./tests/keys/locker-base.json", "utf8"))
    )
  );
  mintAuthorityKey = anchor.web3.Keypair.fromSecretKey(
    Uint8Array.from(
      JSON.parse(fs.readFileSync("./tests/keys/mint-auth.json", "utf8"))
    )
  );
  pHoney = new anchor.web3.PublicKey(
    "7unYPivFG6cuDGeDVjhbutcjYDcMKPu2mBCnRyJ5Qki2"
  );
  honey = new anchor.web3.PublicKey(
    "Bh7vMfPZkGsQJqUjBBGGfcAj6yQdkL8SoLtK5TCYeJtY"
  );
  [stakePool] = await anchor.web3.PublicKey.findProgramAddress(
    [
      Buffer.from(constants.POOL_INFO_SEED),
      honey.toBuffer(),
      pHoney.toBuffer(),
    ],
    stakeProgram.programId
  );
  [authority] = await anchor.web3.PublicKey.findProgramAddress(
    [Buffer.from(constants.VAULT_AUTHORITY_SEED), stakePool.toBuffer()],
    stakeProgram.programId
  );
  [tokenVault] = await anchor.web3.PublicKey.findProgramAddress(
    [
      Buffer.from(constants.TOKEN_VAULT_SEED),
      honey.toBuffer(),
      pHoney.toBuffer(),
    ],
    stakeProgram.programId
  );
  [locker] = await anchor.web3.PublicKey.findProgramAddress(
    [Buffer.from(constants.LOCKER_SEED), lockerBaseKey.publicKey.toBuffer()],
    veHoneyProgram.programId
  );

  poolParams = {
    startsAt: new anchor.BN(Math.floor(Date.now() / 1000) + 36_000), // starts 10 hrs later
    claimPeriodUnit: new anchor.BN(86_400), // 1 day
    maxClaimCount: 21,
  };

  lockerParams = {
    whitelistEnabled: true,
    minStakeDuration: new anchor.BN(7_689_600), // 3 months
    maxStakeDuration: new anchor.BN(31_622_400), // 1 year
    multiplier: 48,
  };

  console.log("\n ============= Primary addresses =============");
  console.log("Owner: ", ownerKey.publicKey.toString());
  console.log("pHONEY: ", pHoney.toString());
  console.log("HONEY: ", honey.toString());
  console.log("Mint authority: ", mintAuthorityKey.publicKey.toString());
  console.log("Pool: ", stakePool.toString());
  console.log("Pool authority: ", authority.toString());
  console.log("Token vault: ", tokenVault.toString());
  console.log("Locker: ", locker.toString());
  console.log("Locker base: ", lockerBaseKey.publicKey.toString());

  console.log("\n ============= Stake pool params ==============");
  console.log("Starts at: ", poolParams.startsAt.toString());
  console.log("Claim period unit: ", poolParams.claimPeriodUnit.toString());
  console.log("Claim count (days): ", poolParams.maxClaimCount);

  console.log("\n ============= Locker params ==============");
  console.log(
    "Whitelist: ",
    lockerParams.whitelistEnabled ? "Enabled" : "Disabled"
  );
  console.log("Min stake duration: ", lockerParams.minStakeDuration.toString());
  console.log("Max stake duration: ", lockerParams.maxStakeDuration.toString());
  console.log("Multiplier: ", lockerParams.multiplier);
}

async function airdrop() {
  console.log("Airdrop 1 SOL to payer ...");
  await publicConnection.confirmTransaction(
    await publicConnection.requestAirdrop(payer.publicKey, LAMPORTS_PER_SOL),
    "finalized"
  );
}

async function init_pool() {
  console.log("Initializing stake pool ", stakePool.toString());
  await stakeProgram.rpc.initialize(poolParams, {
    accounts: {
      payer: payer.publicKey,
      owner: ownerKey.publicKey,
      tokenMint: honey,
      pTokenMint: pHoney,
      poolInfo: stakePool,
      tokenVault,
      authority,
      systemProgram: SYSTEM_PROGRAM,
      tokenProgram: TOKEN_PROGRAM_ID,
      rent: SYSVAR_RENT_PK,
    },
    signers: [ownerKey],
  });
}

async function init_locker() {
  console.log("Initializing locker account ", locker.toString());
  await veHoneyProgram.rpc.initLocker(ownerKey.publicKey, lockerParams, {
    accounts: {
      payer: payer.publicKey,
      base: lockerBaseKey.publicKey,
      locker,
      tokenMint: honey,
      systemProgram: SYSTEM_PROGRAM,
    },
    signers: [lockerBaseKey],
  });
}

(async function doo() {
  await find_address();
  await airdrop();
  await init_pool();
  await init_locker();
})()
  .then(() => {
    console.log("\n Done ...");
  })
  .catch(() => {
    console.log("\n Failed");
  });
