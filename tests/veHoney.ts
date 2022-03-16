const fs = require("fs");
const assert = require("assert");
import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { Token } from "@solana/spl-token";
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
  let userToken: anchor.web3.PublicKey, locker: anchor.web3.PublicKey;
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
    let lockerBump: number;
    [locker, lockerBump] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from(constants.LOCKER_SEED), base.publicKey.toBuffer()],
      program.programId
    );

    await program.rpc.initLocker(lockerParams, {
      accounts: {
        payer: payer.publicKey,
        base: base.publicKey,
        locker,
        tokenMint: mint.publicKey,
        systemProgram: SYSTEM_PROGRAM,
      },
      signers: [payer, base],
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
});
