import * as anchor from "@project-serum/anchor";
import { AnchorProvider, Program } from "@project-serum/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
import { Wallet, programs, actions } from "@metaplex/js";

import { VeHoney } from "../../target/types/ve_honey";
import { MockMint } from "./mint";
import { sleep } from "../utils/util";
import { MockWallet } from "./wallet";

export const TEST_METADATA = {
  name: "Honey Genesis Bee #8473",
  symbol: "HNYG",
  uri: "https://arweave.net/YujpPKbZ5bsnq-jRqLToUZ8oR5itYhWfuL6DklCbs0g",
  sellerFeeBasisPoints: 10,
  creators: [],
};

export class MockNFT {
  provider: AnchorProvider;
  program: Program<VeHoney>;

  private _mint: MockMint | undefined;
  get mint(): MockMint {
    if (this._mint === undefined) {
      throw new Error("mint undefined");
    }
    return this._mint;
  }

  private _metadata: programs.metadata.Metadata | undefined;
  get metadata() {
    if (this._metadata === undefined) {
      throw new Error("metadata undefined");
    }
    return this._metadata;
  }

  private _edition: programs.metadata.Edition | undefined;
  get edition() {
    if (this._edition === undefined) {
      throw new Error("edition undefined");
    }
    return this._edition;
  }

  public async init() {
    await this.createMetadata();
  }

  constructor(provider: AnchorProvider, mint: MockMint) {
    this.provider = provider;
    this._mint = mint;
  }

  public async createMetadata(
    totalCreatorsN: number = 5,
    ourCreatorN: number = 1,
    leaveUnverified: boolean = false,
    skipEntirely: boolean = false
  ) {
    const metadataData = new programs.metadata.MetadataDataData({
      name: TEST_METADATA.name,
      symbol: TEST_METADATA.symbol,
      uri: TEST_METADATA.uri,
      sellerFeeBasisPoints: TEST_METADATA.sellerFeeBasisPoints,
      creators: TEST_METADATA.creators.map(
        (c) =>
          new programs.metadata.Creator({
            address: c.address,
            verified: c.verified,
            share: c.share,
          })
      ),
    });

    for (let i = 0; i < totalCreatorsN; i++) {
      metadataData.creators!.push(
        new programs.metadata.Creator({
          address:
            !skipEntirely && i === ourCreatorN - 1
              ? this.provider.wallet.publicKey.toBase58()
              : Keypair.generate().publicKey.toBase58(),
          verified: !leaveUnverified && i === ourCreatorN - 1,
          share: 100 / totalCreatorsN,
        })
      );
    }

    await actions.createMetadata({
      connection: this.provider.connection,
      wallet: this.provider.wallet,
      editionMint: this.mint.address,
      metadataData,
    });

    await sleep(2000);

    const metadata = await programs.metadata.Metadata.getPDA(this.mint.address);
    this._metadata = await programs.metadata.Metadata.load(
      this.provider.connection,
      metadata
    );

    return metadata;
  }

  public async createMasterEdition() {
    await actions.createMasterEdition({
      connection: this.provider.connection,
      wallet: this.provider.wallet,
      editionMint: this.mint.address,
    });
  }

  public async mintTo(owner: MockWallet, amount: anchor.BN) {
    const ata = await this.mint.getOrCreateAssociatedTokenAccount(
      owner.publicKey
    );
    await this.mint.mintTo(owner, amount);
  }

  public static async create(provider: AnchorProvider) {
    const mint = new MockMint(provider, 0);
    await mint.init();
    const nft = new MockNFT(provider, mint);
    await nft.init();
    return nft;
  }
}
