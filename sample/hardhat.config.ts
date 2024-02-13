// Copyright (c) 2021 Curvegrid Inc.

import "@nomicfoundation/hardhat-toolbox";
import { HardhatUserConfig } from "hardhat/config";
import "hardhat-multibaas-plugin";
import path from 'node:path';

// Retrieve and process the config file
const CONFIG_FILE = path.join(__dirname, `./deployment-config.${process.env.HARDHAT_NETWORK || 'development'}`);
const {
  deploymentConfig: {
    deploymentEndpoint,
    ethChainID,
    deployerPrivateKey,
    web3Key,
    adminApiKey
  }
} = require(CONFIG_FILE);

const config: HardhatUserConfig = {
  defaultNetwork: "development",
  networks: {
    development: {
      url: `${deploymentEndpoint}/web3/${web3Key}`,
      chainId: ethChainID,
      accounts: [ deployerPrivateKey ],
    },
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
  mbConfig: {
    apiKey: adminApiKey,
    host: deploymentEndpoint,
    allowUpdateAddress: ["development"],
    allowUpdateContract: ["development"],
  },
  solidity: "0.8.13",
};

export = config;
