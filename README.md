# hardhat-multibaas-plugin

Integrate [MultiBaas](https://docs.curvegrid.com/multibaas/) into your [Hardhat](https://hardhat.org/getting-started/) workflow!

This plugin streamlines your development by automatically adding smart contracts deployed through Hardhat to MultiBaas, reducing manual effort. From there, you can manage your smart contracts via the MultiBaas web UI and build blockchain applications using its REST API and SDKs.

For more details about MultiBaas, check out our [introductory walkthrough](https://www.curvegrid.com/blog/2020-04-06-multibaas-intro/) and [developer documentation](https://docs.curvegrid.com/multibaas/).

## Usage

### Installation

On your Hardhat workspace, set up a `package.json` file (if not yet added) with

```bash
npm init
```

or

```bash
yarn init
```

Then, add the `hardhat-multibaas-plugin` package:

```bash
npm i hardhat-multibaas-plugin --save-dev
```

or

```bash
yarn add hardhat-multibaas-plugin -D
```

### Configuration

To configure `hardhat-multibaas-plugin`, you need to define a `MBConfig` configuration option:

```typescript
/**
 * A configuration option used to configure MultiBaas Deployer.
 *
 * @field host the MultiBaas instance's host URL
 * @field apiKey the API key used to deploy a smart contract
 * @field allowUpdateAddress a list of networks that support overriding an address
 * if there exists an address on MultiBaas with the same alias.
 * @field allowUpdateContract a list of networks that support overriding a contract
 * if there exists a contract on MultiBaas with the same (label, version) but
 * different bytecode. */
interface MBConfig {
  host: string;
  apiKey: string;
  allowUpdateAddress: string[];
  allowUpdateContract: string[];
}
```

To use `hardhat-multibaas-plugin` with `hardhat`, configure the `networks` and `mbConfig` fields in your `hardhat.config.ts` as follows:

```typescript
import "hardhat-multibaas-plugin";

module.exports = {
  defaultNetwork: "development",
  networks: {
    development: {
      url: `<YOUR MULTIBAAS DEPLOYMeENT URL>/web3/<YOUR API KEY>`,
      chainId: `<NETWORK's CHAIN ID>`,
      accounts: ["<ACCOUNT 1's PRIVATE KEY>", "<ACCOUNT 2's PRIVATE KEY>"],
    },
  },
  mbConfig: {
    apiKey: "<YOUR API KEY>",
    host: "<YOUR MULTIBAAS DEPLOYMENT URL>",
    allowUpdateAddress: ["development"],
    allowUpdateContract: ["development"],
  },
  // other hardhat configurations...
};
```

A sample configuration file can be found in the [sample folder](./sample/hardhat.config.ts)

### Testing/Deploying smart contracts

See the [sample folder](./sample) for a complete **Geting Started** guide with `hardhat-multibaas-plugin`.

The plugin uses a single `deploy` function to upload a smart contract's artifact, deploy then link the contract on MultiBaas:

```typescript
deploy: (
  // A `ethers.js` Signer or a `hardhat-ethers` FactoryOptions
  signerOrOptions: Signer | FactoryOptions,
  contractName: string,
  contractArguments?: unknown[],
  options?: DeployOptions,
) => Promise<DeployResult>;
```

in which `DeployResult` is the data returned from a successful deployment using the plugin. It has the following fields:

```typescript
/**
 * Result of MultiBaas Deployer's deploy function.
 *
 * @field contract an `ethers.js`'s `Contract`
 * @field mbContract a MultiBaas contract
 * @field mbAddress a MultiBaas address
 **/
export interface DeployResult {
  contract: Contract;
  mbContract: MultiBaasContract;
  mbAddress: MultiBaasAddress;
}
```

`DeployOptions` consists of different options that you can specify when deploying a contract using the plugin. It has the following fields:

```typescript
export interface DeployOptions {
  /**
   * Overwrite the default contractLabel. If set and a duplicate is found,
   * the contract is assigned a newer version.
   */
  contractLabel?: string;
  /**
   * Version override. Will fail if another binary with the same version is found.
   */
  contractVersion?: string;
  /**
   * Overwrite the default address alias. If set and a duplicate is found,
   * the address is instead updated (or returned with an error, chosen by global setting `allowUpdateAddress`).
   *
   * The auto-generated address alias is never a duplicate.
   */
  addressAlias?: string;

  /**
   * Override the default deploy transaction arguments
   * (gasLimit, gasPrice, etc)
   **/
  overrides?: unknown;

  /**
   * The kind of the proxy. Defaults to 'transparent'.
   **/
  proxyKind?: "uups" | "transparent" | "beacon";

  /**
   * The block to start syncing the contract from.
   *
   * empty string: disable the MultiBaas Event Monitor
   *  0: sync from the first block
   * <0: sync from this number of blocks prior to the current block
   * >0: sync from a specific block number
   *
   * Defaults to -100, or 100 blocks prior to the current block.
   **/
  startingBlock?: string;
}
```

The `deployProxy` function will deploy a proxied smart contract that uses [OpenZeppelin's Hardhat Upgrades plugin](https://docs.openzeppelin.com/upgrades-plugins/1.x/hardhat-upgrades). It automatically deploys the implementation contract, proxy, and admin, as required, and then links the proxy smart contract. It defaults to a 'transparent' proxy type, but can be overridden.

```typescript
deployProxy: (
  signerOrOptions: Signer | FactoryOptions,
  contractName: string,
  contractArguments?: unknown[],
  options?: DeployOptions,
) => Promise<DeployProxyResult>;
```

in which the `DeployProxyResult` extends the data included in `DeployResult` with the following additional fields:

```typescript
export interface DeployProxyResult extends DeployResult {
  adminAddress: string;
  implementationAddress: string;
}
```

For contracts that have been deployed outside of `hardhat-multibaas-plugin`, it is possible to simply link them in MultiBaas by calling the `link` function and providing the deployed address.

```typescript
link: (
  signerOrOptions: Signer | FactoryOptions,
  contractName: string,
  address: string,
  options?: DeployOptions,
) => Promise<DeployResult>;
```

## Copyright

Copyright (c) 2021 Curvegrid Inc.
