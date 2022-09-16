import * as anchor from "@project-serum/anchor";
import { Wallet, AnchorProvider } from "@project-serum/anchor";
import {
  AccountInfo as Account,
  Token,
  MintInfo,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  u64,
} from "@solana/spl-token";

export class MockMint {
  provider: AnchorProvider;

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

  constructor(provider: AnchorProvider, decimals: number) {
    this.provider = provider;
    this.decimals = decimals;
  }

  private _token: Token | undefined;
  get token(): Token {
    if (this._token === undefined) {
      throw new Error("token undefined");
    }
    return this._token;
  }
  public async init() {
    const payer = this.payer;
    const connection = this.provider.connection;
    this._token = await Token.createMint(
      connection,
      payer,
      payer.publicKey,
      payer.publicKey,
      this.decimals,
      TOKEN_PROGRAM_ID
    );
    this._address = this._token.publicKey;
  }

  public async getAssociatedTokenAddress(
    owner: anchor.web3.PublicKey
  ): Promise<anchor.web3.PublicKey> {
    return await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      this.address,
      owner
    );
  }

  public async getAssociatedTokenAccountBalance(
    owner: anchor.web3.PublicKey
  ): Promise<anchor.BN> {
    const account = await this.getAssociatedTokenAccount(owner);
    return account.amount;
  }

  public async getAssociatedTokenAccount(
    owner: anchor.web3.PublicKey
  ): Promise<Account> {
    const address = await this.getAssociatedTokenAddress(owner);
    return await this.getTokenAccount(address);
  }

  public async tryGetAssociatedTokenAccount(
    owner: anchor.web3.PublicKey
  ): Promise<Account | null> {
    const address = await this.getAssociatedTokenAddress(owner);
    return await this.tryGetTokenAccount(address);
  }

  public async getOrCreateAssociatedTokenAccount(
    owner: anchor.web3.PublicKey
  ): Promise<Account> {
    return await this.token.getOrCreateAssociatedAccountInfo(owner);
  }

  public async closeAssociatedTokenAccount(
    ownerKeypair: anchor.web3.Keypair
  ): Promise<anchor.web3.TransactionSignature> {
    const address = await this.getAssociatedTokenAddress(
      ownerKeypair.publicKey
    );

    const txSig = await MintHelpers.closeTokenAccount(
      this.provider,
      address,
      ownerKeypair
    );
    await this.provider.connection.confirmTransaction(txSig);
    return txSig;
  }

  // public async createKeypairTokenAccount(
  //   owner: anchor.web3.PublicKey,
  //   keypair: anchor.web3.Keypair
  // ): Promise<anchor.web3.PublicKey> {
  //   return await createAccount(
  //     this.provider.connection,
  //     this.payer,
  //     this.address,
  //     owner,
  //     keypair
  //   );
  // }

  public async mintTo(wallet: Wallet, amount: anchor.BN): Promise<void> {
    const account = await this.getOrCreateAssociatedTokenAccount(
      wallet.publicKey
    );
    return await this.token.mintTo(
      account.address,
      this.payer,
      [],
      new u64(amount.toBuffer("be", 8))
    );
  }

  public async burn(wallet: Wallet, amount: number | anchor.BN): Promise<void> {
    const account = await this.getAssociatedTokenAccount(wallet.publicKey);
    return await this.token.burn(account.address, wallet.payer, [], amount);
  }

  public async getTokenAccount(
    address: anchor.web3.PublicKey
  ): Promise<Account> {
    return await this.token.getAccountInfo(address);
  }

  public async tryGetTokenAccount(
    address: anchor.web3.PublicKey
  ): Promise<Account | null> {
    try {
      return await this.getTokenAccount(address);
    } catch (error) {
      return null;
    }
  }

  public static async create(
    provider: AnchorProvider,
    decimals: number
  ): Promise<MockMint> {
    const mint = new MockMint(provider, decimals);
    await mint.init();
    return mint;
  }

  // public static async from(
  //   provider: Provider,
  //   mint: anchor.web3.PublicKey
  // ): Promise<MockMint> {
  //   const mintInfo = await getMint(provider.connection, mint);
  //   const mockMint = new MockMint(provider, mintInfo.decimals);
  //   mockMint._address = mint;
  //   return mockMint;
  // }
}

export class MintHelpers {
  public static async getMintAccount(
    connection: anchor.web3.Connection,
    address: anchor.web3.PublicKey
  ): Promise<MintInfo> {
    const token = new Token(
      connection,
      address,
      TOKEN_PROGRAM_ID,
      anchor.web3.Keypair.generate()
    );
    return await token.getMintInfo();
  }

  public static async closeTokenAccount(
    provider: anchor.AnchorProvider,
    address: anchor.web3.PublicKey,
    payer: anchor.web3.Keypair
  ): Promise<anchor.web3.TransactionSignature> {
    const tx = new anchor.web3.Transaction().add(
      Token.createCloseAccountInstruction(
        TOKEN_PROGRAM_ID,
        address,
        payer.publicKey,
        payer.publicKey,
        []
      )
    );
    return await provider.sendAndConfirm(tx, [payer], { skipPreflight: true });
  }
}
