# hardhat-multibaas-plugin sample (Hardhat v3)

This sample project deploys and links MetaCoin, Greeter, a linked Greeter instance, and an upgradeable ProxiedGreeter using Ignition modules.

## Requirements

- A running MultiBaas deployment
- A MultiBaas API key with permissions to create contracts/addresses
- A funded account or a dev chain with zero gas price

### Configuration file

This sample reads deployment settings from:

`hardhat-multibaas-plugin/sample/deployment-config.<network>.js`

The network name comes from `HARDHAT_NETWORK` (defaults to `development`). The file must include:

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

## Deploy

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

### Deploy the proxy example

```bash
npm run deploy:proxy:greeter
```

## Notes

- `ignition deploy` is overridden by the plugin to upload artifacts and link any futures registered via `mb.link`.
- The expected MultiBaas API call sequence should match the v2 baseline logs in `supplementary/multibaas_logs.txt`.
