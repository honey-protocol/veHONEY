import * as anchor from "@project-serum/anchor";
import { Provider, Wallet } from "@project-serum/anchor";
import {
  Account,
  burn,
  closeAccount,
  createAccount,
  createMint,
  getAccount,
  getAssociatedTokenAddress,
  getMint,
  getOrCreateAssociatedTokenAccount,
  Mint,
  mintTo as _mintTo,
  TokenAccountNotFoundError,
} from "@solana/spl-token";

export class MockMint {
  provider: Provider;

  private _address: anchor.web3.PublicKey | undefined;
  get address(): anchor.web3.PublicKey {
    if (this._address === undefined) {
      throw new Error("address undefined");
    }
    return this._address;
  }

  decimals: number;
  get payer(): anchor.web3.Keypair {
    // @ts-ignore
    return this.provider.wallet.payer;
  }

  constructor(provider: Provider, decimals: number) {
    this.provider = provider;
    this.decimals = decimals;
  }

  public async init() {
    const payer = this.payer;
    const connection = this.provider.connection;
    this._address = await createMint(
      connection,
      payer,
      payer.publicKey,
      payer.publicKey,
      this.decimals
    );
  }

  public async getAssociatedTokenAddress(
    owner: anchor.web3.PublicKey
  ): Promise<anchor.web3.PublicKey> {
    return await getAssociatedTokenAddress(this.address, owner);
  }

  public async getAssociatedTokenAccountBalance(
    owner: anchor.web3.PublicKey
  ): Promise<bigint> {
    const account = await this.getAssociatedTokenAccount(owner);
    return account.amount;
  }

  public async getAssociatedTokenAccount(
    owner: anchor.web3.PublicKey
  ): Promise<Account> {
    const address = await this.getAssociatedTokenAddress(owner);
    return await MintHelpers.getTokenAccount(this.provider.connection, address);
  }

  public async tryGetAssociatedTokenAccount(
    owner: anchor.web3.PublicKey
  ): Promise<Account | null> {
    const address = await this.getAssociatedTokenAddress(owner);
    return await MintHelpers.tryGetTokenAccount(
      this.provider.connection,
      address
    );
  }

  public async getOrCreateAssociatedTokenAccount(
    owner: anchor.web3.PublicKey
  ): Promise<Account> {
    return await getOrCreateAssociatedTokenAccount(
      this.provider.connection,
      this.payer,
      this.address,
      owner
    );
  }

  public async closeAssociatedTokenAccount(
    ownerKeypair: anchor.web3.Keypair
  ): Promise<anchor.web3.TransactionSignature> {
    const address = await this.getAssociatedTokenAddress(
      ownerKeypair.publicKey
    );

    const txSig = await MintHelpers.closeTokenAccount(
      this.provider.connection,
      address,
      ownerKeypair
    );
    await this.provider.connection.confirmTransaction(txSig);
    return txSig;
  }

  public async createKeypairTokenAccount(
    owner: anchor.web3.PublicKey,
    keypair: anchor.web3.Keypair
  ): Promise<anchor.web3.PublicKey> {
    return await createAccount(
      this.provider.connection,
      this.payer,
      this.address,
      owner,
      keypair
    );
  }

  public async mintTo(
    wallet: Wallet,
    amount: number | bigint
  ): Promise<anchor.web3.PublicKey> {
    return await MintHelpers.mintTo(
      this.provider,
      wallet,
      this.address,
      amount
    );
  }

  public async burn(
    wallet: Wallet,
    amount: number | bigint
  ): Promise<anchor.web3.TransactionSignature> {
    return await MintHelpers.burn(this.provider, wallet, this.address, amount);
  }

  public static async create(
    provider: Provider,
    decimals: number
  ): Promise<MockMint> {
    const mint = new MockMint(provider, decimals);
    await mint.init();
    return mint;
  }

  public static async from(
    provider: Provider,
    mint: anchor.web3.PublicKey
  ): Promise<MockMint> {
    const mintInfo = await getMint(provider.connection, mint);
    const mockMint = new MockMint(provider, mintInfo.decimals);
    mockMint._address = mint;
    return mockMint;
  }
}

export class MintHelpers {
  public static async mintTo(
    provider: Provider,
    wallet: Wallet,
    mint: anchor.web3.PublicKey,
    amount: number | bigint
  ): Promise<anchor.web3.PublicKey> {
    // @ts-ignore
    const payer: Keypair = provider.wallet.payer;
    const connection = provider.connection;
    const tokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      payer,
      mint,
      wallet.publicKey
    );
    const sig = await _mintTo(
      connection,
      payer,
      mint,
      tokenAccount.address,
      payer,
      amount
    );
    await connection.confirmTransaction(sig);
    return tokenAccount.address;
  }

  public static async burn(
    provider: Provider,
    wallet: Wallet,
    mint: anchor.web3.PublicKey,
    amount: number | bigint
  ): Promise<anchor.web3.TransactionSignature> {
    // @ts-ignore
    const payer: Keypair = provider.wallet.payer;
    const connection = provider.connection;
    const tokenAccount = await getAssociatedTokenAddress(
      mint,
      wallet.publicKey
    );
    return await burn(
      connection,
      payer,
      tokenAccount,
      mint,
      wallet.payer,
      amount
    );
  }

  public static async getMintAccount(
    connection: anchor.web3.Connection,
    address: anchor.web3.PublicKey
  ): Promise<Mint> {
    return await getMint(connection, address);
  }

  public static async getTokenAccount(
    connection: anchor.web3.Connection,
    address: anchor.web3.PublicKey
  ): Promise<Account> {
    return await getAccount(connection, address);
  }

  public static async tryGetTokenAccount(
    connection: anchor.web3.Connection,
    address: anchor.web3.PublicKey
  ): Promise<Account | null> {
    try {
      return await MintHelpers.getTokenAccount(connection, address);
    } catch (error) {
      if (error instanceof TokenAccountNotFoundError) {
        return null;
      }
      throw error;
    }
  }

  public static async closeTokenAccount(
    connection: anchor.web3.Connection,
    address: anchor.web3.PublicKey,
    payer: anchor.web3.Keypair
  ): Promise<anchor.web3.TransactionSignature> {
    return await closeAccount(
      connection,
      payer,
      address,
      payer.publicKey,
      payer.publicKey
    );
  }
}
