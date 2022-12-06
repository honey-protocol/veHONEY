# $HONEY stake / locker programs

## Programs

### Stake

- Stake [$pHONEY](https://docs.honey.finance/tokenomics/phoney) to be rewarded [$HONEY](https://docs.honey.finance/tokenomics/honey) daily basis
- Stake [$pHONEY](https://docs.honey.finance/tokenomics/phoney) to step-lock [$HONEY](https://docs.honey.finance/tokenomics/honey) in locker program to hold [$veHONEY](https://docs.honey.finance/tokenomics/vehoney) voting power in DAO

### Locker

- Lock $HONEY to hold the period-based $veHONEY voting power.
- Unlock $HONEY from Escrow at lock-end time.
- Lock HGB NFT to hold the statically period-based $veHONEY voting power.
- Claim rewards by locking HGB NFT annual-based.
- Activate proposal with applicable $veHONEY amount.
- Cast vote with $veHONEY.

### Addresses

| Program | Devnet | Mainnet-beta |
| ------- | ------ | ------------ |
|  Stake  | `4V68qajTiVHm3Pm9fQoV8D4tEYBmq3a34R9NV5TymLr7` | `4V68qajTiVHm3Pm9fQoV8D4tEYBmq3a34R9NV5TymLr7` |
| VeHoney (Locker) | `CKQapf8pWoMddT15grV8UCPjiLCTHa12NRgkKV63Lc7q` | `CKQapf8pWoMddT15grV8UCPjiLCTHa12NRgkKV63Lc7q` |

## Localnet Test

To test in localnet, should pull the external program binaries first.

```bash
./scripts/pull_artifacts.sh
```

Run as following then

```bash
./scripts/run_test.sh
```

### Migration

To build migration script

```bash
yarn install && yarn build:mig
```

Run migration script

```bash
anchor migrate --provider.cluster devnet
```

If you need the keypairs to sign the transactions, let me know.
