const fs = require("fs");
import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { Token } from "@solana/spl-token";

import { VeHoney } from "../target/types/ve_honey";
import { SmartWallet } from "./idls/smart_wallet";
import * as constants from "./constants";
import { Govern } from "./idls/govern";

let provider = anchor.Provider.env();
anchor.setProvider(provider);
const veHoneyProgram = anchor.workspace.VeHoney as Program<VeHoney>;

const smartWalletIdl = JSON.parse(fs.readFileSync("tests/idls/smart_wallet.json", "utf8"));
const governIdl = JSON.parse(fs.readFileSync("tests/idls/govern.json", "utf8"));
const smartWalletProgram = new Program<SmartWallet>(
  smartWalletIdl,
  new anchor.web3.PublicKey("GokivDYuQXPZCWRkwMhdH2h91KpDQXBEmpgBgs55bnpH"),
  provider
);
const governProgram = new Program<Govern>(
  governIdl,
  new anchor.web3.PublicKey("Govz1VyoyLD5BL6CSCxUJLVLsQHRwjfFj1prNsdNg5Jw"),
  provider
);

const payer = provider.wallet;
const payerTemp = anchor.web3.Keypair.generate();

const SYSTEM_PROGRAM = anchor.web3.SystemProgram.programId;
const TOKEN_PROGRAM_ID = anchor.Spl.token().programId;

const PHONEY_MINT = new anchor.web3.PublicKey("7unYPivFG6cuDGeDVjhbutcjYDcMKPu2mBCnRyJ5Qki2");
const HONEY_MINT = new anchor.web3.PublicKey("Bh7vMfPZkGsQJqUjBBGGfcAj6yQdkL8SoLtK5TCYeJtY");

const pHoneyMint = new Token(provider.connection, PHONEY_MINT, TOKEN_PROGRAM_ID, payerTemp);

const honeyMint = new Token(provider.connection, HONEY_MINT, TOKEN_PROGRAM_ID, payerTemp);

interface LockerParams {
  whitelistEnabled: boolean;
  minStakeDuration: anchor.BN;
  maxStakeDuration: anchor.BN;
  multiplier: number;
}

interface LockerParamsV2 {
  whitelistEnabled: boolean;
  minStakeDuration: anchor.BN;
  maxStakeDuration: anchor.BN;
  multiplier: number;
  proposalActivationMinVotes: anchor.BN;
}

interface GovernanceParams {
  votingDelay: anchor.BN;
  votingPeriod: anchor.BN;
  quorumVotes: anchor.BN;
  timelockDelaySeconds: anchor.BN;
}

let lockerParams: LockerParams;
let governanceParams: GovernanceParams;

let stakePool: anchor.web3.PublicKey,
  admin: anchor.web3.Keypair,
  tokenVault: anchor.web3.PublicKey,
  authority: anchor.web3.PublicKey,
  authorityBump: number,
  lockerBase: anchor.web3.Keypair,
  locker: anchor.web3.PublicKey,
  lockerBump: number,
  newLocker: anchor.web3.PublicKey,
  whitelistEntry: anchor.web3.PublicKey,
  newWhitelistEntry: anchor.web3.PublicKey,
  governor: anchor.web3.PublicKey,
  governorBump: number,
  smartWallet: anchor.web3.PublicKey,
  smartWalletBump: number,
  subaccount: anchor.web3.PublicKey,
  subaccountInfo: anchor.web3.PublicKey,
  subaccountInfoBump: number;

async function setupGovernor() {
  admin = anchor.web3.Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync("./tests/keys/owner.json", "utf8")))
  );

  const smartWalletBase = anchor.web3.Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync("./tests/keys/smart_wallet_base.json", "utf8")))
  );
  const governorBase = anchor.web3.Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync("./tests/keys/governor_base.json", "utf8")))
  );
  lockerBase = anchor.web3.Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync("./tests/keys/locker_base.json", "utf8")))
  );
  [locker, lockerBump] = await anchor.web3.PublicKey.findProgramAddress(
    [Buffer.from(constants.LOCKER_SEED), lockerBase.publicKey.toBuffer()],
    veHoneyProgram.programId
  );
  [governor, governorBump] = await anchor.web3.PublicKey.findProgramAddress(
    [Buffer.from(constants.GOVERNOR_SEED), governorBase.publicKey.toBuffer()],
    governProgram.programId
  );
  [smartWallet] = await anchor.web3.PublicKey.findProgramAddress(
    [Buffer.from(constants.SMART_WALLET_SEED), smartWalletBase.publicKey.toBuffer()],
    smartWalletProgram.programId
  );
  [subaccount] = await anchor.web3.PublicKey.findProgramAddress(
    [
      Buffer.from(constants.SMART_WALLET_OWNER_INVOKER_SEED),
      smartWallet.toBuffer(),
      Buffer.from(Uint8Array.of(...new anchor.BN(0).toArray("le", 8))),
    ],
    smartWalletProgram.programId
  );
  [subaccountInfo, subaccountInfoBump] = await anchor.web3.PublicKey.findProgramAddress(
    [Buffer.from(constants.SMART_WALLET_SUBACCOUNT_INFO_SEED), subaccount.toBuffer()],
    smartWalletProgram.programId
  );

  let type = "ownerInvoker";

  console.log("subaccount: ", subaccount.toString());
  console.log("SubaccountInfo: ", subaccountInfo.toString());

  const owners = [
    subaccount,
    governor,
    new anchor.web3.PublicKey("ESeAFDVft5p7R7i1n7u75r9Bp5ESRmHwuqxE6Hz7NDuH"),
    new anchor.web3.PublicKey("GhGP6ouLzF2rHsyNkpdCdjNWFzVPhWfSrhE4Hb7QhK8p"),
  ];

  // await smartWalletProgram.rpc.createSubaccountInfo(
  //   subaccountInfoBump,
  //   subaccount,
  //   smartWallet,
  //   new anchor.BN(0),
  //   { [type]: {} },
  //   {
  //     accounts: {
  //       subaccountInfo,
  //       payer: payer.publicKey,
  //       systemProgram: SYSTEM_PROGRAM,
  //     },
  //   }
  // );

  // try {
  //   await smartWalletProgram.rpc.createSmartWallet(smartWalletBump, 5, owners, new anchor.BN(2), new anchor.BN(0), {
  //     accounts: {
  //       base: smartWalletBase.publicKey,
  //       smartWallet,
  //       payer: payer.publicKey,
  //       systemProgram: SYSTEM_PROGRAM,
  //     },
  //     signers: [smartWalletBase],
  //   });
  // } catch (e) {
  //   console.log("Create smart wallet!");
  //   console.log(e);
  // }

  governanceParams = {
    votingDelay: new anchor.BN(86_400),
    votingPeriod: new anchor.BN(604_800),
    quorumVotes: new anchor.BN(10_000_000).mul(new anchor.BN(10 ** 6)),
    timelockDelaySeconds: new anchor.BN(1_800),
  };

  // try {
  //   await governProgram.rpc.createGovernor(governorBump, locker, governanceParams, {
  //     accounts: {
  //       base: governorBase.publicKey,
  //       governor,
  //       smartWallet: smartWallet,
  //       payer: payer.publicKey,
  //       systemProgram: SYSTEM_PROGRAM,
  //     },
  //     signers: [governorBase],
  //   });
  // } catch (e) {
  //   console.log("Create governor");
  //   console.log(e);
  // }

  await new Promise((resolve) => setTimeout(resolve, 3000));

  const governorAcc = await governProgram.account.governor.fetch(governor);

  console.log("Elect (Locker): ", governorAcc.electorate.toString());

  console.log("Smart wallet: ", smartWallet.toString());
  console.log("Governor: ", governor.toString());
  console.log("Current locker: ", locker.toString());
}

async function migrateLocker() {
  let lockerAccount = await veHoneyProgram.account.locker.fetch(locker);

  const reacllocationIx = veHoneyProgram.instruction.reallocLocker(lockerBump, {
    accounts: {
      payer: provider.wallet.publicKey,
      admin: admin.publicKey,
      base: lockerBase.publicKey,
      locker,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      systemProgram: anchor.web3.SystemProgram.programId,
    },
  });

  const newParams: LockerParamsV2 = {
    whitelistEnabled: lockerAccount.params.whitelistEnabled,
    minStakeDuration: lockerAccount.params.minStakeDuration,
    maxStakeDuration: lockerAccount.params.maxStakeDuration,
    multiplier: 1,
    proposalActivationMinVotes: new anchor.BN(10_000).mul(new anchor.BN(10 ** 6)),
  };

  const setParamsWithAdminIx = veHoneyProgram.instruction.setParamsWithAdmin(newParams, {
    accounts: {
      admin: admin.publicKey,
      locker,
    },
  });

  const tx = new anchor.web3.Transaction().add(reacllocationIx).add(setParamsWithAdminIx);

  await provider.send(tx, [admin], { commitment: "processed" });

  lockerAccount = await veHoneyProgram.account.locker.fetch(locker);

  console.log("Admin: ", lockerAccount.governor.toString());
  console.log("Params: ", lockerAccount.params.proposalActivationMinVotes.toString());
}

async function migrateEscrows() {
  const escrows = await veHoneyProgram.account.escrow.all();

  for (let i = 0; i < escrows.length; i++) {
    const escrowi = escrows[i];

    console.log("Escrow: ", escrowi.publicKey.toString());

    const ix = veHoneyProgram.instruction.reallocEscrow(escrowi.account.bump, {
      accounts: {
        payer: payer.publicKey,
        admin: admin.publicKey,
        locker,
        escrow: escrowi.publicKey,
        escrowOwner: escrowi.account.owner,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        systemProgram: anchor.web3.SystemProgram.programId,
      },
    });

    const tx = new anchor.web3.Transaction().add(ix);

    let retries = 0;
    while (retries < 5) {
      try {
        await provider.send(tx, [admin], { commitment: "confirmed" });
        break;
      } catch (e) {
        retries++;
      }
    }

    const escrowiAcc = await veHoneyProgram.account.escrow.fetch(escrowi.publicKey);

    console.log("Vote delegate: ", escrowiAcc.voteDelegate.toString());
  }
}

async function checkEscrows() {
  const escrows = await provider.connection.getProgramAccounts(veHoneyProgram.programId, {
    filters: [
      {
        dataSize: 129,
      },
      {
        memcmp: {
          offset: 8,
          bytes: locker.toBase58(),
        },
      },
    ],
  });

  for (let i = 0; i < escrows.length; i++) {
    const escrowi = escrows[i];

    console.log("Escrow: ", escrowi.pubkey.toString());

    let escrowiAcc = await veHoneyProgram.account.escrow.fetch(escrowi.pubkey);

    const ix = veHoneyProgram.instruction.reallocEscrow(escrowiAcc.bump, {
      accounts: {
        payer: payer.publicKey,
        admin: admin.publicKey,
        locker,
        escrow: escrowi.pubkey,
        escrowOwner: escrowiAcc.owner,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        systemProgram: anchor.web3.SystemProgram.programId,
      },
    });

    const tx = new anchor.web3.Transaction().add(ix);

    let retries = 0;
    while (retries < 5) {
      try {
        await provider.send(tx, [admin], { commitment: "confirmed" });
        break;
      } catch (e) {
        retries++;
      }
    }

    escrowiAcc = await veHoneyProgram.account.escrow.fetch(escrowi.pubkey);

    console.log("Vote delegate: ", escrowiAcc.voteDelegate.toString() + " - " + i);
  }
}

(async function dodo() {
  await setupGovernor();
  // await migrateLocker();
  // await migrateEscrows();
  // await checkEscrows();
})()
  .then(() => console.log("Success!"))
  .catch((e) => console.log(e));
