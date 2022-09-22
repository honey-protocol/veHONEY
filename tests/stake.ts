// require("./utils/setup");
// import * as anchor from "@project-serum/anchor";
// import { AnchorProvider, Program } from "@project-serum/anchor";
// import { assert, expect } from "chai";

// import { Stake } from "../target/types/stake";
// import * as constants from "./constants";
// import { MintHelpers, MockMint } from "./mock/mint";
// import { StakePoolParams, MockStakePool } from "./mock/stakePool";
// import { MockUser } from "./mock/user";
// import { MockWallet } from "./mock/wallet";
// import {
//   checkMint,
//   checkStakePool,
//   checkPoolUser,
//   checkTokenAccount,
// } from "./utils/check";
// import { sleep } from "./utils/util";

// describe("stake pool management", () => {
//   const provider = AnchorProvider.env();
//   anchor.setProvider(provider);
//   const program = anchor.workspace.Stake as Program<Stake>;

//   let version: number = constants.STAKE_POOL_VERSION;
//   let pTokenMint: MockMint;
//   let tokenMint: MockMint;
//   let owner: MockWallet;
//   const defaultStakePoolParams = {
//     startsAt: new anchor.BN(Math.floor(Date.now() / 1000) + 1),
//     claimPeriodUnit: new anchor.BN(1),
//     maxClaimCount: 21,
//   };
//   let stakePoolParams: StakePoolParams;

//   let stakePool: MockStakePool;

//   async function initPool(params: StakePoolParams) {
//     [pTokenMint, tokenMint, owner] = await Promise.all([
//       MockMint.create(provider, 6),
//       MockMint.create(provider, 6),
//       MockWallet.createWithBalance(provider, 1),
//     ]);

//     stakePool = await MockStakePool.create({
//       provider,
//       version,
//       pTokenMint,
//       tokenMint,
//       owner,
//       params,
//     });

//     stakePoolParams = params;
//   }

//   it("cannot initialize with incorrect params", async () => {
//     const initPoolWithFail = initPool({
//       // startsAt should be more than now
//       ...defaultStakePoolParams,
//       startsAt: new anchor.BN(Math.floor(Date.now() / 1000)),
//     });

//     await expect(initPoolWithFail).to.eventually.be.rejectedWith(
//       'failed ({"err":{"InstructionError":[0,{"Custom":6101}]}})'
//     );
//   });

//   it("can be initialized", async () => {
//     await initPool({
//       ...defaultStakePoolParams,
//       startsAt: new anchor.BN(Math.floor(Date.now() / 1000) + 1),
//     });
//     const stakePoolData = await stakePool.fetch();

//     checkStakePool({
//       poolInfo: stakePoolData,
//       version,
//       pTokenMint: pTokenMint.address,
//       tokenMint: tokenMint.address,
//       owner: owner.publicKey,
//       params: stakePoolParams,
//     });
//   });

//   it("cannot modify pool params after pool has been started", async () => {
//     await initPool({
//       ...defaultStakePoolParams,
//       startsAt: new anchor.BN(Math.floor(Date.now() / 1000) + 1),
//     });

//     await sleep(2000);

//     const modifyParamsWithFail = stakePool.modifyParams({
//       params: {
//         startsAt: new anchor.BN(Math.floor(Date.now() / 1000) + 10),
//         claimPeriodUnit: new anchor.BN(1),
//         maxClaimCount: 21,
//       },
//     });

//     await expect(modifyParamsWithFail).to.eventually.be.rejectedWith(
//       'failed ({"err":{"InstructionError":[0,{"Custom":6102}]}})'
//     );
//   });

//   it("cannot modify pool params with incorrect params", async () => {
//     await initPool({
//       ...defaultStakePoolParams,
//       startsAt: new anchor.BN(Math.floor(Date.now() / 1000) + 2),
//     });

//     const modifyParamsWithFail = stakePool.modifyParams({
//       params: {
//         startsAt: new anchor.BN(Math.floor(Date.now() / 1000)),
//         ...defaultStakePoolParams,
//       },
//     });

//     await expect(modifyParamsWithFail).to.eventually.be.rejectedWith(
//       'failed ({"err":{"InstructionError":[0,{"Custom":6101}]}})'
//     );
//   });

//   it("invalid owner cannot modify pool params", async () => {
//     await initPool({
//       ...defaultStakePoolParams,
//       startsAt: new anchor.BN(Math.floor(Date.now() / 1000) + 1),
//     });

//     const invalidOwner = await MockWallet.createWithBalance(provider, 1);

//     const modifyParamsWithFail = stakePool.modifyParams({
//       params: {
//         startsAt: new anchor.BN(Math.floor(Date.now() / 1000) + 2),
//         ...defaultStakePoolParams,
//       },
//       owner: invalidOwner,
//     });

//     await expect(modifyParamsWithFail).to.eventually.be.rejectedWith(
//       'failed ({"err":{"InstructionError":[0,{"Custom":6103}]}})'
//     );
//   });

//   it("can be modified", async () => {
//     await initPool({
//       ...defaultStakePoolParams,
//       startsAt: new anchor.BN(Math.floor(Date.now() / 1000) + 2),
//     });

//     const newParams = {
//       ...defaultStakePoolParams,
//       startsAt: new anchor.BN(Math.floor(Date.now() / 1000) + 5),
//     };

//     await stakePool.modifyParams({ params: newParams });

//     const stakePoolData = await stakePool.fetch();

//     checkStakePool({
//       poolInfo: stakePoolData,
//       version,
//       pTokenMint: pTokenMint.address,
//       tokenMint: tokenMint.address,
//       owner: owner.publicKey,
//       params: newParams,
//     });
//   });

//   it("invalid owner cannot update owner", async () => {
//     await initPool({
//       ...defaultStakePoolParams,
//       startsAt: new anchor.BN(Math.floor(Date.now() / 1000) + 2),
//     });

//     const [newOwner, invalidOwner] = await Promise.all([
//       await MockWallet.createWithBalance(provider, 1),
//       await MockWallet.createWithBalance(provider, 1),
//     ]);

//     const setOwnerWithFail = stakePool.setOwner({
//       newOwner,
//       owner: invalidOwner,
//     });

//     await expect(setOwnerWithFail).to.eventually.be.rejectedWith(
//       'failed ({"err":{"InstructionError":[0,{"Custom":6103}]}})'
//     );
//   });

//   it("invalid owner cannot update mint authority", async () => {
//     await initPool({
//       ...defaultStakePoolParams,
//       startsAt: new anchor.BN(Math.floor(Date.now() / 1000) + 2),
//     });

//     const invalidOwner = await MockWallet.createWithBalance(provider, 1);

//     const setMintAuthorityWithFail = stakePool.setMintAuthority({
//       owner: invalidOwner,
//     });

//     await expect(setMintAuthorityWithFail).to.eventually.be.rejectedWith(
//       'failed ({"err":{"InstructionError":[0,{"Custom":6103}]}})'
//     );
//   });

//   it("cannot update mint authority with invalid origin authority", async () => {
//     await initPool({
//       ...defaultStakePoolParams,
//       startsAt: new anchor.BN(Math.floor(Date.now() / 1000) + 2),
//     });

//     const invalidAuthority = await MockWallet.createWithBalance(provider, 1);

//     const setMintAuthorityWithFail = stakePool.setMintAuthority({
//       mintAuthority: invalidAuthority,
//     });

//     await expect(setMintAuthorityWithFail).to.eventually.be.rejectedWith(
//       'failed ({"err":{"InstructionError":[0,{"Custom":6202}]}})'
//     );
//   });

//   it("can update mint authority", async () => {
//     await initPool({
//       ...defaultStakePoolParams,
//       startsAt: new anchor.BN(Math.floor(Date.now() / 1000) + 2),
//     });

//     await stakePool.setMintAuthority();

//     const mintAccount = await MintHelpers.getMintAccount(
//       provider.connection,
//       stakePool.tokenMint.address
//     );

//     checkMint({
//       account: mintAccount,
//       decimals: 6,
//       mintAuthority: (await stakePool.getVaultAuthority())[0],
//     });
//   });

//   it("cannot reclaim mint authority with invalid owner", async () => {
//     await initPool({
//       ...defaultStakePoolParams,
//       startsAt: new anchor.BN(Math.floor(Date.now() / 1000) + 2),
//     });

//     await stakePool.setMintAuthority();

//     const invalidOwner = await MockWallet.createWithBalance(provider, 1);

//     const reclaimMintAuthorityWithFail = stakePool.reclaimMintAuthority({
//       mintAuthority: tokenMint.payer.publicKey,
//       owner: invalidOwner,
//     });

//     await expect(reclaimMintAuthorityWithFail).to.eventually.be.rejectedWith(
//       'failed ({"err":{"InstructionError":[0,{"Custom":6103}]}})'
//     );
//   });

//   it("can be reclaimed", async () => {
//     await initPool({
//       ...defaultStakePoolParams,
//       startsAt: new anchor.BN(Math.floor(Date.now() / 1000) + 2),
//     });

//     await stakePool.setMintAuthority();

//     await stakePool.reclaimMintAuthority({
//       mintAuthority: tokenMint.payer.publicKey,
//     });

//     const mintAccount = await MintHelpers.getMintAccount(
//       provider.connection,
//       stakePool.tokenMint.address
//     );

//     checkMint({
//       account: mintAccount,
//       decimals: 6,
//       mintAuthority: tokenMint.payer.publicKey,
//     });
//   });
// });

// describe("user stake/deposit/claim to stake pool", () => {
//   const provider = AnchorProvider.env();
//   anchor.setProvider(provider);
//   const program = anchor.workspace.Stake as Program<Stake>;

//   let stakePool: MockStakePool;

//   before(async () => {
//     await initPool({
//       startsAt: new anchor.BN(Math.floor(Date.now() / 1000) + 1),
//       claimPeriodUnit: new anchor.BN(1),
//       maxClaimCount: 21,
//     });
//   });

//   async function initPool(params: StakePoolParams) {
//     const [pTokenMint, tokenMint, owner] = await Promise.all([
//       MockMint.create(provider, 6),
//       MockMint.create(provider, 6),
//       MockWallet.createWithBalance(provider, 1),
//     ]);
//     stakePool = await MockStakePool.create({
//       provider,
//       version: constants.STAKE_POOL_VERSION,
//       pTokenMint,
//       tokenMint,
//       owner,
//       params,
//     });
//   }

//   it("pool user can be initialized", async () => {
//     const user = await MockUser.create({ provider, poolInfo: stakePool });
//     const userAccount = await user.fetch();
//     checkPoolUser({
//       poolUser: userAccount,
//       poolInfo: stakePool.address,
//       owner: user.wallet.publicKey,
//       depositAmount: new anchor.BN(0),
//       claimedAmount: new anchor.BN(0),
//       count: 0,
//     });
//   });

//   it("invalid user owner cannot deposit pToken", async () => {
//     const user = await MockUser.create({ provider, poolInfo: stakePool });
//     const pTokenAmount = new anchor.BN(10_000_000);
//     await stakePool.pTokenMint.mintTo(user.wallet, new anchor.BN(pTokenAmount));
//     const pTokenAccount = await stakePool.pTokenMint.getAssociatedTokenAccount(
//       user.wallet.publicKey
//     );
//     checkTokenAccount({
//       account: pTokenAccount,
//       mint: stakePool.pTokenMint.address,
//       amount: pTokenAmount,
//     });
//     const invalidOwner = await MockWallet.createWithBalance(provider, 1);
//     const depositWithFail = user.deposit({
//       amount: pTokenAmount,
//       owner: invalidOwner,
//     });

//     await expect(depositWithFail).to.eventually.be.rejectedWith(
//       'failed ({"err":{"InstructionError":[0,{"Custom":6103}]}})'
//     );
//   });

//   it("validation errors", async () => {});

//   it("can be deposited", async () => {
//     const user = await MockUser.create({ provider, poolInfo: stakePool });
//     const pTokenAmount = new anchor.BN(10_000_000);
//     await stakePool.pTokenMint.mintTo(user.wallet, pTokenAmount);
//     await user.deposit({
//       amount: pTokenAmount,
//     });
//     const userAccount = await user.fetch();
//     checkPoolUser({
//       poolUser: userAccount,
//       poolInfo: stakePool.address,
//       owner: user.wallet.publicKey,
//       depositAmount: pTokenAmount,
//       claimedAmount: new anchor.BN(0),
//       count: 0,
//     });
//   });

//   it("invalid user owner cannot claim token", async () => {
//     const user = await MockUser.create({ provider, poolInfo: stakePool });
//     const pTokenAmount = new anchor.BN(10_000_000);
//     await stakePool.pTokenMint.mintTo(user.wallet, pTokenAmount);
//     await user.deposit({
//       amount: pTokenAmount,
//     });
//     const invalidOwner = await MockWallet.createWithBalance(provider, 1);
//     const claimWithFail = user.claim({ owner: invalidOwner });
//     await expect(claimWithFail).to.eventually.be.rejectedWith(
//       'failed ({"err":{"InstructionError":[1,{"Custom":6103}]}})'
//     );
//   });

//   it("validation erros", async () => {});

//   it("cannot claim before started time of the pool", async () => {
//     await initPool({
//       startsAt: new anchor.BN(Math.floor(Date.now() / 1000) + 10),
//       claimPeriodUnit: new anchor.BN(1),
//       maxClaimCount: 21,
//     });

//     const user = await MockUser.create({ provider, poolInfo: stakePool });
//     const pTokenAmount = new anchor.BN(10_000_000);
//     await stakePool.pTokenMint.mintTo(user.wallet, pTokenAmount);
//     await user.deposit({
//       amount: pTokenAmount,
//     });
//     const claimWithFail = user.claim();
//     await expect(claimWithFail).to.eventually.be.rejectedWith(
//       'failed ({"err":{"InstructionError":[1,{"Custom":6201}]}})'
//     );
//   });

//   it("can be claimed once per period", async () => {
//     await initPool({
//       startsAt: new anchor.BN(Math.floor(Date.now() / 1000) + 1),
//       claimPeriodUnit: new anchor.BN(3),
//       maxClaimCount: 21,
//     });

//     const user = await MockUser.create({ provider, poolInfo: stakePool });
//     const pTokenAmount = new anchor.BN(10_000_000);
//     await stakePool.pTokenMint.mintTo(user.wallet, pTokenAmount);
//     await user.deposit({
//       amount: pTokenAmount,
//     });
//     const claimWithFail = user.claim();
//     await expect(claimWithFail).to.eventually.be.rejectedWith(
//       'failed ({"err":{"InstructionError":[1,{"Custom":6201}]}})'
//     );
//   });

//   it("cannot claim without setting mint authority", async () => {
//     await initPool({
//       startsAt: new anchor.BN(Math.floor(Date.now() / 1000) + 1),
//       claimPeriodUnit: new anchor.BN(3),
//       maxClaimCount: 21,
//     });
//     const user = await MockUser.create({ provider, poolInfo: stakePool });
//     const pTokenAmount = new anchor.BN(10_000_000);
//     await stakePool.pTokenMint.mintTo(user.wallet, pTokenAmount);
//     await user.deposit({
//       amount: pTokenAmount,
//     });
//     await sleep(3000);
//     const claimWithFail = user.claim();

//     await expect(claimWithFail).to.eventually.be.rejectedWith(
//       'failed ({"err":{"InstructionError":[1,{"Custom":4}]}})'
//     );

//     await stakePool.setMintAuthority();
//     await user.claim();

//     const claimedAmount = pTokenAmount.divn(stakePool.params.maxClaimCount);
//     const userTokenAccount =
//       await stakePool.tokenMint.getAssociatedTokenAccount(
//         user.wallet.publicKey
//       );
//     const userAccount = await user.fetch();

//     checkPoolUser({
//       poolUser: userAccount,
//       poolInfo: stakePool.address,
//       owner: user.wallet.publicKey,
//       depositAmount: pTokenAmount,
//       claimedAmount: claimedAmount,
//       count: 1,
//     });

//     checkTokenAccount({
//       account: userTokenAccount,
//       mint: stakePool.tokenMint.address,
//       amount: claimedAmount,
//     });
//   });

//   it("can be fully claimed once the count reaches max value", async () => {
//     await initPool({
//       startsAt: new anchor.BN(Math.floor(Date.now() / 1000) + 1),
//       claimPeriodUnit: new anchor.BN(1),
//       maxClaimCount: 21,
//     });
//     await stakePool.setMintAuthority();
//     const user = await MockUser.create({ provider, poolInfo: stakePool });
//     const pTokenAmount = new anchor.BN(10_000_000);
//     await stakePool.pTokenMint.mintTo(user.wallet, pTokenAmount);
//     await user.deposit({
//       amount: pTokenAmount,
//     });
//     await sleep(22000);

//     await user.claim();

//     const userTokenAccount =
//       await stakePool.tokenMint.getAssociatedTokenAccount(
//         user.wallet.publicKey
//       );

//     assert.isNull(await user.fetch());

//     checkTokenAccount({
//       account: userTokenAccount,
//       mint: stakePool.tokenMint.address,
//       amount: pTokenAmount,
//     });
//   });
// });
