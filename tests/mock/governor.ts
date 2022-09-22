import * as anchor from "@project-serum/anchor";
import { AnchorProvider, Program } from "@project-serum/anchor";
import { Keypair, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  GovernorWrapper,
  TribecaSDK,
  findGovernorAddress,
} from "@tribecahq/tribeca-sdk";
import { SmartWalletWrapper, GokiSDK } from "@gokiprotocol/client";
import { SolanaProvider, Provider } from "@saberhq/solana-contrib";

import { VeHoney } from "../../target/types/ve_honey";
import { Stake } from "../../target/types/stake";
import { MockWallet } from "./wallet";
import { MockMint } from "./mint";
import * as constants from "../constants";

export class MockGovernor {
  provider: AnchorProvider;
  veHoneyProgram: Program<VeHoney>;
  stakeProgram: Program<Stake>;

  private _locker: PublicKey | undefined;
  get locker(): PublicKey {
    if (this._locker === undefined) {
      throw new Error("locker undefined");
    }
    return this._locker;
  }

  private _wallet: MockWallet | undefined;
  get wallet(): MockWallet {
    if (this._wallet === undefined) {
      throw new Error("wallet undefined");
    }
    return this._wallet;
  }

  private _smartWallet: SmartWalletWrapper | undefined;
  get smartWallet(): SmartWalletWrapper {
    if (this._smartWallet === undefined) {
      throw new Error("smart wallet undefined");
    }
    return this._smartWallet;
  }

  private _governor: GovernorWrapper | undefined;
  get governor(): GovernorWrapper {
    if (this._governor === undefined) {
      throw new Error("governor undefined");
    }
    return this._governor;
  }

  lockerBase: Keypair;
  tokenMint: MockMint;
  lockerParams: LockerParams;

  governorBase: Keypair;
  governorParams: GovernorParams;
  governorSDK: TribecaSDK;
  gokiSDK: GokiSDK;

  constructor({
    provider,
    tokenMint,
    lockerParams,
    governorParams,
  }: MockGovernorArgs) {
    this.provider = provider;
    this.veHoneyProgram = anchor.workspace.VeHoney as Program<VeHoney>;
    this.stakeProgram = anchor.workspace.Stake as Program<Stake>;
    this.lockerBase = Keypair.generate();
    this.tokenMint = tokenMint;
    this.lockerParams = lockerParams;
    this.governorBase = Keypair.generate();
    this.governorParams = governorParams;
  }

  public async init() {
    this._wallet = await MockWallet.createWithBalance(this.provider, 3);
    this.governorSDK = TribecaSDK.load({
      provider: SolanaProvider.init({
        connection: this.provider.connection,
        wallet: this.wallet,
        opts: this.provider.opts,
      }),
    });
    this.gokiSDK = GokiSDK.load({ provider: this.governorSDK.provider });
    this._locker = await this.getLockerAddress();
    const [governor] = await findGovernorAddress(this.governorBase.publicKey);
    const { smartWalletWrapper, tx: newSmartWalletTx } =
      await this.gokiSDK.newSmartWallet({
        owners: [this.wallet.publicKey, governor],
        threshold: new anchor.BN(1),
        numOwners: 3,
      });

    await newSmartWalletTx.confirm({ skipPreflight: true });

    this._smartWallet = smartWalletWrapper;

    const { wrapper: governorWrapper, tx: createGovernorTx } =
      await this.governorSDK.govern.createGovernor({
        baseKP: this.governorBase,
        electorate: this.locker,
        smartWallet: smartWalletWrapper.key,
        ...this.governorParams,
      });

    await createGovernorTx.confirm({ skipPreflight: true });

    this._governor = governorWrapper;
  }

  private async createInitLockerTx() {
    return await this.veHoneyProgram.methods
      .initLocker(this.lockerParams)
      .accounts({
        payer: this.wallet.publicKey,
        base: this.lockerBase.publicKey,
        locker: this.locker,
        tokenMint: this.tokenMint.address,
        governor: this.governor.governorKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .transaction();
  }

  private async createSetLockerParamsIx(params: LockerParams) {
    return await this.veHoneyProgram.methods
      .setLockerParams(params)
      .accounts({
        locker: this.locker,
        governor: this.governor.governorKey,
        smartWallet: this.smartWallet.key,
      })
      .instruction();
  }

  private async createInitTreasuryIx() {
    return await this.veHoneyProgram.methods
      .initTreasury()
      .accounts({
        payer: this.wallet.publicKey,
        locker: this.locker,
        treasury: await this.getTreasuryAddress(),
        tokenMint: this.tokenMint.address,
        governor: this.governor.governorKey,
        smartWallet: this.smartWallet.key,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .instruction();
  }

  private async createApproveProgramLockPrivilegeIx() {
    return await this.veHoneyProgram.methods
      .approveProgramLockPrivilege()
      .accounts({
        payer: this.wallet.publicKey,
        locker: await this.getLockerAddress(),
        whitelistEntry: await this.getWhitelistEntryAddress(
          this.stakeProgram.programId,
          anchor.web3.SystemProgram.programId
        ),
        governor: this.governor.governorKey,
        smartWallet: this.smartWallet.key,
        executableId: this.stakeProgram.programId,
        whitelistedOwner: anchor.web3.SystemProgram.programId,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .instruction();
  }

  private async createRevokeProgramLockPrivilegeIx(whitelistEntry: PublicKey) {
    return await this.veHoneyProgram.methods
      .revokeProgramLockPrivilege()
      .accounts({
        payer: this.wallet.publicKey,
        locker: this.locker,
        whitelistEntry,
        governor: this.governor.governorKey,
        smartWallet: this.smartWallet.key,
      })
      .instruction();
  }

  private async createAddProofIx(address: PublicKey) {
    return await this.veHoneyProgram.methods
      .addProof(1)
      .accounts({
        payer: this.wallet.publicKey,
        locker: this.locker,
        proof: await this.getProofAddress(address),
        address,
        governor: this.governor.governorKey,
        smartWallet: this.smartWallet.key,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .instruction();
  }

  private async createRemoveProofIx(address: PublicKey) {
    return await this.veHoneyProgram.methods
      .removeProof()
      .accounts({
        payer: this.wallet.publicKey,
        locker: this.locker,
        proof: await this.getProofAddress(address),
        address,
        governor: this.governor.governorKey,
        smartWallet: this.smartWallet.key,
      })
      .instruction();
  }

  public static async create(args: MockGovernorArgs) {
    const governor = new MockGovernor(args);
    await governor.init();
    const tx = await governor.createInitLockerTx();
    await governor.provider.sendAndConfirm(
      tx,
      [governor.wallet.payer, governor.lockerBase],
      { skipPreflight: true }
    );
    return governor;
  }

  public async setLockerParams(params: LockerParams) {
    const ix = await this.createSetLockerParamsIx(params);
    return await this.executeTransactionBySmartWallet({
      provider: this.governorSDK.provider,
      smartWalletWrapper: this.smartWallet,
      instructions: [ix],
    });
  }

  public async initTreasury() {
    const ix = await this.createInitTreasuryIx();
    return await this.executeTransactionBySmartWallet({
      provider: this.governorSDK.provider,
      smartWalletWrapper: this.smartWallet,
      instructions: [ix],
    });
  }

  public async approveProgramLockPrivilege() {
    const ix = await this.createApproveProgramLockPrivilegeIx();
    return await this.executeTransactionBySmartWallet({
      provider: this.governorSDK.provider,
      smartWalletWrapper: this.smartWallet,
      instructions: [ix],
    });
  }

  public async revokeProgramLockPrivilege(whitelistEntry: PublicKey) {
    const ix = await this.createRevokeProgramLockPrivilegeIx(whitelistEntry);
    return await this.executeTransactionBySmartWallet({
      provider: this.governorSDK.provider,
      smartWalletWrapper: this.smartWallet,
      instructions: [ix],
    });
  }

  public async addProof(address: PublicKey) {
    const ix = await this.createAddProofIx(address);
    return await this.executeTransactionBySmartWallet({
      provider: this.governorSDK.provider,
      smartWalletWrapper: this.smartWallet,
      instructions: [ix],
    });
  }

  public async removeProof(address: PublicKey) {
    const ix = await this.createRemoveProofIx(address);
    return await this.executeTransactionBySmartWallet({
      provider: this.governorSDK.provider,
      smartWalletWrapper: this.smartWallet,
      instructions: [ix],
    });
  }

  public async fetchLocker() {
    return await this.veHoneyProgram.account.locker.fetchNullable(this.locker);
  }

  public async fetchWhitelistEntry() {
    const whitelistEntryAddress = await this.getWhitelistEntryAddress(
      this.stakeProgram.programId,
      anchor.web3.SystemProgram.programId
    );

    return await this.veHoneyProgram.account.whitelistEntry.fetchNullable(
      whitelistEntryAddress
    );
  }

  public async fetchProof(address: PublicKey) {
    const proofAddress = await this.getProofAddress(address);

    return await this.veHoneyProgram.account.proof.fetchNullable(proofAddress);
  }

  public async getLockerAddress() {
    const [address] = await PublicKey.findProgramAddress(
      [
        Buffer.from(constants.LOCKER_SEED),
        this.lockerBase.publicKey.toBuffer(),
      ],
      this.veHoneyProgram.programId
    );
    return address;
  }

  public async getTreasuryAddress() {
    const [address] = await PublicKey.findProgramAddress(
      [
        Buffer.from(constants.TREASURY_SEED),
        this.locker.toBuffer(),
        this.tokenMint.address.toBuffer(),
      ],
      this.veHoneyProgram.programId
    );
    return address;
  }

  public async getWhitelistEntryAddress(
    executableId: PublicKey,
    whitelistedOwner: PublicKey
  ) {
    const [address] = await PublicKey.findProgramAddress(
      [
        Buffer.from(constants.WHITELIST_ENTRY_SEED),
        this.locker.toBuffer(),
        executableId.toBuffer(),
        whitelistedOwner.toBuffer(),
      ],
      this.veHoneyProgram.programId
    );
    return address;
  }

  public async getProofAddress(proofFor: PublicKey) {
    const [address] = await PublicKey.findProgramAddress(
      [
        Buffer.from(constants.PROOF_SEED),
        this.locker.toBuffer(),
        proofFor.toBuffer(),
      ],
      this.veHoneyProgram.programId
    );
    return address;
  }

  private async executeTransactionBySmartWallet({
    provider,
    smartWalletWrapper,
    instructions,
  }: {
    provider: Provider;
    smartWalletWrapper: SmartWalletWrapper;
    instructions: TransactionInstruction[];
  }): Promise<PublicKey> {
    const { transactionKey, tx: tx1 } = await smartWalletWrapper.newTransaction(
      {
        proposer: provider.wallet.publicKey,
        instructions,
      }
    );

    await tx1.confirm();

    const tx2 = await smartWalletWrapper.executeTransaction({ transactionKey });
    await tx2.confirm();

    return transactionKey;
  }

  public async calcRewardAmountAt(at?: number) {
    const locker = await this.fetchLocker();

    let count = 0;
    let amount = new anchor.BN(0);
    let amountPerUnit = locker.params.nftStakeBaseReward;

    let countAt = at ?? locker.params.nftStakeDurationCount;

    while (count < Math.min(countAt, locker.params.nftStakeDurationCount)) {
      if (count >= locker.params.nftRewardHalvingStartsAt) {
        amountPerUnit = amountPerUnit.divn(2);
      }
      amount = amount.add(amountPerUnit);
      count++;
    }

    return amount;
  }
}

export type LockerParams = {
  minStakeDuration: anchor.BN;
  maxStakeDuration: anchor.BN;
  whitelistEnabled: boolean;
  multiplier: number;
  proposalActivationMinVotes: anchor.BN;
  nftStakeDurationUnit: anchor.BN;
  nftStakeBaseReward: anchor.BN;
  nftStakeDurationCount: number;
  nftRewardHalvingStartsAt: number;
};

export type GovernorParams = {
  votingDelay: anchor.BN;
  votingPeriod: anchor.BN;
  quorumVotes: anchor.BN;
  timelockDelaySeconds: anchor.BN;
};

export type MockGovernorArgs = {
  provider: AnchorProvider;
  tokenMint: MockMint;
  lockerParams?: LockerParams;
  governorParams?: GovernorParams;
};
