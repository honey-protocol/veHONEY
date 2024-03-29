import * as anchor from "@project-serum/anchor";
import { AnchorProvider, Program } from "@project-serum/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

import { Stake } from "../../target/types/stake";
import { MockWallet } from "./wallet";
import { MockMint } from "./mint";
import * as constants from "../constants";

export class MockStakePool {
  provider: AnchorProvider;
  program: Program<Stake>;

  private _address: PublicKey | undefined;
  get address(): PublicKey {
    if (this._address === undefined) {
      throw new Error("address undefined");
    }
    return this._address;
  }

  version: number;
  pTokenMint: MockMint;
  tokenMint: MockMint;
  owner: MockWallet;
  params: StakePoolParams;

  constructor({
    provider,
    version,
    pTokenMint,
    tokenMint,
    owner,
    params,
  }: MockStakePoolArgs) {
    this.provider = provider;
    this.program = anchor.workspace.Stake as Program<Stake>;
    this.version = version;
    this.pTokenMint = pTokenMint;
    this.tokenMint = tokenMint;
    this.owner = owner;
    this.params = params;
  }

  public async init() {
    this._address = (await this.getPoolInfoAddress())[0];
  }

  private async createInitStakePoolTx() {
    return await this.program.methods
      .initialize({
        startsAt: this.params.startsAt,
        claimPeriodUnit: this.params.claimPeriodUnit,
        maxClaimCount: this.params.maxClaimCount,
      })
      .accounts({
        payer: this.owner.publicKey,
        owner: this.owner.publicKey,
        tokenMint: this.tokenMint.address,
        pTokenMint: this.pTokenMint.address,
        poolInfo: this.address,
        tokenVault: (await this.getTokenVaultAddress())[0],
        authority: (await this.getVaultAuthority())[0],
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .transaction();
  }

  private async createModifyParamsTx(
    params: StakePoolParams,
    owner?: PublicKey
  ) {
    return await this.program.methods
      .modifyParams(params)
      .accounts({
        owner: owner ?? this.owner.publicKey,
        poolInfo: this.address,
      })
      .transaction();
  }

  private async createSetOwnerTx(newOwner: PublicKey, owner?: PublicKey) {
    return await this.program.methods
      .setOwner(newOwner)
      .accounts({
        owner: owner ?? this.owner.publicKey,
        poolInfo: this.address,
      })
      .transaction();
  }

  private async createSetMintAuthorityTx(
    mintAuthority?: PublicKey,
    owner?: PublicKey
  ) {
    return await this.program.methods
      .setMintAuthority()
      .accounts({
        owner: owner ?? this.owner.publicKey,
        poolInfo: this.address,
        tokenMint: this.tokenMint.address,
        authority: (await this.getVaultAuthority())[0],
        originAuthority: mintAuthority ?? this.tokenMint.payer.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .transaction();
  }

  private async createReclaimMintAuthorityTx(
    mintAuthority: PublicKey,
    owner?: PublicKey
  ) {
    return await this.program.methods
      .reclaimMintAuthority(mintAuthority)
      .accounts({
        owner: owner ?? this.owner.publicKey,
        poolInfo: this.address,
        tokenMint: this.tokenMint.address,
        authority: (await this.getVaultAuthority())[0],
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .transaction();
  }

  public async modifyParams(args: ModifyParamsArgs) {
    const tx = await this.createModifyParamsTx(
      args.params,
      args.owner?.publicKey
    );
    const sig = await this.provider.sendAndConfirm(
      tx,
      [args.owner?.payer ?? this.owner.payer],
      { skipPreflight: true }
    );
    this.params = args.params;
    return sig;
  }

  public async setOwner(args: SetOwnerArgs) {
    const tx = await this.createSetOwnerTx(
      args.newOwner.publicKey,
      args.owner?.publicKey
    );
    const sig = await this.provider.sendAndConfirm(
      tx,
      [args.owner?.payer ?? this.owner.payer],
      {
        skipPreflight: true,
      }
    );
    this.owner = args.newOwner;
    return sig;
  }

  public async setMintAuthority(args?: SetMintAuthorityArgs) {
    const tx = await this.createSetMintAuthorityTx(
      args?.mintAuthority?.publicKey,
      args?.owner?.publicKey
    );
    return await this.provider.sendAndConfirm(
      tx,
      [
        args?.owner?.payer ?? this.owner.payer,
        args?.mintAuthority?.payer ?? this.tokenMint.payer,
      ],
      {
        skipPreflight: true,
      }
    );
  }

  public async reclaimMintAuthority(args: ReclaimMintAuthorityArgs) {
    const tx = await this.createReclaimMintAuthorityTx(
      args.mintAuthority,
      args.owner?.publicKey
    );
    return await this.provider.sendAndConfirm(
      tx,
      [args.owner?.payer ?? this.owner.payer],
      { skipPreflight: true }
    );
  }

  public static async create(args: MockStakePoolArgs) {
    const newStakePool = new MockStakePool(args);
    await newStakePool.init();
    const tx = await newStakePool.createInitStakePoolTx();
    await newStakePool.provider.sendAndConfirm(tx, [newStakePool.owner.payer], {
      skipPreflight: true,
    });
    return newStakePool;
  }

  public async getPoolInfoAddress() {
    return await PublicKey.findProgramAddress(
      [
        Buffer.from(constants.POOL_INFO_SEED),
        this.tokenMint.address.toBuffer(),
        this.pTokenMint.address.toBuffer(),
      ],
      this.program.programId
    );
  }

  public async getTokenVaultAddress() {
    return await PublicKey.findProgramAddress(
      [
        Buffer.from(constants.TOKEN_VAULT_SEED),
        this.tokenMint.address.toBuffer(),
        this.pTokenMint.address.toBuffer(),
      ],
      this.program.programId
    );
  }

  public async getVaultAuthority() {
    return await PublicKey.findProgramAddress(
      [Buffer.from(constants.VAULT_AUTHORITY_SEED), this.address.toBuffer()],
      this.program.programId
    );
  }

  public async fetch() {
    return await this.program.account.poolInfo.fetch(this.address);
  }
}

export type StakePoolParams = {
  startsAt: anchor.BN;
  claimPeriodUnit: anchor.BN;
  maxClaimCount: number;
};

export type MockStakePoolArgs = {
  provider: AnchorProvider;
  version: number;
  pTokenMint: MockMint;
  tokenMint: MockMint;
  owner: MockWallet;
  params: StakePoolParams;
};

export type ModifyParamsArgs = {
  params: StakePoolParams;
  owner?: MockWallet;
};

export type SetOwnerArgs = {
  newOwner: MockWallet;
  owner?: MockWallet;
};

export type SetMintAuthorityArgs = {
  mintAuthority?: MockWallet;
  owner?: MockWallet;
};

export type ReclaimMintAuthorityArgs = {
  mintAuthority: PublicKey;
  owner?: MockWallet;
};
