const fs = require("fs");
const assert = require("assert");
const { exit } = require("process");
import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { ASSOCIATED_TOKEN_PROGRAM_ID, Token } from "@solana/spl-token";
import { VeHoney } from "../target/types/ve_honey";
import * as constants from "./constants";

const idl = JSON.parse(fs.readFileSync("./target/idl/ve_honey.json", "utf8"));
const programId = new anchor.web3.PublicKey(
  "CKQapf8pWoMddT15grV8UCPjiLCTHa12NRgkKV63Lc7q"
);
// const clusterUrl = "https://api.devnet.solana.com";
const clusterUrl = "http://127.0.0.1:8899";

describe("veHoney Test", () => {
  const payer = anchor.web3.Keypair.generate();

  const connection = new anchor.web3.Connection(clusterUrl, "processed");
  const provider = new anchor.Provider(connection, new anchor.Wallet(payer), {
    skipPreflight: false,
    preflightCommitment: "processed",
    commitment: "processed",
  });
  anchor.setProvider(provider);
  const program = anchor.workspace.VeHoney as Program<VeHoney>;
  const publicConnection = new anchor.web3.Connection(clusterUrl, {
    commitment: "processed",
  });

  const SYSTEM_PROGRAM = anchor.web3.SystemProgram.programId;
  const TOKEN_PROGRAM_ID = anchor.Spl.token().programId;
  const LAMPORTS_PER_SOL = anchor.web3.LAMPORTS_PER_SOL;

  const user = anchor.web3.Keypair.generate();
  let mint: Token;
  const mintAuthority = anchor.web3.Keypair.generate();
  const base = anchor.web3.Keypair.generate();
  let userToken: anchor.web3.PublicKey,
    locker: anchor.web3.PublicKey,
    escrow: anchor.web3.PublicKey;
  const lockerParams = {
    whitelistEnabled: true,
    minStakeDuration: new anchor.BN(2_592_000), // 30 days
    maxStakeDuration: new anchor.BN(31_536_000), // 4 years
    multiplier: 48,
  };

  it("Initialize testing ... ", async () => {
    console.log("Airdrop 1 SOL to payer ...");
    await publicConnection.confirmTransaction(
      await publicConnection.requestAirdrop(payer.publicKey, LAMPORTS_PER_SOL)
    );

    console.log("Airdrop 1 SOL to user ...");
    await publicConnection.confirmTransaction(
      await publicConnection.requestAirdrop(user.publicKey, LAMPORTS_PER_SOL)
    );

    mint = await Token.createMint(
      publicConnection,
      payer,
      mintAuthority.publicKey,
      null,
      6,
      TOKEN_PROGRAM_ID
    );

    userToken = await mint.createAssociatedTokenAccount(user.publicKey);
    await mint.mintTo(userToken, mintAuthority, [], 5000000);
  });

  it("Initialize Locker ...", async () => {
    const lt = program.addEventListener("InitLockerEvent", (e, s) => {
      console.log("Initialize Locker in Slot: ", s);
      console.log("Locker: ", e.locker.toString());
      console.log("Token mint: ", e.tokenMint.toString());
      console.log("Min stake duration: ", e.params.minStakeDuration.toString());
      console.log("Max stake duration: ", e.params.maxStakeDuration.toString());
      console.log("Multiplier: ", e.params.multiplier);
      console.log(
        "Whitelist: ",
        e.params.whitelistEnabled ? "Enabled" : "Disabled"
      );
    });

    let lockerBump: number;
    [locker, lockerBump] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from(constants.LOCKER_SEED), base.publicKey.toBuffer()],
      program.programId
    );

    await program.rpc
      .initLocker(lockerParams, {
        accounts: {
          payer: payer.publicKey,
          base: base.publicKey,
          locker,
          tokenMint: mint.publicKey,
          systemProgram: SYSTEM_PROGRAM,
        },
        signers: [payer, base],
      })
      .then((_) => {
        program.removeEventListener(lt);
      });

    const lockerAccount = await program.account.locker.fetch(locker);

    assert.ok(lockerAccount.bump === lockerBump);
    assert.ok(lockerAccount.base.equals(base.publicKey));
    assert.ok(lockerAccount.tokenMint.equals(mint.publicKey));
    assert.ok(lockerAccount.lockedSupply.eq(new anchor.BN(0)));
    assert.ok(
      lockerAccount.params.maxStakeDuration.eq(lockerParams.maxStakeDuration)
    );
    assert.ok(
      lockerAccount.params.minStakeDuration.eq(lockerParams.minStakeDuration)
    );
    assert.ok(lockerAccount.params.multiplier === lockerParams.multiplier);
    assert.ok(
      lockerAccount.params.whitelistEnabled === lockerParams.whitelistEnabled
    );
  });

  it("Initialize Escrow ...", async () => {
    const lt = program.addEventListener("InitEscrowEvent", (e, s) => {
      console.log("Initialize Escrow in Slot: ", s);
      console.log("Escrow: ", e.escrow.toString());
      console.log("Locker: ", e.locker.toString());
      console.log("Escrow Owner: ", e.escrow_owner.toString());
      console.log("Timestamp: ", e.timestamp.toString());
    });

    let escrowBump: number;
    [escrow, escrowBump] = await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from(constants.ESCROW_SEED),
        locker.toBuffer(),
        user.publicKey.toBuffer(),
      ],
      program.programId
    );

    await program.rpc.initEscrow({
      accounts: {
        payer: user.publicKey,
        locker,
        escrow,
        escrowOwner: user.publicKey,
        systemProgram: SYSTEM_PROGRAM,
      },
      signers: [user],
    });

    const assTokens = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      mint.publicKey,
      escrow,
      true
    );

    const escrowAccount = await program.account.escrow.fetch(escrow);
    assert.ok(escrowAccount.bump === escrowBump);
    assert.ok(escrowAccount.locker.equals(locker));
    assert.ok(escrowAccount.owner.equals(user.publicKey));
    assert.ok(escrowAccount.tokens.equals(assTokens));
    assert.ok(escrowAccount.amount.eq(new anchor.BN(0)));
    assert.ok(escrowAccount.escrowStartedAt.eq(new anchor.BN(0)));
    assert.ok(escrowAccount.escrowEndsAt.eq(new anchor.BN(0)));
  });
});
