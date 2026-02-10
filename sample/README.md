# hardhat-multibaas-plugin sample (Hardhat v3)

This sample project deploys and links MetaCoin, Greeter, a linked Greeter instance, and an upgradeable ProxiedGreeter using Ignition modules.
It is wired to the local plugin source during development.

## Requirements

- A running MultiBaas deployment
- A MultiBaas API key with permissions to create contracts/addresses
- A funded account or a dev chain with zero gas price

### Configuration file

This sample reads deployment settings from:

`deployment-config.<network>.ts`

The network name comes from `HARDHAT_NETWORK` (defaults to `HARDHAT_NETWORK=development`). The file must include:

- `deploymentEndpoint`
- `ethChainID`
- `web3Key`
- `adminApiKey`
- `deployerPrivateKey`

## Install

From the plugin root:

```bash
npm install
npm run build
```

Then install the sample dependencies:

```bash
cd sample
npm install
```

Note:
- `sample/package.json` depends on `hardhat-multibaas-plugin` via a local path (`".."`). If you want this sample to run outside this repo, change that dependency to a published version or a different local path.

## Command reference

| Script | Description |
| --- | --- |
| `npm run deploy:metacoin` | Deploys `ConvertLib` + `MetaCoin` and links them to MultiBaas as `convertlib` and `metacoin`. |
| `npm run deploy:greeter` | Deploys `Greeter` ("Hello, world!") and links it to MultiBaas as `greeter`. |
| `npm run deploy:link:greeter` | Deploys a `Greeter` and links that same address as `linked_greeter`. |
| `npm run deploy:proxy:greeter` | Deploys `ProxiedGreeter` + `TransparentUpgradeableProxy` and links the proxy as `proxied_greeter`. |
| `npm run deploy:series` | Deploys the Series contracts (registry, token, vault, factory) and links each to MultiBaas. |
| `npm run deploy:metacoin:reset` | Resets Ignition state then deploys the MetaCoin module. |
| `npm run deploy:greeter:reset` | Resets Ignition state then deploys the Greeter module. |
| `npm run deploy:link:greeter:reset` | Resets Ignition state then deploys the linked Greeter module. |
| `npm run deploy:proxy:greeter:reset` | Resets Ignition state then deploys the proxied Greeter module. |
| `npm run deploy:series:reset` | Resets Ignition state then deploys the Series module. |
| `npm run ignition:wipe <DEPLOYMENT_ID> <FUTURE_ID>` | Wipes local Ignition deployment state for `development`. |
| `npm run ignition:deployments` | Lists Ignition deployments recorded for `development`. |
| `npm run ignition:status <DEPLOYMENT_ID>` | Shows Ignition deployment status for `development`. |
| `npm run deploy:all` | Cleans then deploys MetaCoin, Greeter, linked Greeter, proxied Greeter, and Series in order. |
| `npm run test` | Runs the Hardhat test suite for the sample. |

[`:reset`](https://hardhat.org/ignition/docs/guides/modifications#clearing-an-existing-deployment-with-reset) clears a failed or incompatible Hardhat Ignition deployment's state in the local journal, allowing you to restart it from scratch, while [`:wipe`](https://hardhat.org/ignition/docs/reference/cli-commands#wipe) specifically targets individual failed futures or entire deployments (using deploymentId and futureId) to force a re-run when modifications break compatibility or errors occur, effectively making the deployment directory ready for a fresh attempt on your local network.

### Deploy

```bash
npm run deploy:metacoin
npm run deploy:greeter
```

### Deploy then link a Greeter instance

This module deploys a Greeter, then links the same address under the `linked_greeter`
alias in MultiBaas:

```bash
npm run deploy:link:greeter
```

### Deploy the proxy

```bash
npm run deploy:proxy:greeter
```

### Deploy the Series module

The Series module deploys four contracts in order and wires them by constructor
inputs: `SeriesRegistry`, `SeriesToken`, `SeriesVault`, and `SeriesFactory`.
This is useful for testing Ignition wipes and re-runs on only part of a
multi-contract graph.

```bash
npm run deploy:series
```

### Wipes local Ignition deployment

#### `<DEPLOYMENT_ID>` and `<FUTURE_ID>`

```sh
npm run deploy:greeter

> hardhat-multibaas-plugin-sample-v3@1.0.0 deploy:greeter
> npm run deploy:base -- ignition/modules/GreeterModule.ts


> hardhat-multibaas-plugin-sample-v3@1.0.0 deploy:base
> HARDHAT_NETWORK=development HARDHAT_IGNITION_CONFIRM_DEPLOYMENT=false hardhat ignition deploy ignition/modules/GreeterModule.ts

[ GreeterModule ] Nothing new to deploy based on previous execution stored in ./ignition/deployments/chain-1337

Deployed Addresses

MetaCoinModule#ConvertLib - 0xB20dEb4b029A437328B3D2a469C798A642e3C291
MetaCoinModule#MetaCoin - 0xd5f2C4B4b5eC92d8B7523261E4D6CEffe0e09050
GreeterModule#Greeter - 0x7b4b9391Faf8436950a545b685e358e9dce769C7
LinkedGreeterModule#Greeter - 0x2A3b22dC6c31474eC563f576F2BA129950559aC2
LinkedGreeterModule#LinkedGreeter - 0x2A3b22dC6c31474eC563f576F2BA129950559aC2
ProxiedGreeterModule#ProxiedGreeter - 0x3e4D6Cd8d0C9bf05cE912F9eb7cfCC86Ce407013
ProxiedGreeterModule#TransparentUpgradeableProxy - 0x7A8a2B2E5813f5a95D7E9eB6c0B7a1929b70c577
ProxiedGreeterModule#ProxiedGreeterProxy - 0x7A8a2B2E5813f5a95D7E9eB6c0B7a1929b70c577
ProxiedGreeterModule#ProxyAdmin - 0xcDD7B81327e95997a75Dc6b22A0A8b0b409b00a3
MultiBaas: Contract "Greeter 1.0" already created. Skipping creation.
MultiBaas: Address 0x7b4b9391Faf8436950a545b685e358e9dce769C7 already created as "greeter"
MultiBaas: Contract "greeter 1.0" already linked to address "greeter"

# ⚠️ <chain-1337> is DEPLOYMENT ID
# ⚠️ MetaCoinModule#ConvertLib is one of FUTURE IDs
```

```sh
npm run ignition:wipe chain-1337 GreeterModule#Greeter

> hardhat-multibaas-plugin-sample-v3@1.0.0 wipe
> HARDHAT_NETWORK=development npx hardhat ignition wipe chain-1337 GreeterModule#Greeter

GreeterModule#Greeter state has been cleared
```


## Notes

- `ignition deploy` is overridden by the plugin to upload artifacts and link any futures registered via `mb.link`.
- [HARDHAT_IGNITION_CONFIRM_DEPLOYMENT=false](https://hardhat.org/ignition/docs/reference/environment-variables) skips the confirmation shown when deploying to non-local networks.
- [CLI commands](https://hardhat.org/ignition/docs/reference/cli-commands)
