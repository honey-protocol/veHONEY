// Migrations are an early feature. Currently, they're nothing more than this
// single deploy script that's invoked from the CLI, injecting a provider
// configured from the workspace's Anchor.toml.
const fs = require("fs");

import * as anchor from "@project-serum/anchor";
import {
  TribecaSDK,
  findGovernorAddress,
  GovernorWrapper,
} from "@tribecahq/tribeca-sdk";
import {
  GokiSDK,
  SmartWalletWrapper,
  findSmartWallet,
} from "@gokiprotocol/client";
import { SolanaProvider, Provider } from "@saberhq/solana-contrib";

import { VeHoney } from "../target/types/ve_honey";
import { Stake } from "../target/types/stake";
import { TOKEN_PROGRAM_ID } from "@saberhq/token-utils";

const LOCKER_SEED = "Locker";
const ESCROW_SEED = "Escrow";
const WHITELIST_ENTRY_SEED = "LockerWhitelistEntry";
const TREASURY_SEED = "Treasury";
const PROOF_SEED = "Proof";
const NFT_RECEIPT_SEED = "Receipt";
const DEFAULT_DECIMALS = 6;
const PHONEY_MINT = new anchor.web3.PublicKey(
  "7unYPivFG6cuDGeDVjhbutcjYDcMKPu2mBCnRyJ5Qki2"
);
const HONEY_MINT = new anchor.web3.PublicKey(
  "Bh7vMfPZkGsQJqUjBBGGfcAj6yQdkL8SoLtK5TCYeJtY"
);
const WL_TOKEN = new anchor.web3.PublicKey(
  "ETAEDhSfR5Arh9X7G146Ke1PDnkhP8FQVso8rdz38H7J"
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
    JSON.parse(fs.readFileSync(__dirname + "/keys/owner.json", "utf8"))
  )
);

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

  console.log("Locker base: ", lockerBase.publicKey.toBase58());
  console.log("Governor base: ", governorBase.publicKey.toBase58());
  console.log("Smart wallet base: ", smartWalletBase.publicKey.toBase58());
  console.log("Owner SM: ", owner.publicKey.toBase58());

  const [locker] = await anchor.web3.PublicKey.findProgramAddress(
    [Buffer.from(LOCKER_SEED), lockerBase.publicKey.toBuffer()],
    veHoneyProgram.programId
  );

  console.log("Locker: ", locker.toBase58());

  // Smart wallet and governor setup ======================================

  const [governor] = await findGovernorAddress(governorBase.publicKey);
  const [smartWallet] = await findSmartWallet(smartWalletBase.publicKey);
  let smartWalletWrapper: SmartWalletWrapper;
  let governorWrapper: GovernorWrapper;

  try {
    const wk = await gokiSDK.newSmartWallet({
      owners: [owner.publicKey, governor],
      threshold: new anchor.BN(1),
      numOwners: 3,
      base: smartWalletBase,
    });

    smartWalletWrapper = wk.smartWalletWrapper;
    await wk.tx.confirm();
  } catch (e) {
    console.error("Smart wallet creation error!");

    smartWalletWrapper = await gokiSDK.loadSmartWallet(smartWallet);

    if (!smartWalletWrapper.key) {
      throw new Error(e);
    }
  }

  console.log("Smart wallet: ", smartWalletWrapper.key.toBase58());

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
    console.log("Governor: ", wk.wrapper.governorKey.toBase58());
  } catch (e) {
    console.error("Governor creation error!");
    console.error(e);
  }

  // ==================================================================

  // Init locker ======================================================

  const lockerParams = {
    minStakeDuration: new anchor.BN(10),
    maxStakeDuration: new anchor.BN(40),
    whitelistEnabled: true,
    multiplier: 1,
    proposalActivationMinVotes: new anchor.BN(10).muln(10 ** 6),
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

    console.log("Initialized locker ...");
  } catch (e) {
    console.error("Locker initialization error!");
    console.error(e);
  }

  // smartWalletWrapper = await gokiSDK.loadSmartWallet(smartWallet);

  try {
    const setWlMintAuthorityTx = await veHoneyProgram.methods
      .setWlMintAuthority()
      .accounts({
        locker,
        wlTokenMint: WL_TOKEN,
        currentAuthority: provider.wallet.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .transaction();

    await provider.sendAndConfirm(setWlMintAuthorityTx);

    console.log("Replace the authority of WL token with PDA ...");
  } catch (e) {
    console.error("Set WL mint authority error!");
    console.log(e);
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
  } catch (e) {
    console.error("Approve program lock privilege error!");
    console.log(e);
  }

  console.log("Approved program lock privilege ...");

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
  } catch (e) {
    console.error("Treasury initialization error!");
    console.log(e);
  }

  console.log("Initialized treasury ...");
};
