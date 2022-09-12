import nacl from "tweetnacl";
import { Provider, Wallet } from "@project-serum/anchor";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  RpcResponseAndContext,
  SignatureResult,
  Transaction,
} from "@solana/web3.js";

export function ed25519Sign(
  message: string,
  secretKey: Uint8Array
): Uint8Array {
  return nacl.sign.detached(Buffer.from(message, "utf-8"), secretKey);
}

export class MockWallet implements Wallet {
  provider: Provider;
  keypair: Keypair;
  get publicKey() {
    return this.keypair.publicKey;
  }
  get secretKey() {
    return this.keypair.secretKey;
  }
  get payer() {
    return this.keypair;
  }

  constructor(provider: Provider, keypair: Keypair) {
    this.provider = provider;
    this.keypair = keypair;
  }

  public async signTransaction(tx: Transaction): Promise<Transaction> {
    tx.partialSign(this.payer);
    return tx;
  }

  public async signAllTransactions(txs: Transaction[]): Promise<Transaction[]> {
    return txs.map((t) => {
      t.partialSign(this.payer);
      return t;
    });
  }

  public signMessage(message: string): Uint8Array {
    return ed25519Sign(message, this.secretKey);
  }

  public async requestAirdrop(
    sol: number = 1
  ): Promise<RpcResponseAndContext<SignatureResult>> {
    const sig = await this.provider.connection.requestAirdrop(
      this.publicKey,
      Math.round(sol * LAMPORTS_PER_SOL)
    );
    return await this.provider.connection.confirmTransaction(sig);
  }

  public async getLamportsBalance(): Promise<number> {
    const accountInfo = await this.provider.connection.getAccountInfo(
      this.publicKey
    );
    if (accountInfo === null) {
      throw new Error("Couldn't get balance - wallet account is closed");
    }
    return accountInfo.lamports;
  }

  public static create(provider: Provider): MockWallet {
    const keypair = new Keypair();
    return MockWallet.from(provider, keypair);
  }

  public static async createWithBalance(
    provider: Provider,
    sol: number = 1
  ): Promise<MockWallet> {
    const wallet = MockWallet.create(provider);
    await wallet.requestAirdrop(sol);
    return wallet;
  }

  public static from(provider: Provider, keypair: Keypair): MockWallet {
    const wallet = new MockWallet(provider, keypair);
    return wallet;
  }
}
