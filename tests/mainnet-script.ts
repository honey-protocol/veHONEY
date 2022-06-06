const fs = require("fs");
const assert = require("assert");
import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { ASSOCIATED_TOKEN_PROGRAM_ID, Token } from "@solana/spl-token";

import { Stake } from "../target/types/stake";
import { VeHoney } from "../target/types/ve_honey";
import * as constants from "./constants";

const clusterUrl = "https://ssc-dao.genesysgo.net/";

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

let provider = anchor.Provider.env();

anchor.setProvider(provider);

const stakeProgram = anchor.workspace.Stake as Program<Stake>;
const veHoneyProgram = anchor.workspace.VeHoney as Program<VeHoney>;

const payer = provider.wallet;
const payer_temp = anchor.web3.Keypair.generate();

const publicConnection = new anchor.web3.Connection(clusterUrl, {
  commitment: "confirmed",
});

const SYSTEM_PROGRAM = anchor.web3.SystemProgram.programId;
const TOKEN_PROGRAM_ID = anchor.Spl.token().programId;
const LAMPORTS_PER_SOL = anchor.web3.LAMPORTS_PER_SOL;

const PHONEY_MINT = new anchor.web3.PublicKey(
  "PHnyhLEnsD9SiP9tk9kHHKiCxCTPFnymzPspDqAicMe"
);
const HONEY_MINT = new anchor.web3.PublicKey(
  "HonyeYAaTPgKUgQpayL914P6VAqbQZPrbkGMETZvW4iN"
);

const pHoneyMint = new Token(
  publicConnection,
  PHONEY_MINT,
  TOKEN_PROGRAM_ID,
  payer_temp
);

const honeyMint = new Token(
  publicConnection,
  HONEY_MINT,
  TOKEN_PROGRAM_ID,
  payer_temp
);

let poolParams: PoolParams;
let lockerParams: LockerParams;

let stakePool: anchor.web3.PublicKey,
  admin: anchor.web3.Keypair,
  tokenVault: anchor.web3.PublicKey,
  authority: anchor.web3.PublicKey,
  authorityBump: number,
  lockerBase: anchor.web3.Keypair,
  locker: anchor.web3.PublicKey,
  whitelistEntry: anchor.web3.PublicKey;

const myKeypair = anchor.web3.Keypair.fromSecretKey(
  Uint8Array.from([
    52, 7, 6, 186, 211, 66, 93, 75, 191, 226, 126, 255, 132, 154, 105, 219, 87,
    12, 251, 66, 211, 66, 39, 170, 62, 74, 220, 169, 253, 218, 223, 211, 97,
    243, 21, 134, 192, 125, 57, 103, 60, 250, 163, 35, 129, 68, 218, 162, 215,
    183, 193, 109, 154, 19, 147, 247, 74, 166, 3, 180, 32, 166, 226, 188,
  ])
);

const myPHoneyKey = new anchor.web3.PublicKey(
  "83eeEHkUUEv3N1kQSZmKdmpf4qrNbMWgLzzHbjmXqHRC"
);

async function getAddresses() {
  // TODO: admin key should replaced with the ledger keypair
  admin = anchor.web3.Keypair.fromSecretKey(
    Uint8Array.from(
      JSON.parse(fs.readFileSync("./tests/keys/owner.json", "utf8"))
    )
  );

  [stakePool] = await anchor.web3.PublicKey.findProgramAddress(
    [
      Buffer.from(constants.POOL_INFO_SEED),
      honeyMint.publicKey.toBuffer(),
      pHoneyMint.publicKey.toBuffer(),
    ],
    stakeProgram.programId
  );

  [tokenVault] = await anchor.web3.PublicKey.findProgramAddress(
    [
      Buffer.from(constants.TOKEN_VAULT_SEED),
      honeyMint.publicKey.toBuffer(),
      pHoneyMint.publicKey.toBuffer(),
    ],
    stakeProgram.programId
  );

  [authority, authorityBump] = await anchor.web3.PublicKey.findProgramAddress(
    [Buffer.from(constants.VAULT_AUTHORITY_SEED), stakePool.toBuffer()],
    stakeProgram.programId
  );

  lockerBase = anchor.web3.Keypair.fromSecretKey(
    Uint8Array.from(
      JSON.parse(fs.readFileSync("./tests/keys/locker_base.json", "utf8"))
    )
  );

  [locker] = await anchor.web3.PublicKey.findProgramAddress(
    [Buffer.from(constants.LOCKER_SEED), lockerBase.publicKey.toBuffer()],
    veHoneyProgram.programId
  );
  [whitelistEntry] = await anchor.web3.PublicKey.findProgramAddress(
    [
      Buffer.from(constants.WHITELIST_ENTRY_SEED),
      locker.toBuffer(),
      stakeProgram.programId.toBuffer(),
      SYSTEM_PROGRAM.toBuffer(),
    ],
    veHoneyProgram.programId
  );

  poolParams = {
    startsAt: new anchor.BN(Math.floor(Date.now() / 1000) + 1800), // starts 10 hrs later
    claimPeriodUnit: new anchor.BN(86_400), // 1 day
    maxClaimCount: 21,
  };

  lockerParams = {
    whitelistEnabled: true,
    minStakeDuration: new anchor.BN(2_592_000), // 3 months
    // maxStakeDuration: new anchor.BN(31_622_400), // 1 year
    maxStakeDuration: new anchor.BN(126_230_400),
    multiplier: 48,
  };

  console.log("\n ============= Primary addresses =============");
  console.log("Owner: ", admin.publicKey.toString());
  console.log("pHONEY: ", pHoneyMint.publicKey.toString());
  console.log("HONEY: ", honeyMint.publicKey.toString());
  console.log("Pool: ", stakePool.toString());
  console.log("Pool authority: ", authority.toString());
  console.log("Token vault: ", tokenVault.toString());
  console.log("Locker: ", locker.toString());
  console.log("Locker base: ", lockerBase.publicKey.toString());
  console.log("Whitelist Entry for Stake program: ", whitelistEntry.toString());

  console.log("\n ============= Stake pool params ==============");
  // console.log("Starts at: ", poolParams.startsAt.toString());
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

  const stakePoolAccount = await stakeProgram.account.poolInfo.fetch(stakePool);

  console.log("Pool Owner: ", stakePoolAccount.owner.toString());
}

async function init_pool() {
  await stakeProgram.rpc.initialize(poolParams, {
    accounts: {
      payer: payer.publicKey,
      owner: admin.publicKey,
      tokenMint: honeyMint.publicKey,
      pTokenMint: pHoneyMint.publicKey,
      poolInfo: stakePool,
      tokenVault,
      authority: authority,
      systemProgram: SYSTEM_PROGRAM,
      tokenProgram: TOKEN_PROGRAM_ID,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
    },
    signers: [admin],
  });
}

async function init_locker() {
  console.log("Initializing locker account ", locker.toString());
  await veHoneyProgram.rpc.initLocker(admin.publicKey, lockerParams, {
    accounts: {
      payer: payer.publicKey,
      base: lockerBase.publicKey,
      locker,
      tokenMint: honeyMint.publicKey,
      systemProgram: SYSTEM_PROGRAM,
    },
    signers: [lockerBase],
  });
}

async function set_owner() {
  await stakeProgram.rpc.setOwner(
    new anchor.web3.PublicKey("F3enT51dxXXZLxQnrfxyMyNop2EtpAHq687EggPrxHcG"),
    {
      accounts: {
        owner: admin.publicKey,
        poolInfo: stakePool,
      },
      signers: [admin],
    }
  );
}

async function set_mint_authority() {
  // TODO: mintAuthorityKey should be replaced with the current mint authority.
  const mintAuthorityKey = anchor.web3.Keypair.generate();

  await stakeProgram.rpc.setMintAuthority({
    accounts: {
      owner: admin.publicKey,
      poolInfo: stakePool,
      tokenMint: honeyMint,
      authority: authority,
      originAuthority: mintAuthorityKey.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
    },
    signers: [mintAuthorityKey, admin],
  });
}

async function reclaim_mint_authority() {
  const newMintAuth = new anchor.web3.PublicKey(
    "F3enT51dxXXZLxQnrfxyMyNop2EtpAHq687EggPrxHcG"
  );

  await stakeProgram.rpc.reclaimMintAuthority(newMintAuth, {
    accounts: {
      owner: admin.publicKey,
      poolInfo: stakePool,
      tokenMint: honeyMint.publicKey,
      authority: authority,
      tokenProgram: TOKEN_PROGRAM_ID,
    },
    signers: [admin],
  });

  const mintAuth = await honeyMint.getMintInfo();

  assert.ok(mintAuth.mintAuthority.equals(newMintAuth));
}

async function set_locker_params() {
  await veHoneyProgram.rpc.setLockerParams(lockerParams, {
    accounts: {
      admin: admin.publicKey,
      locker,
    },
    signers: [admin],
  });

  const lockerAccount = await veHoneyProgram.account.locker.fetch(locker);
  console.log("Max period: ", lockerAccount.params.maxStakeDuration.toString());
  console.log("Min period: ", lockerAccount.params.minStakeDuration.toString());
}

async function add_whitelist() {
  await veHoneyProgram.rpc.approveProgramLockPrivilege({
    accounts: {
      payer: payer.publicKey,
      locker,
      lockerAdmin: admin.publicKey,
      whitelistEntry,
      executableId: stakeProgram.programId,
      whitelistedOwner: SYSTEM_PROGRAM,
      systemProgram: SYSTEM_PROGRAM,
    },
    signers: [admin],
  });
}

async function deposit() {
  const [poolUser] = await anchor.web3.PublicKey.findProgramAddress(
    [
      Buffer.from(constants.POOL_USER_SEED),
      stakePool.toBuffer(),
      myKeypair.publicKey.toBuffer(),
    ],
    stakeProgram.programId
  );

  console.log("pool user: ", poolUser.toString());

  // const initializeIx = stakeProgram.instruction.initializeUser({
  //   accounts: {
  //     payer: payer.publicKey,
  //     poolInfo: stakePool,
  //     userInfo: poolUser,
  //     userOwner: myKeypair.publicKey,
  //     systemProgram: SYSTEM_PROGRAM,
  //   },
  //   signers: [myKeypair],
  // });

  await stakeProgram.rpc.deposit(new anchor.BN(50000000), {
    accounts: {
      poolInfo: stakePool,
      userInfo: poolUser,
      userOwner: myKeypair.publicKey,
      pTokenMint: pHoneyMint.publicKey,
      source: myPHoneyKey,
      userAuthority: myKeypair.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
    },
    // preInstructions: [initializeIx],
    signers: [myKeypair],
  });
}

async function lock() {
  const lt1 = veHoneyProgram.addEventListener("LockEvent", (e, s) => {
    console.log("Lock in Slot: ", s);
    console.log("Locker: ", e.locker.toString());
    console.log("Escrow Owner: ", e.escrowOwner.toString());
    console.log("Token mint: ", e.tokenMint.toString());
    console.log("Lock amount: ", e.amount.toString());
    console.log("Locked supply: ", e.amount.toString());
    console.log("Lock duration: ", e.duration.toString());
    console.log("Prev lock ends at: ", e.prevEscrowEndsAt.toString());
    console.log("Next escrow ends at: ", e.nextEscrowEndsAt.toString());
    console.log("Next escrow started at: ", e.nextEscrowStartedAt.toString());
  });

  const lt2 = veHoneyProgram.addEventListener("InitEscrowEvent", (e, s) => {
    console.log("Initialize Escrow in Slot: ", s);
    console.log("Escrow: ", e.escrow.toString());
    console.log("Locker: ", e.locker.toString());
    console.log("Escrow Owner: ", e.escrow_owner.toString());
    console.log("Timestamp: ", e.timestamp.toString());
  });

  const [escrow] = await anchor.web3.PublicKey.findProgramAddress(
    [
      Buffer.from(constants.ESCROW_SEED),
      locker.toBuffer(),
      myKeypair.publicKey.toBuffer(),
    ],
    veHoneyProgram.programId
  );

  console.log("My escrow: ", escrow.toString());

  const lockedTokens = await Token.getAssociatedTokenAddress(
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    honeyMint.publicKey,
    escrow,
    true
  );

  console.log("My escrow Locked tokens: ", lockedTokens.toString());

  await stakeProgram.rpc
    .stake(new anchor.BN(50000000), new anchor.BN(7_689_600), {
      accounts: {
        poolInfo: stakePool,
        tokenMint: honeyMint.publicKey,
        pTokenMint: pHoneyMint.publicKey,
        pTokenFrom: myPHoneyKey,
        userAuthority: myKeypair.publicKey,
        tokenVault,
        authority,
        locker,
        escrow,
        lockedTokens,
        lockerProgram: veHoneyProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      remainingAccounts: [
        {
          pubkey: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
          isSigner: false,
          isWritable: false,
        },
        {
          pubkey: whitelistEntry,
          isSigner: false,
          isWritable: false,
        },
      ],
      preInstructions: [
        Token.createAssociatedTokenAccountInstruction(
          ASSOCIATED_TOKEN_PROGRAM_ID,
          TOKEN_PROGRAM_ID,
          honeyMint.publicKey,
          lockedTokens,
          escrow,
          payer.publicKey
        ),
        veHoneyProgram.instruction.initEscrow({
          accounts: {
            payer: payer.publicKey,
            locker,
            escrow: escrow,
            escrowOwner: myKeypair.publicKey,
            systemProgram: SYSTEM_PROGRAM,
          },
        }),
      ],
      signers: [myKeypair],
    })
    .finally(() => {
      setTimeout(() => {
        veHoneyProgram.removeEventListener(lt1);
        veHoneyProgram.removeEventListener(lt2);
      }, 2000);
    });
}

(async function doo() {
  await getAddresses();

  // await lock();
  // await deposit();

  // await init_pool();
  // await init_locker();
  await set_mint_authority();
  // await add_whitelist();
  // await set_locker_params();
  // await reclaim_mint_authority();
  // await set_owner();
})()
  .then(() => {
    console.log("\n Done ...");
  })
  .catch((e) => {
    console.log(e);
    console.log("\n Failed");
  });
