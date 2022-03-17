const fs = require("fs");
const assert = require("assert");
const { exit } = require("process");
import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { ASSOCIATED_TOKEN_PROGRAM_ID, Token } from "@solana/spl-token";
import { VeHoney } from "../target/types/ve_honey";
import * as constants from "./constants";
import { whitelistTestIdl, WhitelistTestTypes } from "./workspace";

// const idl = JSON.parse(fs.readFileSync("./target/idl/ve_honey.json", "utf8"));
// const programId = new anchor.web3.PublicKey(
//   "CKQapf8pWoMddT15grV8UCPjiLCTHa12NRgkKV63Lc7q"
// );
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

  const admin = anchor.web3.Keypair.generate();
  const user1 = anchor.web3.Keypair.generate();
  const user2 = anchor.web3.Keypair.generate();
  let mint: Token;
  const mintAuthority = anchor.web3.Keypair.generate();
  const base = anchor.web3.Keypair.generate();
  let user1Token: anchor.web3.PublicKey,
    user2Token: anchor.web3.PublicKey,
    locker: anchor.web3.PublicKey,
    lockedTokens: anchor.web3.PublicKey,
    escrow1: anchor.web3.PublicKey,
    escrow2: anchor.web3.PublicKey,
    whitelistEntry: anchor.web3.PublicKey;
  const lockerParams = {
    whitelistEnabled: true,
    minStakeDuration: new anchor.BN(1),
    maxStakeDuration: new anchor.BN(5),
    multiplier: 48,
  };
  const testProgramId = anchor.web3.Keypair.generate().publicKey;
  const testProgram = new Program<WhitelistTestTypes>(
    whitelistTestIdl,
    testProgramId
  );

  function sleep(ms: number) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  it("Initialize testing ... ", async () => {
    console.log("Airdrop 1 SOL to payer ...");
    await publicConnection.confirmTransaction(
      await publicConnection.requestAirdrop(payer.publicKey, LAMPORTS_PER_SOL)
    );

    console.log("Airdrop 1 SOL to user1 ...");
    await publicConnection.confirmTransaction(
      await publicConnection.requestAirdrop(user1.publicKey, LAMPORTS_PER_SOL)
    );

    console.log("Airdrop 1 SOL to user2 ...");
    await publicConnection.confirmTransaction(
      await publicConnection.requestAirdrop(user2.publicKey, LAMPORTS_PER_SOL)
    );

    mint = await Token.createMint(
      publicConnection,
      payer,
      mintAuthority.publicKey,
      null,
      6,
      TOKEN_PROGRAM_ID
    );

    user1Token = await mint.createAssociatedTokenAccount(user1.publicKey);
    await mint.mintTo(user1Token, mintAuthority, [], 5000000);
  });

  it("Initialize Locker ...", async () => {
    const lt = program.addEventListener("InitLockerEvent", (e, s) => {
      console.log("Initialize Locker in Slot: ", s);
      console.log("Locker: ", e.locker.toString());
      console.log("Locker admin: ", e.admin.toString());
      console.log("Token mint: ", e.tokenMint.toString());
      console.log("Token address:", e.token_address.toString());
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

    lockedTokens = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      mint.publicKey,
      locker,
      true
    );

    await program.rpc
      .initLocker(admin.publicKey, lockerParams, {
        accounts: {
          payer: payer.publicKey,
          base: base.publicKey,
          locker,
          tokenMint: mint.publicKey,
          lockedTokens,
          systemProgram: SYSTEM_PROGRAM,
        },
        preInstructions: [
          Token.createAssociatedTokenAccountInstruction(
            ASSOCIATED_TOKEN_PROGRAM_ID,
            TOKEN_PROGRAM_ID,
            mint.publicKey,
            lockedTokens,
            locker,
            payer.publicKey
          ),
        ],
        signers: [payer, base],
      })
      .finally(() => {
        setTimeout(() => {
          program.removeEventListener(lt);
        }, 2000);
      });

    const lockerAccount = await program.account.locker.fetch(locker);

    assert.ok(lockerAccount.bump === lockerBump);
    assert.ok(lockerAccount.base.equals(base.publicKey));
    assert.ok(lockerAccount.tokenMint.equals(mint.publicKey));
    assert.ok(lockerAccount.lockedTokens.equals(lockedTokens));
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
    assert.ok(lockerAccount.admin.equals(admin.publicKey));
    assert.ok(lockerAccount.lastEscrowId.eq(new anchor.BN(0)));
  });

  it("Initialize Escrow ...", async () => {
    const lt = program.addEventListener("InitEscrowEvent", (e, s) => {
      console.log("Initialize Escrow in Slot: ", s);
      console.log("Escrow: ", e.escrow.toString());
      console.log("Escrow ID: ", e.escrowId.toString());
      console.log("Locker: ", e.locker.toString());
      console.log("Escrow Owner: ", e.escrow_owner.toString());
      console.log("Timestamp: ", e.timestamp.toString());
    });

    const escrowId = (await program.account.locker.fetch(locker)).lastEscrowId;

    let escrowBump: number;
    [escrow1, escrowBump] = await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from(constants.ESCROW_SEED),
        locker.toBuffer(),
        Buffer.from(escrowId.toString(10)),
        user1.publicKey.toBuffer(),
      ],
      program.programId
    );

    await program.rpc
      .initEscrow({
        accounts: {
          payer: user1.publicKey,
          locker,
          escrow: escrow1,
          escrowOwner: user1.publicKey,
          systemProgram: SYSTEM_PROGRAM,
        },
        signers: [user1],
      })
      .finally(() => {
        setTimeout(() => {
          program.removeEventListener(lt);
        }, 2000);
      });

    const escrowAccount = await program.account.escrow.fetch(escrow1);

    assert.ok(escrowAccount.bump === escrowBump);
    assert.ok(escrowAccount.locker.equals(locker));
    assert.ok(escrowAccount.owner.equals(user1.publicKey));
    assert.ok(escrowAccount.amount.eq(new anchor.BN(0)));
    assert.ok(escrowAccount.escrowStartedAt.eq(new anchor.BN(0)));
    assert.ok(escrowAccount.escrowEndsAt.eq(new anchor.BN(0)));
    assert.ok(escrowAccount.escrowId.eq(escrowId));
    assert.ok(
      (await program.account.locker.fetch(locker)).lastEscrowId.eq(
        escrowAccount.escrowId.add(new anchor.BN(1))
      )
    );
  });

  // it("Approve program lock privilege ...", async () => {
  //   const lt = program.addEventListener("ApproveLockPrivilegeEvent", (e, s) => {
  //     console.log("Approve Program Lock in Slot: ", s);
  //     console.log("Locker: ", e.locker.toString());
  //     console.log("ProgramId: ", e.programId.toString());
  //     console.log("Owner of the Escrow: ", e.owner.toString());
  //     console.log("Timestamp: ", e.timestamp);
  //   });

  //   let whitelistEntryBump: number;
  //   [whitelistEntry, whitelistEntryBump] =
  //     await anchor.web3.PublicKey.findProgramAddress(
  //       [
  //         Buffer.from(constants.WHITELIST_ENTRY_SEED),
  //         locker.toBuffer(),
  //         testProgramId.toBuffer(),
  //         SYSTEM_PROGRAM.toBuffer(),
  //       ],
  //       program.programId
  //     );

  //   await program.rpc
  //     .approveProgramLockPrivilege({
  //       accounts: {
  //         payer: payer.publicKey,
  //         locker,
  //         lockerAdmin: admin.publicKey,
  //         whitelistEntry,
  //         executableId: testProgramId,
  //         whitelistedOwner: SYSTEM_PROGRAM,
  //         systemProgram: SYSTEM_PROGRAM,
  //       },
  //       signers: [payer, admin],
  //     })
  //     .finally(() => {
  //       setTimeout(() => {
  //         program.removeEventListener(lt);
  //       }, 2000);
  //     });

  //   const whitelistEntryAccount = await program.account.whitelistEntry.fetch(
  //     whitelistEntry
  //   );

  //   assert.ok(whitelistEntryAccount.locker.equals(locker));
  //   assert.ok(whitelistEntryAccount.bump === whitelistEntryBump);
  //   assert.ok(whitelistEntryAccount.programId.equals(testProgramId));
  //   assert.ok(whitelistEntryAccount.owner.equals(SYSTEM_PROGRAM));
  // });

  // it("Revoke program lock privilege ...", async () => {});

  const firstLockAmount = 3000000;
  const duration = 2;
  it("Lock tokens to the escrow", async () => {
    const lt = program.addEventListener("LockEvent", (e, s) => {
      console.log("Lock in Slot: ", s);
      console.log("Locker: ", e.locker.toString());
      console.log("Escrow owner: ", e.escrowOwner.toString());
      console.log("Token mint: ", e.tokenMint.toString());
      console.log("Lock amount: ", e.amount.toString());
      console.log("Locked supply: ", e.lockerSupply.toString());
      console.log("Lock duration: ", e.duration.toString());
      console.log("Prev lock ends at: ", e.prevEscrowEndsAt.toString());
      console.log("Next escrow ends at: ", e.nextEscrowEndsAt.toString());
      console.log("Next escrow started at: ", e.nextEscrowStartedAt.toString());
    });

    const userBalanceBefore = (await mint.getAccountInfo(user1Token)).amount;
    const lockerBalanceBefore = (await mint.getAccountInfo(lockedTokens))
      .amount;

    await program.rpc
      .lock(new anchor.BN(firstLockAmount), new anchor.BN(duration), {
        accounts: {
          locker,
          escrow: escrow1,
          lockedTokens,
          escrowOwner: user1.publicKey,
          sourceTokens: user1Token,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
        signers: [user1],
      })
      .finally(() => {
        setTimeout(() => {
          program.removeEventListener(lt);
        }, 2000);
      });

    const userBalanceAfter = (await mint.getAccountInfo(user1Token)).amount;
    const lockerBalanceAfter = (await mint.getAccountInfo(lockedTokens)).amount;

    assert.ok(
      userBalanceBefore.sub(new anchor.BN(firstLockAmount)).eq(userBalanceAfter)
    );
    assert.ok(
      lockerBalanceBefore
        .add(new anchor.BN(firstLockAmount))
        .eq(lockerBalanceAfter)
    );

    const lockerAccount = await program.account.locker.fetch(locker);
    const escrow1Account = await program.account.escrow.fetch(escrow1);

    assert.ok(lockerAccount.lockedSupply.eq(lockerBalanceAfter));
    assert.ok(escrow1Account.amount.eq(new anchor.BN(firstLockAmount)));
    assert.ok(
      escrow1Account.escrowStartedAt
        .add(new anchor.BN(duration))
        .eq(escrow1Account.escrowEndsAt)
    );
  });

  const transferAmount = 2000000;
  it("Transfer Escrow from user1 to user2 ...", async () => {
    const lt = program.addEventListener("TransferEvent", (e, s) => {
      console.log("Transfer in Slot: ", s);
      console.log("Locker: ", e.locker.toString());
      console.log("Sender: ", e.sourceEscrowOwner.toString());
      console.log("Sender Escrow: ", e.sourceEscrow.toString());
      console.log("Next Sender balance: ", e.sourceBalance.toString());
      console.log("Receiver: ", e.destinationEscrowOwner.toString());
      console.log("Receiver Escrow: ", e.destinationEscrow.toString());
      console.log("Next Receiver balance: ", e.destinationBalance.toString());
      console.log("Transfer amount: ", e.amount.toString());
      console.log("Timestamp: ", e.timestamp.toString());
    });

    const escrowId = (await program.account.locker.fetch(locker)).lastEscrowId;
    let escrow2Bump: number;
    [escrow2, escrow2Bump] = await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from(constants.ESCROW_SEED),
        locker.toBuffer(),
        Buffer.from(escrowId.toString(10)),
        user2.publicKey.toBuffer(),
      ],
      program.programId
    );

    const escrow1AccountBefore = await program.account.escrow.fetch(escrow1);

    await program.rpc
      .transfer(new anchor.BN(transferAmount), {
        accounts: {
          locker,
          sourceEscrow: escrow1,
          sourceEscrowOwner: user1.publicKey,
          destinationEscrow: escrow2,
        },
        preInstructions: [
          program.instruction.initEscrow({
            accounts: {
              payer: user1.publicKey,
              locker,
              escrow: escrow2,
              escrowOwner: user2.publicKey,
              systemProgram: SYSTEM_PROGRAM,
            },
          }),
        ],
        signers: [user1],
      })
      .finally(() => {
        setTimeout(() => {
          program.removeEventListener(lt);
        }, 2000);
      });
    const escrow1AccountAfter = await program.account.escrow.fetch(escrow1);
    const escrow2Account = await program.account.escrow.fetch(escrow2);

    assert.ok(
      escrow1AccountBefore.amount
        .sub(new anchor.BN(transferAmount))
        .eq(escrow1AccountAfter.amount)
    );
    assert.ok(escrow2Account.amount.eq(new anchor.BN(transferAmount)));
    assert.ok(
      escrow2Account.escrowEndsAt.eq(escrow1AccountBefore.escrowEndsAt)
    );
    assert.ok(
      escrow2Account.escrowStartedAt.eq(escrow1AccountBefore.escrowStartedAt)
    );
  });

  it("Unlock tokens from Escrow (user2) ...", async () => {
    const lt = program.addEventListener("ExitEscrowEvent", (e, s) => {
      console.log("Exit Escrow in Slot: ", s);
      console.log("Locker: ", e.locker.toString());
      console.log("Escorw Onwer: ", e.escrowOwner.toString());
      console.log("Locked Supply: ", e.lockedSupply.toString());
      console.log("Released Amount: ", e.releasedAmount.toString());
      console.log("Timestamp: ", e.timestamp.toString());
    });

    user2Token = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      mint.publicKey,
      user2.publicKey,
      true
    );

    const lockerAccountBefore = await program.account.locker.fetch(locker);
    const escrow2AccountBefore = await program.account.escrow.fetch(escrow2);

    await sleep(3000);

    await program.rpc
      .exit({
        accounts: {
          payer: user2.publicKey,
          locker,
          escrow: escrow2,
          escrowOwner: user2.publicKey,
          lockedTokens,
          destinationTokens: user2Token,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
        preInstructions: [
          Token.createAssociatedTokenAccountInstruction(
            ASSOCIATED_TOKEN_PROGRAM_ID,
            TOKEN_PROGRAM_ID,
            mint.publicKey,
            user2Token,
            user2.publicKey,
            user2.publicKey
          ),
        ],
        signers: [user2],
      })
      .finally(() => {
        setTimeout(() => {
          program.removeEventListener(lt);
        }, 2000);
      });

    const lockerAccountAfter = await program.account.locker.fetch(locker);

    assert.ok(
      lockerAccountBefore.lockedSupply
        .sub(escrow2AccountBefore.amount)
        .eq(lockerAccountAfter.lockedSupply)
    );
  });
});
