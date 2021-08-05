# hardhat-multibaas-plugin

Integrate MultiBaas into your [Hardhat](https://hardhat.org/getting-started/) workflow!

MultiBaas is blockchain middleware that makes it fast and easy to develop, deploy, and operate on the Ethereum and OMG blockchain platforms. This plugin makes it easy to deploy contracts to MultiBaas from within your existing Hardhat workflow. Your DApp can then use the MultiBaas REST API to interact with smart contracts.

For more information on MultiBaas, see our [introductory walkthrough](https://www.curvegrid.com/blog/2020-04-06-multibaas-intro/) and our [developer documentation](https://www.curvegrid.com/docs/).

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
 * if there exists an address on MultiBaas with the same label.
 * @field allowUpdateContract a list of networks that support overriding a contract
 * if there exists a contract on MultiBaas with the same (label, version) but
 * different bytecode. */
interface MBConfig {
  host: URL;
  apiKey: string;
  allowUpdateAddress: string[];
  allowUpdateContract: string[];
}
```

To use `hardhat-multibaas-plugin` with `hardhat`, configure the `networks` and `mbConfig` fields in your `hardhat.config.ts` as follows:

```typescript
import "hardhat-multibaas-plugin";
import { URL } from "url";

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
    host: new URL("<YOUR MULTIBAAS DEPLOYMENT URL>"),
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
    options?: DeployOptions
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

`DeployOptions` consists of different options that you can specify when deploying a contract using the plugin. It has following fields:

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
   * Overwrite the default address label. If set and a duplicate is found,
   * the address is instead updated (or returned with an error, chosen by global setting `allowUpdateAddress`).
   *
   * The auto-generated address label is never a duplicate.
   */
  addressLabel?: string;

  /**
   * Override the default deploy transaction arguments
   * (gasLimit, gasPrice, etc)
   **/
  overrides?: unknown;
}
```

## Copyright

Copyright (c) 2021 Curvegrid Inc.
