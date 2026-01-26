# hardhat-multibaas-plugin sample (Hardhat v3)

This sample project deploys and links MetaCoin, Greeter, a linked Greeter instance, and an upgradeable ProxiedGreeter using Ignition modules.

## Requirements

- A running MultiBaas deployment
- A MultiBaas API key with permissions to create contracts/addresses
- A funded account or a dev chain with zero gas price

### Configuration file

This sample reads deployment settings from:

`deployment-config.<network>.js`

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

## Command reference

| Script | Description |
| --- | --- |
| `npm run deploy:metacoin` | Deploys `ConvertLib` + `MetaCoin` and links them to MultiBaas as `convertlib` and `metacoin`. |
| `npm run deploy:greeter` | Deploys `Greeter` ("Hello, world!") and links it to MultiBaas as `greeter`. |
| `npm run deploy:link:greeter` | Deploys a `Greeter` and links that same address as `linked_greeter`. |
| `npm run deploy:proxy:greeter` | Deploys `ProxiedGreeter` + `TransparentUpgradeableProxy` and links the proxy as `proxied_greeter`. |
| `npm run deploy:metacoin:reset` | Resets Ignition state then deploys the MetaCoin module. |
| `npm run deploy:greeter:reset` | Resets Ignition state then deploys the Greeter module. |
| `npm run deploy:link:greeter:reset` | Resets Ignition state then deploys the linked Greeter module. |
| `npm run deploy:proxy:greeter:reset` | Resets Ignition state then deploys the proxied Greeter module. |
| `npm run ignition:wipe <DEPLOYMENT_ID> <FUTURE ID>` | Wipes local Ignition deployment state for `development`. |
| `npm run ignition:deployments <DEPLOYMENT ID>` | Lists Ignition deployments recorded for `development`. |
| `npm run ignition:status <DEPLOYMENT ID>` | Shows Ignition deployment status for `development`. |
| `npm run deploy:all` | Cleans then deploys MetaCoin, Greeter, linked Greeter, and proxied Greeter in order. |
| `npm run test` | Runs the Hardhat test suite for the sample. |


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


### Wipes local Ignition deployment

```sh
npm run wipe chain-1337 GreeterModule#Greeter

> hardhat-multibaas-plugin-sample-v3@1.0.0 wipe
> HARDHAT_NETWORK=development npx hardhat ignition wipe chain-1337 GreeterModule#Greeter

GreeterModule#Greeter state has been cleared
```


## Notes

- `ignition deploy` is overridden by the plugin to upload artifacts and link any futures registered via `mb.link`.
- [`HARDHAT_IGNITION_CONFIRM_DEPLOYMENT=false`](https://hardhat.org/ignition/docs/reference/environment-variables) skips the confirmation shown when deploying to non-local networks.
