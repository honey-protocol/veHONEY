import * as anchor from "@project-serum/anchor";
import { AnchorProvider } from "@project-serum/anchor";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";

chai.config.includeStack = true;
chai.use(chaiAsPromised);

const provider = AnchorProvider.env();
anchor.setProvider(provider);
