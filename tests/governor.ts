import * as anchor from "@project-serum/anchor";
import { AnchorProvider, Program } from "@project-serum/anchor";

import { MockGovernor } from "./mock/governor";
import { VeHoney } from "../target/types/ve_honey";
import { MockMint } from "./mock/mint";

describe("governor in locker", () => {
  const provider = AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.VeHoney as Program<VeHoney>;

  it("hello", async () => {
    const tokenMint = await MockMint.create(provider, 6);

    const governor = await MockGovernor.create({
      provider,
      tokenMint,
    });
  });
});
