const fs = require("fs");
import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { Token } from "@solana/spl-token";

import { Stake } from "../target/types/stake";
import { VeHoney } from "../target/types/ve_honey";
import { SmartWallet } from "./idls/smart_wallet";
import * as constants from "./constants";
import { Govern } from "./idls/govern";

const clusterUrl = "https://api.devnet.solana.com";
const publicConnection = new anchor.web3.Connection(clusterUrl, {
  commitment: "confirmed",
});
let provider = new anchor.Provider(
  publicConnection,
  new anchor.Wallet(
    anchor.web3.Keypair.fromSecretKey(
      Uint8Array.from(
        JSON.parse(
          fs.readFileSync("/home/fzgem18/.config/solana/id.json", "utf8")
        )
      )
    )
  ),
  { commitment: "confirmed" }
);
anchor.setProvider(provider);
const veHoneyIdl = JSON.parse(
  fs.readFileSync("target/idl/ve_honey.json", "utf8")
);
const veHoneyProgram = new Program<VeHoney>(
  veHoneyIdl,
  new anchor.web3.PublicKey("CKQapf8pWoMddT15grV8UCPjiLCTHa12NRgkKV63Lc7q"),
  provider
);

const smartWalletIdl = JSON.parse(
  fs.readFileSync("tests/idls/smart_wallet.json", "utf8")
);
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

const PHONEY_MINT = new anchor.web3.PublicKey(
  "7unYPivFG6cuDGeDVjhbutcjYDcMKPu2mBCnRyJ5Qki2"
);
const HONEY_MINT = new anchor.web3.PublicKey(
  "Bh7vMfPZkGsQJqUjBBGGfcAj6yQdkL8SoLtK5TCYeJtY"
);

const pHoneyMint = new Token(
  publicConnection,
  PHONEY_MINT,
  TOKEN_PROGRAM_ID,
  payerTemp
);

const honeyMint = new Token(
  publicConnection,
  HONEY_MINT,
  TOKEN_PROGRAM_ID,
  payerTemp
);

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
  proposalActivationMinVotes: anchor.BN;
  multiplier: number;
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
  newLockerBase: anchor.web3.Keypair,
  locker: anchor.web3.PublicKey,
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
    Uint8Array.from(
      JSON.parse(fs.readFileSync("./tests/keys/owner.json", "utf8"))
    )
  );

  const owner1 = anchor.web3.Keypair.fromSecretKey(
    Uint8Array.from(
      JSON.parse(fs.readFileSync("./tests/keys/owner1.json", "utf8"))
    )
  );
  const owner2 = anchor.web3.Keypair.fromSecretKey(
    Uint8Array.from(
      JSON.parse(fs.readFileSync("./tests/keys/owner2.json", "utf8"))
    )
  );
  const smartWalletBase = anchor.web3.Keypair.fromSecretKey(
    Uint8Array.from(
      JSON.parse(fs.readFileSync("./tests/keys/smart_wallet_base.json", "utf8"))
    )
  );
  const governorBase = anchor.web3.Keypair.fromSecretKey(
    Uint8Array.from(
      JSON.parse(fs.readFileSync("./tests/keys/governor_base.json", "utf8"))
    )
  );
  lockerBase = anchor.web3.Keypair.fromSecretKey(
    Uint8Array.from(
      JSON.parse(fs.readFileSync("./tests/keys/locker-base.json", "utf8"))
    )
  );
  newLockerBase = anchor.web3.Keypair.fromSecretKey(
    Uint8Array.from(
      JSON.parse(fs.readFileSync("./tests/keys/new_locker_base.json", "utf8"))
    )
  );
  [locker] = await anchor.web3.PublicKey.findProgramAddress(
    [Buffer.from(constants.LOCKER_SEED), lockerBase.publicKey.toBuffer()],
    veHoneyProgram.programId
  );
  [newLocker] = await anchor.web3.PublicKey.findProgramAddress(
    [Buffer.from(constants.LOCKER_SEED), newLockerBase.publicKey.toBuffer()],
    veHoneyProgram.programId
  );
  [whitelistEntry] = await anchor.web3.PublicKey.findProgramAddress(
    [
      Buffer.from(constants.WHITELIST_ENTRY_SEED),
      locker.toBuffer(),
      new anchor.web3.PublicKey(
        "4V68qajTiVHm3Pm9fQoV8D4tEYBmq3a34R9NV5TymLr7"
      ).toBuffer(),
      SYSTEM_PROGRAM.toBuffer(),
    ],
    veHoneyProgram.programId
  );
  [newWhitelistEntry] = await anchor.web3.PublicKey.findProgramAddress(
    [
      Buffer.from(constants.WHITELIST_ENTRY_SEED),
      newLocker.toBuffer(),
      new anchor.web3.PublicKey(
        "4V68qajTiVHm3Pm9fQoV8D4tEYBmq3a34R9NV5TymLr7"
      ).toBuffer(),
      SYSTEM_PROGRAM.toBuffer(),
    ],
    veHoneyProgram.programId
  );
  [governor, governorBump] = await anchor.web3.PublicKey.findProgramAddress(
    [Buffer.from(constants.GOVERNOR_SEED), governorBase.publicKey.toBuffer()],
    governProgram.programId
  );

  [smartWallet] = await anchor.web3.PublicKey.findProgramAddress(
    [
      Buffer.from(constants.SMART_WALLET_SEED),
      smartWalletBase.publicKey.toBuffer(),
    ],
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

  [subaccountInfo, subaccountInfoBump] =
    await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from(constants.SMART_WALLET_SUBACCOUNT_INFO_SEED),
        subaccount.toBuffer(),
      ],
      smartWalletProgram.programId
    );

  let type = "ownerInvoker";

  console.log("subaccount: ", subaccount.toString());
  console.log("SubaccountInfo: ", subaccountInfo.toString());

  const owners = [
    subaccount,
    governor,
    new anchor.web3.PublicKey("8RznFuFdfJUy6cA5Tg4uFHzoyfrmqgSEmA3Qt6zs6faX"),
    new anchor.web3.PublicKey("Exsq2WCfLQrmVTZGb9ji47xTt2KyLJ375opJZaSS8P5T"),
    new anchor.web3.PublicKey("7bMXpuXCag8CobBKeg3MB8YkgMNwPBZeVggbgACmTfNs"),
  ];

  // smartWalletProgram.rpc.setOwners()

  await smartWalletProgram.rpc.createSubaccountInfo(
    subaccountInfoBump,
    subaccount,
    smartWallet,
    new anchor.BN(0),
    { [type]: {} },
    {
      accounts: {
        subaccountInfo,
        payer: payer.publicKey,
        systemProgram: SYSTEM_PROGRAM,
      },
    }
  );

  try {
    await smartWalletProgram.rpc.createSmartWallet(
      smartWalletBump,
      5,
      owners,
      new anchor.BN(1),
      new anchor.BN(0),
      {
        accounts: {
          base: smartWalletBase.publicKey,
          smartWallet,
          payer: payer.publicKey,
          systemProgram: SYSTEM_PROGRAM,
        },
        signers: [smartWalletBase],
      }
    );
  } catch (e) {
    console.log("Create smart wallet!");
    console.log(e);
  }

  governanceParams = {
    votingDelay: new anchor.BN(1),
    votingPeriod: new anchor.BN(30 * 60),
    quorumVotes: new anchor.BN(10_000 * 0.04).mul(new anchor.BN(10 ** 6)),
    timelockDelaySeconds: new anchor.BN(0),
  };

  try {
    await governProgram.rpc.createGovernor(
      governorBump,
      newLocker,
      governanceParams,
      {
        accounts: {
          base: governorBase.publicKey,
          governor,
          smartWallet: smartWallet,
          payer: payer.publicKey,
          systemProgram: SYSTEM_PROGRAM,
        },
        signers: [governorBase],
      }
    );
  } catch (e) {
    console.log("Create governor");
    console.log(e);
  }

  await new Promise((resolve) => setTimeout(resolve, 3000));

  const governorAcc = await governProgram.account.governor.fetch(governor);

  console.log("Elect: ", governorAcc.electorate.toString());

  console.log("Smart wallet: ", smartWallet.toString());
  console.log("Governor: ", governor.toString());
  console.log("Current locker: ", locker.toString());
  console.log("New locker: ", newLocker.toString());
  console.log("Current whitelist entry: ", whitelistEntry.toString());
  console.log("New whitelist entry: ", newWhitelistEntry.toString());
}

async function migrateLocker() {
  lockerParams = {
    whitelistEnabled: true,
    minStakeDuration: new anchor.BN(2_592_000), // 1 months
    maxStakeDuration: new anchor.BN(126_230_400), // 4 years
    multiplier: 1,
  };

  await veHoneyProgram.rpc.setLockerParams(lockerParams, {
    accounts: {
      admin: admin.publicKey,
      locker,
    },
    signers: [admin],
  });

  await veHoneyProgram.rpc.migrateLocker(new anchor.BN(1_000), {
    accounts: {
      payer: payer.publicKey,
      base: lockerBase.publicKey,
      locker,
      newBase: newLockerBase.publicKey,
      newLocker,
      governor,
      smartWallet,
      systemProgram: SYSTEM_PROGRAM,
    },
    signers: [lockerBase, newLockerBase],
  });

  const lockerAccount = await veHoneyProgram.account.locker.fetch(locker);

  const newLockerAccount = await veHoneyProgram.account.lockerV2.fetch(
    newLocker
  );

  console.log(lockerAccount);
  console.log(newLockerAccount);
}

async function migrateWhitelist() {
  await veHoneyProgram.rpc.migrateWhitelist({
    accounts: {
      payer: payer.publicKey,
      oldLocker: locker,
      newLocker,
      lockerAdmin: admin.publicKey,
      whitelistEntry,
      newWhitelistEntry,
      systemProgram: SYSTEM_PROGRAM,
    },
    signers: [admin],
  });

  const whitelistEntryAccount =
    await veHoneyProgram.account.whitelistEntry.fetch(whitelistEntry);
  const newWhitelistEntryAccount =
    await veHoneyProgram.account.whitelistEntry.fetch(newWhitelistEntry);

  console.log(whitelistEntryAccount);
  console.log(newWhitelistEntryAccount);
}

(async function dodo() {
  await setupGovernor();
  await migrateLocker();
  await migrateWhitelist();
})()
  .then(() => console.log("Success!"))
  .catch((e) => console.log(e));
