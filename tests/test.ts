const fs = require("fs");
import * as anchor from "@project-serum/anchor";
import { Mint, createMint } from "@solana/spl-token";
import { assert } from "chai";
import { VeHoney } from "../target/types/ve_honey";

describe("Reallocation testing", () => {
    const provider = anchor.Provider.env();
    anchor.setProvider(provider);
    const program = anchor.workspace.VeHoney as anchor.Program<VeHoney>;

    const owner = anchor.web3.Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync("./tests/keys/owner.json", "utf8")))
    );
    const base = anchor.web3.Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync("./tests/keys/locker_base.json", "utf8")))
    );
    const mint = new anchor.web3.PublicKey("DRu93rR8BxNvrnED5fdkYp4gfVTEYFi2MdRtft9FTgjW");

    interface LockerParams {
        whitelistEnabled: boolean;
        minStakeDuration: anchor.BN;
        maxStakeDuration: anchor.BN;
        multiplier: number;
    }

    console.log(program.programId.toString());

    // it("initializes locker account", async () => {
    //     const [locker] = await anchor.web3.PublicKey.findProgramAddress(
    //         [Buffer.from("Locker"), base.publicKey.toBuffer()],
    //         program.programId
    //     );

    //     const lockerParams: LockerParams = {
    //         whitelistEnabled: true,
    //         minStakeDuration: new anchor.BN(0),
    //         maxStakeDuration: new anchor.BN(10),
    //         multiplier: 1,
    //     };

    //     await program.rpc.initLocker(owner.publicKey, lockerParams, {
    //         accounts: {
    //             payer: provider.wallet.publicKey,
    //             base: base.publicKey,
    //             locker,
    //             tokenMint: mint,
    //             systemProgram: anchor.web3.SystemProgram.programId,
    //         },
    //         signers: [base],
    //     });

    //     const lockers = await program.account.locker.all();

    //     lockers.forEach((locker) => {
    //         console.log("Locker address: ", locker.publicKey.toString());
    //         console.log("Locker base: ", locker.account.base.toString());
    //         console.log("Params: ", locker.account.params);
    //     });
    // });

    it("reallocates locker account", async () => {
        const [locker, lockerBump] = await anchor.web3.PublicKey.findProgramAddress(
            [Buffer.from("Locker"), base.publicKey.toBuffer()],
            program.programId
        );

        await program.rpc.reallocLocker(lockerBump, {
            accounts: {
                payer: provider.wallet.publicKey,
                admin: owner.publicKey,
                base: base.publicKey,
                locker,
                rent: anchor.web3.SYSVAR_RENT_PUBKEY,
                systemProgram: anchor.web3.SystemProgram.programId,
            },
            signers: [owner],
        });

        const lockerAcc = await program.account.locker.fetch(locker);

        console.log("Locker base: ", lockerAcc.base.toString());
        console.log("Params: ", lockerAcc.params);
        console.log("minStakeDuration: ", lockerAcc.params.minStakeDuration.toString());
        console.log("maxStakeDuration: ", lockerAcc.params.maxStakeDuration.toString());
        console.log("proposal: ", lockerAcc.params.proposalActivationMinVotes.toString());

        console.log("Locker: ", locker.toString());
    });
});
