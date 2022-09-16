import * as anchor from "@project-serum/anchor";
import { AnchorProvider, Program } from "@project-serum/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
import {
  GovernorWrapper,
  TribecaSDK,
  findGovernorAddress,
} from "@tribecahq/tribeca-sdk";
import { SmartWalletWrapper, GokiSDK } from "@gokiprotocol/client";
import { SolanaProvider } from "@saberhq/solana-contrib";

import { VeHoney } from "../../target/types/ve_honey";
import { MockWallet } from "./wallet";
import { MockMint } from "./mint";
import * as constants from "../constants";

export class MockGovernor {
  provider: AnchorProvider;
  program: Program<VeHoney>;

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
    this.program = anchor.workspace.VeHoney as Program<VeHoney>;
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
        wallet: this.provider.wallet,
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

    await newSmartWalletTx;
  }

  public static async create(args: MockGovernorArgs) {
    const governor = new MockGovernor(args);
    await governor.init();
  }

  public async getLockerAddress() {
    const [address] = await PublicKey.findProgramAddress(
      [
        Buffer.from(constants.LOCKER_SEED),
        this.lockerBase.publicKey.toBuffer(),
      ],
      this.program.programId
    );
    return address;
  }
}

export type LockerParams = {
  minStakeDuration: anchor.BN;
  maxStakeDuration: anchor.BN;
  whitelistEnabled: boolean;
  multiplier: number;
  proposalActivationMinVotes: anchor.BN;
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
