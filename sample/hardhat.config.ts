// Copyright (c) 2021 Curvegrid Inc.

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { HardhatUserConfig, task, types } from "hardhat/config";
import "hardhat-multibaas-plugin";
import { URL } from "url";
import { deployGreeterContract, deployProxiedGreeterContract, deployMetaCoinContract } from "./deploy";

const APIKey = "MB_PLUGIN_API_KEY";

const apiKey = process.env[APIKey] || "";
const mnemonic = "a sample, yet simple mnemonic";

// create a task to deploy smart contracts defined in `./contracts`
task("deploy", "Deploy sample contracts")
  .addParam("contract", "The deploy contract's name")
  .addOptionalParam(
    "signerId",
    "The index of the signer in the account list used to deploy contract",
    0,
    types.int
  )
  .setAction(async (args, hre) => {
    const contractName = args.contract as string;
    let id = args.signer_id;
    const signers = await hre.ethers.getSigners();
    if (id >= signers.length) {
      throw new Error(
        `signerId is ${id} but there are only ${signers.length} signers in total`
      );
    }
    const signer = signers[id] as SignerWithAddress;

    if (contractName.toLowerCase() === "metacoin") {
      return deployMetaCoinContract(signer, hre);
    }
    if (contractName.toLowerCase() === "greeter") {
      return deployGreeterContract(signer, hre);
    }
    throw new Error(`unknown contract: ${contractName}`);
  });

// create a task to deploy proxied smart contracts defined in `./contracts`
task("deployProxy", "Deploy sample proxied contracts")
  .addParam("contract", "The deploy contract's name")
  .addOptionalParam(
    "signerId",
    "The index of the signer in the account list used to deploy contract",
    0,
    types.int
  )
  .setAction(async (args, hre) => {
    const contractName = args.contract as string;
    let id = args.signer_id;
    const signers = await hre.ethers.getSigners();
    if (id >= signers.length) {
      throw new Error(
        `signerId is ${id} but there are only ${signers.length} signers in total`
      );
    }
    const signer = signers[id] as SignerWithAddress;

    if (contractName.toLowerCase() === "proxied_greeter") {
      return deployProxiedGreeterContract(signer, hre);
    }
    throw new Error(`unknown contract: ${contractName}`);
  });

const config: HardhatUserConfig = {
  defaultNetwork: "development",
  networks: {
    development: {
      url: `http://localhost:8080/web3/${apiKey}`,
      chainId: 25846,
      accounts: {
        mnemonic,
      },
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
    apiKey,
    host: new URL("http://localhost:8080"),
    allowUpdateAddress: ["development"],
    allowUpdateContract: ["development"],
  },
  solidity: "0.8.13",
};

export = config;
