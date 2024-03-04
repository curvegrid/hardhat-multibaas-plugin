import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import 'hardhat-multibaas-plugin';
import path from 'path';

let deployerPrivateKey = '0x0000000000000000000000000000000000000000000000000000000000000000';
let deploymentEndpoint, ethChainID, web3Key, adminApiKey;

if (process.env.HARDHAT_NETWORK) {
  const CONFIG_FILE = path.join(__dirname, `./deployment-config.${process.env.HARDHAT_NETWORK}`);
  ({
    deploymentConfig: { deploymentEndpoint, ethChainID, deployerPrivateKey, web3Key, adminApiKey },
  } = require(CONFIG_FILE));
}

const config: HardhatUserConfig = {
  networks: {
    development: {
      url: `${deploymentEndpoint}/web3/${web3Key}`,
      chainId: ethChainID,
      accounts: [deployerPrivateKey],
    },
  },
  mbConfig: {
    apiKey: adminApiKey,
    host: deploymentEndpoint,
    allowUpdateAddress: ['development'],
    allowUpdateContract: ['development'],
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  mocha: {
    timeout: 20000,
  },
  solidity: "0.8.13",
};

export = config;
