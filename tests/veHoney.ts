const assert = require("assert");
import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { ASSOCIATED_TOKEN_PROGRAM_ID, Token } from "@solana/spl-token";
import { VeHoney } from "../target/types/ve_honey";
import { Stake } from "../target/types/stake";
import * as constants from "./constants";

// const idl = JSON.parse(fs.readFileSync("./target/idl/ve_honey.json", "utf8"));
// const programId = new anchor.web3.PublicKey(
//   "CKQapf8pWoMddT15grV8UCPjiLCTHa12NRgkKV63Lc7q"
// );
// const clusterUrl = "https://api.devnet.solana.com";
const clusterUrl = "http://127.0.0.1:8899";

interface PoolParams {
  startsAt: anchor.BN;
  claimPeriodUnit: anchor.BN;
  maxClaimCount: number;
}

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
  const user = anchor.web3.Keypair.generate();
  let honeyMint: Token;
  let pHoneyMint: Token;
  const honeyMintAuthority = anchor.web3.Keypair.generate();
  const pHoneyMintAuthority = anchor.web3.Keypair.generate();
  const base = anchor.web3.Keypair.generate();
  let stakePool: anchor.web3.PublicKey,
    poolUser: anchor.web3.PublicKey,
    userPHoneyToken: anchor.web3.PublicKey,
    userHoneyToken: anchor.web3.PublicKey,
    locker: anchor.web3.PublicKey,
    escrow: anchor.web3.PublicKey,
    lockedTokens: anchor.web3.PublicKey,
    whitelistEntry: anchor.web3.PublicKey;
  let poolParams: PoolParams;
  const lockerParams = {
    whitelistEnabled: true,
    minStakeDuration: new anchor.BN(1),
    maxStakeDuration: new anchor.BN(5),
    multiplier: 48,
  };
  const stakeProgram = anchor.workspace.Stake as Program<Stake>;
  let tokenVault: anchor.web3.PublicKey,
    tokenVaultBump: number,
    vaultAuthority: anchor.web3.PublicKey,
    vaultAuthorityBump: number;

  function sleep(ms: number) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  it("Initialize testing ... ", async () => {
    console.log("Airdrop 1 SOL to payer ...");
    await publicConnection.confirmTransaction(
      await publicConnection.requestAirdrop(payer.publicKey, LAMPORTS_PER_SOL),
      "finalized"
    );

    console.log("Airdrop 1 SOL to user ...");
    await publicConnection.confirmTransaction(
      await publicConnection.requestAirdrop(user.publicKey, LAMPORTS_PER_SOL),
      "finalized"
    );

    honeyMint = await Token.createMint(
      publicConnection,
      payer,
      honeyMintAuthority.publicKey,
      null,
      6,
      TOKEN_PROGRAM_ID
    );

    pHoneyMint = await Token.createMint(
      publicConnection,
      payer,
      pHoneyMintAuthority.publicKey,
      null,
      6,
      TOKEN_PROGRAM_ID
    );

    userPHoneyToken = await pHoneyMint.createAssociatedTokenAccount(
      user.publicKey
    );
    await pHoneyMint.mintTo(userPHoneyToken, pHoneyMintAuthority, [], 5000000);
  });

  it("Initialize Locker ...", async () => {
    const lt = program.addEventListener("InitLockerEvent", (e, s) => {
      console.log("Initialize Locker in Slot: ", s);
      console.log("Locker: ", e.locker.toString());
      console.log("Locker admin: ", e.admin.toString());
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
      .initLocker(admin.publicKey, lockerParams, {
        accounts: {
          payer: payer.publicKey,
          base: base.publicKey,
          locker,
          tokenMint: honeyMint.publicKey,
          systemProgram: SYSTEM_PROGRAM,
        },
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
    assert.ok(lockerAccount.tokenMint.equals(honeyMint.publicKey));
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
  });

  it("Approve program lock privilege ...", async () => {
    const lt = program.addEventListener("ApproveLockPrivilegeEvent", (e, s) => {
      console.log("Approve Program Lock in Slot: ", s);
      console.log("Locker: ", e.locker.toString());
      console.log("ProgramId: ", e.programId.toString());
      console.log("Owner of the Escrow: ", e.owner.toString());
      console.log("Timestamp: ", e.timestamp.toString());
    });

    let whitelistEntryBump: number;
    [whitelistEntry, whitelistEntryBump] =
      await anchor.web3.PublicKey.findProgramAddress(
        [
          Buffer.from(constants.WHITELIST_ENTRY_SEED),
          locker.toBuffer(),
          stakeProgram.programId.toBuffer(),
          SYSTEM_PROGRAM.toBuffer(),
        ],
        program.programId
      );

    await program.rpc
      .approveProgramLockPrivilege({
        accounts: {
          payer: payer.publicKey,
          locker,
          lockerAdmin: admin.publicKey,
          whitelistEntry,
          executableId: stakeProgram.programId,
          whitelistedOwner: SYSTEM_PROGRAM,
          systemProgram: SYSTEM_PROGRAM,
        },
        signers: [payer, admin],
      })
      .finally(() => {
        setTimeout(() => {
          program.removeEventListener(lt);
        }, 2000);
      });

    const whitelistEntryAccount = await program.account.whitelistEntry.fetch(
      whitelistEntry
    );

    assert.ok(whitelistEntryAccount.locker.equals(locker));
    assert.ok(whitelistEntryAccount.bump === whitelistEntryBump);
    assert.ok(whitelistEntryAccount.programId.equals(stakeProgram.programId));
    assert.ok(whitelistEntryAccount.owner.equals(SYSTEM_PROGRAM));
  });

  it("Initialize stake program and pool ...", async () => {
    [tokenVault, tokenVaultBump] =
      await anchor.web3.PublicKey.findProgramAddress(
        [
          Buffer.from(constants.TOKEN_VAULT_SEED),
          honeyMint.publicKey.toBuffer(),
          pHoneyMint.publicKey.toBuffer(),
        ],
        stakeProgram.programId
      );

    [stakePool] = await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from(constants.POOL_INFO_SEED),
        honeyMint.publicKey.toBuffer(),
        pHoneyMint.publicKey.toBuffer(),
      ],
      stakeProgram.programId
    );

    [vaultAuthority, vaultAuthorityBump] =
      await anchor.web3.PublicKey.findProgramAddress(
        [Buffer.from(constants.VAULT_AUTHORITY_SEED), stakePool.toBuffer()],
        stakeProgram.programId
      );

    poolParams = {
      startsAt: new anchor.BN(Math.floor(Date.now() / 1000) + 1),
      claimPeriodUnit: new anchor.BN(1),
      maxClaimCount: 21,
    };

    await stakeProgram.rpc.initialize(poolParams, {
      accounts: {
        payer: payer.publicKey,
        owner: admin.publicKey,
        tokenMint: honeyMint.publicKey,
        pTokenMint: pHoneyMint.publicKey,
        poolInfo: stakePool,
        tokenVault,
        authority: vaultAuthority,
        systemProgram: SYSTEM_PROGRAM,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      },
      signers: [admin],
    });

    const tokenVaultAccount = await honeyMint.getAccountInfo(tokenVault);

    assert.ok(tokenVaultAccount.mint.equals(honeyMint.publicKey));
    assert.ok(tokenVaultAccount.owner.equals(vaultAuthority));

    const poolInfoAccount = await stakeProgram.account.poolInfo.fetch(
      stakePool
    );
    assert.ok(poolInfoAccount.version === constants.STAKE_POOL_VERSION);
    assert.ok(poolInfoAccount.bump === vaultAuthorityBump);
    assert.ok(poolInfoAccount.tokenMint.equals(honeyMint.publicKey));
    assert.ok(poolInfoAccount.pTokenMint.equals(pHoneyMint.publicKey));
    assert.ok(poolInfoAccount.owner.equals(admin.publicKey));
    assert.ok(poolInfoAccount.params.startsAt.eq(poolParams.startsAt));
    assert.ok(
      poolInfoAccount.params.claimPeriodUnit.eq(poolParams.claimPeriodUnit)
    );
    assert.ok(
      poolInfoAccount.params.maxClaimCount === poolParams.maxClaimCount
    );
  });

  it("Modify params for pool info ...", async () => {
    poolParams = {
      startsAt: new anchor.BN(Math.floor(Date.now() / 1000) + 2),
      claimPeriodUnit: new anchor.BN(1),
      maxClaimCount: 21,
    };
    await stakeProgram.rpc.modifyParams(poolParams, {
      accounts: {
        owner: admin.publicKey,
        poolInfo: stakePool,
      },
      signers: [admin],
    });

    const poolInfoAccount = await stakeProgram.account.poolInfo.fetch(
      stakePool
    );
    assert.ok(poolInfoAccount.params.startsAt.eq(poolParams.startsAt));
    assert.ok(
      poolInfoAccount.params.claimPeriodUnit.eq(poolParams.claimPeriodUnit)
    );
    assert.ok(
      poolInfoAccount.params.maxClaimCount === poolParams.maxClaimCount
    );
  });

  it("Set mint authority of Honey token to PDA ...", async () => {
    await stakeProgram.rpc.setMintAuthority({
      accounts: {
        owner: admin.publicKey,
        poolInfo: stakePool,
        tokenMint: honeyMint.publicKey,
        authority: vaultAuthority,
        originAuthority: honeyMintAuthority.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      signers: [honeyMintAuthority, admin],
    });

    const honeyMintAccount = await honeyMint.getMintInfo();

    assert.ok(honeyMintAccount.mintAuthority.equals(vaultAuthority));
  });

  const depositAmount = 2000000;
  it("Deposit pHoney to pool ...", async () => {
    [poolUser] = await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from(constants.POOL_USER_SEED),
        stakePool.toBuffer(),
        user.publicKey.toBuffer(),
      ],
      stakeProgram.programId
    );

    const initializeIx = stakeProgram.instruction.initializeUser({
      accounts: {
        payer: user.publicKey,
        poolInfo: stakePool,
        userInfo: poolUser,
        userOwner: user.publicKey,
        systemProgram: SYSTEM_PROGRAM,
      },
      signers: [user],
    });

    await stakeProgram.rpc.deposit(new anchor.BN(depositAmount), {
      accounts: {
        poolInfo: stakePool,
        userInfo: poolUser,
        userOwner: user.publicKey,
        pTokenMint: pHoneyMint.publicKey,
        source: userPHoneyToken,
        userAuthority: user.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      preInstructions: [initializeIx],
      signers: [user],
    });

    const poolUserAccount = await stakeProgram.account.poolUser.fetch(poolUser);
    assert.ok(poolUserAccount.depositAmount.eq(new anchor.BN(depositAmount)));
    assert.ok(poolUserAccount.claimedAmount.eq(new anchor.BN(0)));
    assert.ok(poolUserAccount.count === 0);
    assert.ok(poolUserAccount.poolInfo.equals(stakePool));
    assert.ok(poolUserAccount.owner.equals(user.publicKey));
  });

  it("Claim Honey ...", async () => {
    await sleep(3000);

    userHoneyToken = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      honeyMint.publicKey,
      user.publicKey
    );

    await stakeProgram.rpc.claim({
      accounts: {
        payer: user.publicKey,
        poolInfo: stakePool,
        authority: vaultAuthority,
        tokenMint: honeyMint.publicKey,
        userInfo: poolUser,
        userOwner: user.publicKey,
        destination: userHoneyToken,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      preInstructions: [
        Token.createAssociatedTokenAccountInstruction(
          ASSOCIATED_TOKEN_PROGRAM_ID,
          TOKEN_PROGRAM_ID,
          honeyMint.publicKey,
          userHoneyToken,
          user.publicKey,
          user.publicKey
        ),
      ],
      signers: [user],
    });

    const honeyTokenAccount = await honeyMint.getAccountInfo(userHoneyToken);
    assert.ok(honeyTokenAccount.amount.gt(new anchor.BN(0)));
    console.log("Claimed $Honey: ", honeyTokenAccount.amount.toString());
    const poolUserAccount = await stakeProgram.account.poolUser.fetch(poolUser);
    assert.ok(poolUserAccount.claimedAmount.gt(new anchor.BN(0)));
    assert.ok(poolUserAccount.count > 0);
  });

  const stakeAmount = 3000000;
  const duration = 3;
  it("Stake pHoney tokens to lock Honey and get Escrow ...", async () => {
    const lt1 = program.addEventListener("LockEvent", (e, s) => {
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

    const lt2 = program.addEventListener("InitEscrowEvent", (e, s) => {
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

    lockedTokens = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      honeyMint.publicKey,
      escrow,
      true
    );

    await stakeProgram.rpc
      .stake(new anchor.BN(stakeAmount), new anchor.BN(duration), {
        accounts: {
          poolInfo: stakePool,
          tokenMint: honeyMint.publicKey,
          pTokenMint: pHoneyMint.publicKey,
          pTokenFrom: userPHoneyToken,
          userAuthority: user.publicKey,
          tokenVault,
          authority: vaultAuthority,
          locker,
          escrow,
          lockedTokens,
          lockerProgram: program.programId,
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
            user.publicKey
          ),
          program.instruction.initEscrow({
            accounts: {
              payer: user.publicKey,
              locker,
              escrow: escrow,
              escrowOwner: user.publicKey,
              systemProgram: SYSTEM_PROGRAM,
            },
            signers: [user],
          }),
        ],
        signers: [user],
      })
      .finally(() => {
        setTimeout(() => {
          program.removeEventListener(lt1);
          program.removeEventListener(lt2);
        }, 2000);
      });

    const escrowAccount = await program.account.escrow.fetch(escrow);

    assert.ok(escrowAccount.bump === escrowBump);
    assert.ok(escrowAccount.locker.equals(locker));
    assert.ok(escrowAccount.owner.equals(user.publicKey));
    assert.ok(escrowAccount.amount.eq(new anchor.BN(stakeAmount * 5)));
    assert.ok(
      escrowAccount.escrowStartedAt
        .add(new anchor.BN(duration))
        .eq(escrowAccount.escrowEndsAt)
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

    const lockerAccountBefore = await program.account.locker.fetch(locker);
    const escrowAccountBefore = await program.account.escrow.fetch(escrow);

    await sleep(5000);

    await program.rpc
      .exit({
        accounts: {
          payer: user.publicKey,
          locker,
          escrow,
          escrowOwner: user.publicKey,
          lockedTokens,
          destinationTokens: userHoneyToken,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
        signers: [user],
      })
      .finally(() => {
        setTimeout(() => {
          program.removeEventListener(lt);
        }, 2000);
      });

    const lockerAccountAfter = await program.account.locker.fetch(locker);

    assert.ok(
      lockerAccountBefore.lockedSupply
        .sub(escrowAccountBefore.amount)
        .eq(lockerAccountAfter.lockedSupply)
    );
  });

  it("Reclaim mint authority of Honey mint ...", async () => {
    await stakeProgram.rpc.reclaimMintAuthority(honeyMintAuthority.publicKey, {
      accounts: {
        owner: admin.publicKey,
        poolInfo: stakePool,
        tokenMint: honeyMint.publicKey,
        authority: vaultAuthority,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      signers: [admin],
    });

    const honeyMintAccount = await honeyMint.getMintInfo();
    assert.ok(
      honeyMintAccount.mintAuthority.equals(honeyMintAuthority.publicKey)
    );
  });

  it("Revoke program lock privilege ...", async () => {
    const lt = program.addEventListener("RevokeLockPrivilegeEvent", (e, s) => {
      console.log("Revoke lock privilege in Slot: ", s);
      console.log("Locker: ", e.locker.toString());
      console.log("ProgramId: ", e.programId.toString());
      console.log("Timestamp: ", e.timestamp.toString());
    });

    await program.rpc
      .revokeProgramLockPrivilege({
        accounts: {
          payer: payer.publicKey,
          locker,
          lockerAdmin: admin.publicKey,
          whitelistEntry,
          executableId: stakeProgram.programId,
        },
        signers: [admin],
      })
      .finally(() => {
        setTimeout(() => {
          program.removeEventListener(lt);
        }, 2000);
      });

    try {
      await program.account.whitelistEntry.fetch(whitelistEntry);
    } catch (_) {
      assert.ok(true);
    }
  });
});
