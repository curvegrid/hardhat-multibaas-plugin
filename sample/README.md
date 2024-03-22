# Testing `hardhat-multibaas-plugin`

## Requirements

This sample project assumes that you already have a MultiBaas deployment setup and a MultiBaas API key provisioned with suitable permissions. The following items will need to be configured.

- Environment variables:

| Variable             | Description                                          |
| -------------------- | ---------------------------------------------------- |
| `MB_PLUGIN_API_KEY`  | MultiBaas API key with Administrator permissions     |
| `MB_PLUGIN_MNEMONIC` | Private key mnemonic to use with Hardhat for testing |

- `hardhat.config.ts` values:

| Entity                                           | `/sample` Value                        | Description                                                                                                                                                            |
| ------------------------------------------------ | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `HardhatUserConfig.networks.development.url`     | `http://localhost:8080/web3/${apiKey}` | If using the Curvegrid Test Network, the host part of the URL should match your deployment. If using a 3rd party web3 provider (Infura, etc.), replace the entire URL. |
| `HardhatUserConfig.networks.development.chainId` | 25846                                  | 2017072401 for Curvegrid Test Network, otherwise the appropriate Chain ID for your blockchain                                                                          |

URL `http://localhost:8080` will need to be replaced with your particular MultiBaas deployment URL, and your Web3 API key will need to be stored in the `MB_PLUGIN_API_KEY` environment variable.

By default, a [HD Wallet](https://hardhat.org/config/#hd-wallet-config) is used by `Hardhat` to generate multiple accounts in the network. To deploy smart contracts, please make sure that those accounts are pre-funded or your `MultiBaas` deployment is running on a blockchain network with `gasPrice=0`. If you don't want to use a HD Wallet, you can specify the `accounts` field in `hardhat.config.ts` to be a list of local accounts (an array of hex-encoded private keys) instead.

For further details or to change the default setup, please refer to the sample configuration file [`hardhat.config.ts`](./hardhat.config.ts).

## Testing/Deploying smart contracts

To run tests in this sample project, first go the parent root project to build the `hardhat-multibaas-plugin` by running

```shell
cd ..
npm install && npm run build
```

After that, go to the `sample` folder, then run `npm install` to install dependencies.

The reason we use `npm` for the sample project is it allows us to use the peer dependencies of `@nomicfoundation/hardhat-toolbox` without having to explicitly add them to the `package.json`.

You can run either `npm run test` to test the project using tests defined in `tests` folder or `npm run deploy:` to execute the target script to deploy a smart contract defined in the [contract folder](./contracts) to MultiBaas. At least two accounts are required to successfully complete the tests.
