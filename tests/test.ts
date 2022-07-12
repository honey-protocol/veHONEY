import * as anchor from "@project-serum/anchor";
import { Mint, createMint } from "@solana/spl-token";
import { assert } from "chai";
import { VeHoney } from "../target/types/ve_honey";

describe("Reallocation testing", async () => {
    const provider = anchor.Provider.env();
    anchor.setProvider(provider);
    const program = anchor.workspace.VeHoney as anchor.Program<VeHoney>;

    let owner: anchor.web3.Keypair;
    let base: anchor.web3.Keypair;
    let mint: anchor.web3.PublicKey;

    interface LockerParams {
        whitelistEnabled: boolean;
        minStakeDuration: anchor.BN;
        maxStakeDuration: anchor.BN;
        multiplier: number;
    }

    before(async () => {
        const airdropSignature = await provider.connection.requestAirdrop(
            provider.wallet.publicKey,
            2
        );
        await provider.connection.confirmTransaction(airdropSignature, "processed");

        owner = anchor.web3.Keypair.generate();
        base = anchor.web3.Keypair.generate();
        mint = await createMint(
            provider.connection,
            (provider.wallet as any).payer,
            owner.publicKey,
            owner.publicKey,
            6
        );
    });

    it("initializes locker account", async () => {
        const [locker] = await anchor.web3.PublicKey.findProgramAddress(
            [Buffer.from("Locker"), base.publicKey.toBuffer()],
            program.programId
        );

        const lockerParams: LockerParams = {
            whitelistEnabled: true,
            minStakeDuration: new anchor.BN(0),
            maxStakeDuration: new anchor.BN(10),
            multiplier: 1,
        };

        await program.rpc.initLocker(owner.publicKey, lockerParams, {
            accounts: {
                payer: provider.wallet.publicKey,
                base: base.publicKey,
                locker,
                tokenMint: mint,
                systemProgram: anchor.web3.SystemProgram.programId,
            },
            signers: [base],
        });

        const lockers = await program.account.locker.all();

        lockers.forEach((locker) => {
            console.log("Locker address: ", locker.publicKey.toString());
            console.log("Locker base: ", locker.account.base.toString());
            console.log("Params: ", locker.account.params);
        });
    });

    it("reallocates locker account", async () => {
        const [locker, lockerBump] = await anchor.web3.PublicKey.findProgramAddress(
            [Buffer.from("Locker"), base.publicKey.toBuffer()],
            program.programId
        );

        await program.rpc.reallocLocker(lockerBump, new anchor.BN(333), {
            accounts: {
                payer: provider.wallet.publicKey,
                base: base.publicKey,
                locker,
                rent: anchor.web3.SYSVAR_RENT_PUBKEY,
                systemProgram: anchor.web3.SystemProgram.programId,
            },
        });

        const lockerAcc = await program.account.lockerV2.fetch(locker);

        console.log("Locker base: ", lockerAcc.base.toString());
        console.log("Params: ", lockerAcc.params);
    });
});
