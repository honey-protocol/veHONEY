import * as anchor from "@project-serum/anchor";
import { AnchorProvider, Program } from "@project-serum/anchor";
import { PublicKey } from "@solana/web3.js";

import { Stake } from "../../target/types/stake";
import { VeHoney } from "../../target/types/ve_honey";
import { MockStakePool } from "./stakePool";
import { MockWallet } from "./wallet";
import * as constants from "../constants";

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

  constructor({ provider, poolInfo }: MockUserArgs) {
    this.provider = provider;
    this.stakeProgram = anchor.workspace.Stake as Program<Stake>;
    this.veHoneyProgram = anchor.workspace.VeHoney as Program<VeHoney>;
    this.poolInfo = poolInfo;
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

  public async fetch() {
    return await this.stakeProgram.account.poolUser.fetchNullable(
      this.poolUser
    );
  }
}

export type MockUserArgs = {
  provider: AnchorProvider;
  poolInfo: MockStakePool;
};
