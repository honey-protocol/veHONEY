// Migrations are an early feature. Currently, they're nothing more than this
// single deploy script that's invoked from the CLI, injecting a provider
// configured from the workspace's Anchor.toml.
const fs = require("fs");
import * as anchor from "@project-serum/anchor";
import { TribecaSDK, findGovernorAddress } from "@tribecahq/tribeca-sdk";
import {
  GokiSDK,
  SmartWalletWrapper,
  findSmartWallet,
} from "@gokiprotocol/client";
import { SolanaProvider } from "@saberhq/solana-contrib";
import { TOKEN_PROGRAM_ID } from "@saberhq/token-utils";

import { VeHoney } from "../target/types/ve_honey";
import { Stake } from "../target/types/stake";

const PRINT_FG_GREEN = "\x1b[32m%s\x1b[0m";
const PRINT_FG_RED = "\x1b[31m%s\x1b[0m";

const POOL_INFO_SEED = "PoolInfo";
// const POOL_USER_SEED = "PoolUser";
const TOKEN_VAULT_SEED = "TokenVault";
const VAULT_AUTHORITY_SEED = "VaultAuthority";
const LOCKER_SEED = "Locker";
// const ESCROW_SEED = "Escrow";
const WHITELIST_ENTRY_SEED = "LockerWhitelistEntry";
const TREASURY_SEED = "Treasury";
// const PROOF_SEED = "Proof";
// const NFT_RECEIPT_SEED = "Receipt";
const DEFAULT_DECIMALS = 6;
const PHONEY_MINT = new anchor.web3.PublicKey(
  "65wTy3dVVjixjEC4zTSL1JD7NQuRGmkCaESxgdQzkmAn"
);
const HONEY_MINT = new anchor.web3.PublicKey(
  "24AtJgDkmAPWvLEB7gAnp1UVUK7o82bB9nLCKDUg147n"
);
const WL_TOKEN = new anchor.web3.PublicKey(
  "6iajndRmjjn1Q1sEWsG3psLeD1BZb8wE8gEcV6zLGakF"
);

const lockerBase = anchor.web3.Keypair.fromSecretKey(
  Uint8Array.from(
    JSON.parse(fs.readFileSync(__dirname + "/keys/locker_base.json", "utf8"))
  )
);
const governorBase = anchor.web3.Keypair.fromSecretKey(
  Uint8Array.from(
    JSON.parse(fs.readFileSync(__dirname + "/keys/governor_base.json", "utf8"))
  )
);
const smartWalletBase = anchor.web3.Keypair.fromSecretKey(
  Uint8Array.from(
    JSON.parse(
      fs.readFileSync(__dirname + "/keys/smart_wallet_base.json", "utf8")
    )
  )
);
const owner = anchor.web3.Keypair.fromSecretKey(
  Uint8Array.from(
    JSON.parse(
      fs.readFileSync(__dirname + "/keys/smart_wallet_owner.json", "utf8")
    )
  )
);
const stakePoolOwner = anchor.web3.Keypair.fromSecretKey(
  Uint8Array.from(
    JSON.parse(
      fs.readFileSync(__dirname + "/keys/stake_pool_owner.json", "utf8")
    )
  )
);
const mintAuthority = anchor.web3.Keypair.fromSecretKey(
  Uint8Array.from(
    JSON.parse(fs.readFileSync(__dirname + "/keys/mint_auth.json", "utf8"))
  )
);

function printInfo(message: string) {
  console.log(PRINT_FG_GREEN, message);
}

function printError(message: string) {
  console.log(PRINT_FG_RED, message);
}

async function executeTransactionBySmartWallet({
  smartWalletWrapper,
  instructions,
  proposer,
}: {
  smartWalletWrapper: SmartWalletWrapper;
  instructions: anchor.web3.TransactionInstruction[];
  proposer: anchor.web3.Keypair;
}): Promise<anchor.web3.PublicKey> {
  const { transactionKey, tx: tx1 } = await smartWalletWrapper.newTransaction({
    proposer: proposer.publicKey,
    instructions,
  });

  await tx1.addSigners(proposer).confirm();

  const tx2 = await smartWalletWrapper.executeTransaction({
    transactionKey,
    owner: proposer.publicKey,
  });
  await tx2.addSigners(proposer).confirm();

  return transactionKey;
}

module.exports = async function (provider: anchor.AnchorProvider) {
  // Configure client to use the provider.
  anchor.setProvider(provider);
  const stakeProgram = anchor.workspace.Stake as anchor.Program<Stake>;
  const veHoneyProgram = anchor.workspace.VeHoney as anchor.Program<VeHoney>;

  // Stake pool setup
  const stakePoolParams = {
    startsAt: new anchor.BN(Math.floor(Date.now() / 1000) + 3600),
    claimPeriodUnit: new anchor.BN(1800),
    maxClaimCount: 21,
  };

  const [stakePool] = await anchor.web3.PublicKey.findProgramAddress(
    [
      Buffer.from(POOL_INFO_SEED),
      HONEY_MINT.toBuffer(),
      PHONEY_MINT.toBuffer(),
    ],
    stakeProgram.programId
  );
  const [tokenVault] = await anchor.web3.PublicKey.findProgramAddress(
    [
      Buffer.from(TOKEN_VAULT_SEED),
      HONEY_MINT.toBuffer(),
      PHONEY_MINT.toBuffer(),
    ],
    stakeProgram.programId
  );
  const [vaultAuthority] = await anchor.web3.PublicKey.findProgramAddress(
    [Buffer.from(VAULT_AUTHORITY_SEED), stakePool.toBuffer()],
    stakeProgram.programId
  );

  try {
    const initStakePoolTx = await stakeProgram.methods
      .initialize(stakePoolParams)
      .accounts({
        payer: provider.wallet.publicKey,
        owner: stakePoolOwner.publicKey,
        tokenMint: HONEY_MINT,
        pTokenMint: PHONEY_MINT,
        poolInfo: stakePool,
        tokenVault,
        authority: vaultAuthority,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .transaction();

    await provider.sendAndConfirm(initStakePoolTx, [stakePoolOwner]);
    printInfo("√ Initialized stake pool ...");
  } catch (e) {
    printError("x Stake pool initialization error!");
    // console.error(e);
  }

  try {
    const setMintAuthorityTx = await stakeProgram.methods
      .setMintAuthority()
      .accounts({
        owner: stakePoolOwner.publicKey,
        poolInfo: stakePool,
        tokenMint: HONEY_MINT,
        authority: vaultAuthority,
        originAuthority: mintAuthority.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .transaction();

    await provider.sendAndConfirm(setMintAuthorityTx, [
      stakePoolOwner,
      mintAuthority,
    ]);
    printInfo("√ Replaced mint authority of HONEY with PDA ...");
  } catch (e) {
    printError("x Set mint authority error!");
    // console.error(e);
  }

  // Tribeca and Goki SDKs load
  const governorSDK = TribecaSDK.load({
    provider: SolanaProvider.init({
      connection: provider.connection,
      wallet: provider.wallet,
      opts: { ...provider.opts, commitment: "confirmed" },
    }),
  });
  const gokiSDK = GokiSDK.load({
    provider: governorSDK.provider,
  });

  const [locker] = await anchor.web3.PublicKey.findProgramAddress(
    [Buffer.from(LOCKER_SEED), lockerBase.publicKey.toBuffer()],
    veHoneyProgram.programId
  );

  // Smart wallet and governor setup ======================================

  const [governor] = await findGovernorAddress(governorBase.publicKey);
  const [smartWallet] = await findSmartWallet(smartWalletBase.publicKey);
  let smartWalletWrapper: SmartWalletWrapper;

  try {
    const wk = await gokiSDK.newSmartWallet({
      owners: [owner.publicKey, governor],
      threshold: new anchor.BN(1),
      numOwners: 3,
      base: smartWalletBase,
    });

    smartWalletWrapper = wk.smartWalletWrapper;
    await wk.tx.confirm();
    printInfo("√ Initialized smart wallet ...");
  } catch (e) {
    printError("x Smart wallet creation error!");

    smartWalletWrapper = await gokiSDK.loadSmartWallet(smartWallet);

    if (!smartWalletWrapper.key) {
      throw new Error(e);
    }
  }

  const governorParams = {
    votingDelay: new anchor.BN(1),
    votingPeriod: new anchor.BN(5),
    quorumVotes: new anchor.BN(50).muln(10 ** DEFAULT_DECIMALS),
    timelockDelaySeconds: new anchor.BN(0),
  };

  try {
    const wk = await governorSDK.govern.createGovernor({
      baseKP: governorBase,
      electorate: locker,
      smartWallet,
      ...governorParams,
    });

    await wk.tx.confirm();
    printInfo("√ Initialized governor ...");
    console.log("Governor: ", wk.wrapper.governorKey.toBase58());
  } catch (e) {
    printError("x Governor creation error!");
    // console.error(e);
  }

  // ==================================================================

  // Init locker ======================================================

  const lockerParams = {
    minStakeDuration: new anchor.BN(30),
    maxStakeDuration: new anchor.BN(480),
    whitelistEnabled: true,
    multiplier: 1,
    proposalActivationMinVotes: new anchor.BN(10_000).muln(
      10 ** DEFAULT_DECIMALS
    ),
    nftStakeDurationUnit: new anchor.BN(20),
    nftStakeBaseReward: new anchor.BN(3_750_000_000),
    nftStakeDurationCount: 10,
    nftRewardHalvingStartsAt: 2,
  };

  try {
    const initLockerTx = await veHoneyProgram.methods
      .initLocker(lockerParams)
      .accounts({
        payer: provider.wallet.publicKey,
        base: lockerBase.publicKey,
        locker,
        tokenMint: HONEY_MINT,
        wlTokenMint: WL_TOKEN,
        governor,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .transaction();

    await provider.sendAndConfirm(initLockerTx, [lockerBase]);

    printInfo("√ Initialized locker ...");
  } catch (e) {
    printError("x Locker initialization error!");
    // console.error(e);
  }

  // smartWalletWrapper = await gokiSDK.loadSmartWallet(smartWallet);

  try {
    const setWlMintAuthorityTx = await veHoneyProgram.methods
      .setWlMintAuthority()
      .accounts({
        locker,
        wlTokenMint: WL_TOKEN,
        currentAuthority: mintAuthority.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .transaction();

    await provider.sendAndConfirm(setWlMintAuthorityTx, [mintAuthority]);

    printInfo("√ Replace the authority of WL token with PDA ...");
  } catch (e) {
    printError("x Set WL mint authority error!");
    // console.error(e);
  }

  const [whitelistEntry] = await anchor.web3.PublicKey.findProgramAddress(
    [
      Buffer.from(WHITELIST_ENTRY_SEED),
      locker.toBuffer(),
      stakeProgram.programId.toBuffer(),
      anchor.web3.SystemProgram.programId.toBuffer(),
    ],
    veHoneyProgram.programId
  );

  try {
    const addWhitelistIx = await veHoneyProgram.methods
      .approveProgramLockPrivilege()
      .accounts({
        payer: provider.wallet.publicKey,
        locker,
        whitelistEntry,
        governor,
        smartWallet: smartWalletWrapper.key,
        executableId: stakeProgram.programId,
        whitelistedOwner: anchor.web3.SystemProgram.programId,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .instruction();

    await executeTransactionBySmartWallet({
      smartWalletWrapper,
      instructions: [addWhitelistIx],
      proposer: owner,
    });
    printInfo("√ Approved program lock privilege ...");
  } catch (e) {
    printError("x Approve program lock privilege error!");
    // console.error(e);
  }

  const [treasury] = await anchor.web3.PublicKey.findProgramAddress(
    [Buffer.from(TREASURY_SEED), locker.toBuffer(), HONEY_MINT.toBuffer()],
    veHoneyProgram.programId
  );

  try {
    const initTreasuryTx = await veHoneyProgram.methods
      .initTreasury()
      .accounts({
        payer: provider.wallet.publicKey,
        locker,
        treasury,
        tokenMint: HONEY_MINT,
        governor,
        smartWallet: smartWalletWrapper.key,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .instruction();

    await executeTransactionBySmartWallet({
      smartWalletWrapper,
      instructions: [initTreasuryTx],
      proposer: owner,
    });
    printInfo("√ Initialized treasury ...");
  } catch (e) {
    printError("x Treasury initialization error!");
    // console.error(e);
  }

  console.log("\n");
  console.log("Programs:");
  console.log("  - Stake program: ", stakeProgram.programId.toBase58());
  console.log("  - Locker program: ", veHoneyProgram.programId.toBase58());

  console.log("\n");
  console.log("Stake pool info:");
  console.log("  - Stake pool: ", stakePool.toBase58());
  console.log("  - Stake pool authority: ", vaultAuthority.toBase58());
  console.log("  - HONEY: ", HONEY_MINT.toBase58());
  console.log("  - pHONEY: ", PHONEY_MINT.toBase58());
  console.log("  - Parameters:");
  console.log(
    "    Pool start timestamp: ",
    stakePoolParams.startsAt.toNumber()
  );
  console.log(
    "    Claim period (timestamp): ",
    stakePoolParams.claimPeriodUnit.toNumber()
  );
  console.log("    Max claim count: ", stakePoolParams.maxClaimCount);

  console.log("\n");
  console.log("Locker info:");
  console.log("  - Locker: ", locker.toBase58());
  console.log("  - Smart wallet: ", smartWalletWrapper.key.toBase58());
  console.log("  - Smart wallet owner: ", owner.publicKey.toBase58());
  console.log("  - Governor: ", governor.toBase58());
  console.log("  - Treasury: ", treasury.toBase58());
  console.log("  - HGB Whitelist Token: ", WL_TOKEN.toBase58());
  console.log("  - Parameters:");
  console.log(
    "    Min stake duration: ",
    lockerParams.minStakeDuration.toNumber()
  );
  console.log(
    "    Max stake duration: ",
    lockerParams.maxStakeDuration.toNumber()
  );
  console.log(
    "    Whitelist: ",
    lockerParams.whitelistEnabled ? "Enabled" : "Disabled"
  );
  console.log(
    "    Proposal activation votes: ",
    lockerParams.proposalActivationMinVotes.toNumber() / 10 ** DEFAULT_DECIMALS
  );
  console.log(
    "    NFT stake duration unit: ",
    lockerParams.nftStakeDurationUnit.toNumber()
  );
  console.log(
    "    NFT stake base reward: ",
    lockerParams.nftStakeBaseReward.toNumber() / 10 ** DEFAULT_DECIMALS
  );
  console.log(
    "    NFT stake duration count: ",
    lockerParams.nftStakeDurationCount
  );
  console.log(
    "    NFT reward halving start at: ",
    lockerParams.nftRewardHalvingStartsAt
  );
};
