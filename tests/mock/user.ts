import * as anchor from "@project-serum/anchor";
import { AnchorProvider, Program } from "@project-serum/anchor";
import { PublicKey } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  Token,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

import { Stake } from "../../target/types/stake";
import { VeHoney } from "../../target/types/ve_honey";
import { MockStakePool } from "./stakePool";
import { MockWallet } from "./wallet";
import * as constants from "../constants";
import { MockGovernor } from "./governor";

export class MockUser {
  provider: AnchorProvider;
  stakeProgram: Program<Stake>;
  veHoneyProgram: Program<VeHoney>;

  private _poolUser: PublicKey | undefined;
  get poolUser(): PublicKey {
    if (this._poolUser === undefined) {
      throw new Error("pool user undefined");
    }
    return this._poolUser;
  }

  private _escrow: PublicKey | undefined;
  get escrow(): PublicKey {
    if (this.escrow === undefined) {
      throw new Error("escrow undefined");
    }
    return this._escrow;
  }

  private _wallet: MockWallet | undefined;
  get wallet(): MockWallet {
    if (this._wallet === undefined) {
      throw new Error("wallet undefined");
    }
    return this._wallet;
  }

  poolInfo: MockStakePool;
  governor: MockGovernor;

  constructor({ provider, poolInfo, governor }: MockUserArgs) {
    this.provider = provider;
    this.stakeProgram = anchor.workspace.Stake as Program<Stake>;
    this.veHoneyProgram = anchor.workspace.VeHoney as Program<VeHoney>;
    this.poolInfo = poolInfo;
    this.governor = governor;
  }

  public async init() {
    this._wallet = await MockWallet.createWithBalance(this.provider, 1);
    this._poolUser = await this.getPoolUserAddress();
  }

  private async createInitPoolUserTx() {
    return await this.stakeProgram.methods
      .initializeUser()
      .accounts({
        payer: this.wallet.publicKey,
        poolInfo: this.poolInfo.address,
        userInfo: await this.getPoolUserAddress(),
        userOwner: this.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .transaction();
  }

  private async createDepositTx(amount: anchor.BN, owner?: PublicKey) {
    return await this.stakeProgram.methods
      .deposit(amount)
      .accounts({
        poolInfo: this.poolInfo.address,
        userInfo: this.poolUser,
        userOwner: owner ?? this.wallet.publicKey,
        pTokenMint: this.poolInfo.pTokenMint.address,
        source: await this.poolInfo.pTokenMint.getAssociatedTokenAddress(
          this.wallet.publicKey
        ),
        userAuthority: this.wallet.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .transaction();
  }

  private async createClaimTx(owner?: PublicKey) {
    let destination = await this.poolInfo.tokenMint.getAssociatedTokenAddress(
      this.wallet.publicKey
    );
    let preInstruction: anchor.web3.TransactionInstruction | undefined =
      undefined;

    if (
      (await this.poolInfo.tokenMint.tryGetAssociatedTokenAccount(
        this.wallet.publicKey
      )) === null
    ) {
      preInstruction = Token.createAssociatedTokenAccountInstruction(
        ASSOCIATED_TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        this.poolInfo.tokenMint.address,
        destination,
        this.wallet.publicKey,
        this.wallet.publicKey
      );
    }

    return await this.stakeProgram.methods
      .claim()
      .accounts({
        payer: this.wallet.publicKey,
        poolInfo: this.poolInfo.address,
        authority: (await this.poolInfo.getVaultAuthority())[0],
        tokenMint: this.poolInfo.tokenMint.address,
        userInfo: this.poolUser,
        userOwner: owner ?? this.wallet.publicKey,
        destination,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .preInstructions([preInstruction])
      .transaction();
  }

  private async createInitEscrowTx() {
    return await this.veHoneyProgram.methods
      .initEscrow()
      .accounts({
        payer: this.wallet.publicKey,
        locker: this.governor.locker,
        escrow: await this.getEscrowAddress(),
        escrowOwner: this.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .transaction();
  }

  public async deposit({ amount, owner }: DepositArgs) {
    const tx = await this.createDepositTx(amount, owner?.publicKey);
    const sig = await this.provider.sendAndConfirm(
      tx,
      [owner?.payer, this.wallet.payer].filter((s) => s !== undefined),
      {
        skipPreflight: true,
      }
    );
    return sig;
  }

  public async claim(args?: ClaimArgs) {
    const tx = await this.createClaimTx(args?.owner?.publicKey);
    const sig = await this.provider.sendAndConfirm(
      tx,
      [args?.owner?.payer, this.wallet.payer].filter((s) => s !== undefined),
      { skipPreflight: true }
    );
    return sig;
  }

  public async initEscrow() {
    const tx = await this.createInitEscrowTx();
    const sig = await this.provider.sendAndConfirm(tx, [this.wallet.payer], {
      skipPreflight: true,
    });
    return sig;
  }

  public static async create(args: MockUserArgs) {
    const user = new MockUser(args);
    await user.init();
    const tx = await user.createInitPoolUserTx();
    await user.provider.sendAndConfirm(tx, [user.wallet.payer], {
      skipPreflight: true,
    });
    return user;
  }

  public async getPoolUserAddress() {
    const [address] = await PublicKey.findProgramAddress(
      [
        Buffer.from(constants.POOL_USER_SEED),
        this.poolInfo.address.toBuffer(),
        this.wallet.publicKey.toBuffer(),
      ],
      this.stakeProgram.programId
    );
    return address;
  }

  public async getEscrowAddress() {
    const [address] = await PublicKey.findProgramAddress(
      [
        Buffer.from(constants.ESCROW_SEED),
        this.governor.locker.toBuffer(),
        this.wallet.publicKey.toBuffer(),
      ],
      this.veHoneyProgram.programId
    );

    return address;
  }

  public async fetch() {
    return await this.stakeProgram.account.poolUser.fetchNullable(
      this.poolUser
    );
  }
}

export type MockUserArgs = {
  provider: AnchorProvider;
  poolInfo: MockStakePool;
  governor: MockGovernor;
};

export type DepositArgs = {
  amount: anchor.BN;
  owner?: MockWallet;
};

export type ClaimArgs = {
  owner?: MockWallet;
};
