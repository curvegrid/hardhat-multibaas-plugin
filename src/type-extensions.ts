// Copyright (c) 2021 Curvegrid Inc.

import { FactoryOptions } from "@nomicfoundation/hardhat-ethers/types";
import { Contract, Interface, Signer } from "ethers";
import "hardhat/types/config";
import "hardhat/types/runtime";
import { MultiBaasAddress, MultiBaasContract } from "./multibaasApi";

export type Receipt = {
  blockNumber: number;
};
export interface Deployment {
  address: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  abi: any[];
  receipt?: Receipt;
  bytecode?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  userdoc?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  devdoc?: any;
}

export interface SubmitResult {
  mbContract: MultiBaasContract;
  mbAddress: MultiBaasAddress;
}

/**
 * Result of MultiBaas Deployer's deploy function.
 *
 * @field contract an `ethers.js`'s `Contract`
 * @field mbContract a MultiBaas contract
 * @field mbAddress a MultiBaas address
 **/
export interface DeployResult extends SubmitResult {
  contract: Contract;
}

export interface DeployProxyResult extends DeployResult {
  adminAddress: string;
  implementationAddress: string;
}

/**
 * MultiBaas Deployer's interface.
 *
 * It requires to implement two methods:
 * @method deploy deploy a smart contract using MultiBaas Deployer
 * @method setup setup the Deployer
 **/
export interface MBDeployerI {
  deploy: (
    signerOrOptions: Signer | FactoryOptions,
    contractName: string,
    contractArguments?: unknown[],
    options?: DeployOptions,
  ) => Promise<DeployResult>;
  submitDeployment: (
    name: string,
    address: string,
    iface: Interface,
    bytecode: string,
    devdoc: unknown,
    userdoc: unknown,
    startingBlock: string | undefined,
    options: SubmitOptions,
  ) => Promise<SubmitResult>;
  deployProxy: (
    signerOrOptions: Signer | FactoryOptions,
    contractName: string,
    contractArguments?: unknown[],
    options?: DeployOptions,
  ) => Promise<DeployProxyResult>;
  link: (
    signerOrOptions: Signer | FactoryOptions,
    contractName: string,
    address: string,
    options?: DeployOptions,
  ) => Promise<DeployResult>;
  setup: () => Promise<void>;
}

export interface SubmitOptions {
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
}

/**
 * The deploy options.
 */
export interface DeployOptions extends SubmitOptions {
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

  /**
   * Parameters to pass to the constructor when deploying an upgradeable contract.
   **/
  constructorArgs?: unknown[];
}

declare module "hardhat/types/config" {
  export interface HardhatUserConfig {
    mbConfig?: MBConfig;
  }

  export interface HardhatConfig {
    mbConfig: MBConfig;
  }

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
  export interface MBConfig {
    host: string;
    apiKey: string;
    allowUpdateAddress: string[];
    allowUpdateContract: string[];
    submitOptions?: { [name: string]: SubmitOptions };
  }
}

export interface DeploymentsExtension {
  get(name: string): Promise<Deployment>; // fetch a deployment by name, throw if not existing
  all(): Promise<{ [name: string]: Deployment }>; // return all deployments
}

declare module "hardhat/types/runtime" {
  export interface HardhatRuntimeEnvironment {
    mbDeployer: MBDeployerI;
    deployments: DeploymentsExtension;
  }
}
