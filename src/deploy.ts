// Copyright (c) 2021 Curvegrid Inc.

import {
  FactoryOptions,
  HardhatEthersHelpers,
} from "@nomicfoundation/hardhat-ethers/types";
import {
  HardhatRuntimeEnvironment,
  Artifact,
  BuildInfo,
  MBConfig,
} from "hardhat/types";
import axios, { AxiosRequestConfig } from "axios";
import { ethers, Signer } from "ethers";
import { HardhatUpgrades } from "@openzeppelin/hardhat-upgrades";
import { URL } from "url";
import {
  MultiBaasAddress,
  MultiBaasAPIError,
  MultiBaasAPIResponse,
  MultiBaasContract,
} from "./multibaasApi";
import {
  DeployOptions,
  DeployResult,
  DeployProxyResult,
  MBDeployerI,
} from "./type-extensions";
import path from "path";
import { readJSON } from "fs-extra";
import { ArtifactDBG, ExtendedCompilerOutputContract } from "./types";

type ethersT = typeof ethers & HardhatEthersHelpers;

export class MBDeployer implements MBDeployerI {
  constructor(
    private ethers: ethersT,
    private upgrades: HardhatUpgrades,
    private mbConfig: MBConfig,
    private network: string,
  ) {}

  /**
   * Sets up the Deployer.
   */
  async setup(): Promise<void> {
    // Checks the API key.
    try {
      await this.request("/currentuser");
    } catch (e) {
      throw new Error(
        `MultiBaas authentication failed (check your API key?): ${JSON.stringify(
          e,
        )}`,
      );
    }
  }

  /**
   * Perform an API request to the MultiBaas server.
   * @param path      The relative path of the API, not including `/api/vx`
   * @param config    Any params, queries,... according to Axios config.
   */
  private async request(
    path: string,
    config?: AxiosRequestConfig,
  ): Promise<unknown> {
    if (path.startsWith("/")) path = path.slice(1);
    path = `/api/v0/${path}`;
    const requestURL = new URL(path, this.mbConfig.host);

    const response = await axios(`${requestURL.toString()}`, {
      // Augment the config with some options
      ...config,
      validateStatus: (code) => code < 500, // Only fail on internal errors
      responseType: "json",
      withCredentials: true,
      // `eslint` doesn't play nicely with the assignment of value of `any` type
      // to another value of `any` type.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      headers: {
        Authorization: `Bearer ${this.mbConfig.apiKey}`,
        ...(config?.headers ?? {}),
      },
    });
    if (response.status === 404) {
      // 404s are not that consistent
      throw new MultiBaasAPIError(path, { status: 404, message: "Not found" });
    }
    const data = (await response.data) as MultiBaasAPIResponse;
    if (data.message !== "success") throw new MultiBaasAPIError(path, data);
    return data.result;
  }

  /**
   * Create a MultiBaas contract.
   */
  private async createMBContract(
    contractName: string,
    bytecode: string,
    abi: string,
    options: DeployOptions,
    developerDoc: unknown,
    userDoc: unknown,
  ): Promise<MultiBaasContract> {
    const contractLabel = options.contractLabel ?? contractName.toLowerCase();
    if (contractLabel === undefined) throw new Error("Contract has no name");

    let contractVersion: string | null = null;
    if (options.contractVersion !== undefined) {
      // Try querying the EXACT version
      try {
        const mbContract = (await this.request(
          `/contracts/${contractLabel}/${options.contractVersion}`,
        )) as MultiBaasContract;
        // two contracts are not the same
        if (mbContract.bin !== bytecode) {
          // A different contract with same (contractLabel, contractVersion) exists.
          // We may need to delete the old contract to upload the new one.
          const allowUpdateContract = this.mbConfig.allowUpdateContract;

          // Are we allowed to override the existing contract in the current network?
          if (
            !allowUpdateContract ||
            (allowUpdateContract instanceof Array &&
              allowUpdateContract.indexOf(this.network) === -1)
          ) {
            throw new Error(
              `MultiBaas: A different "${mbContract.contractName} ${mbContract.version}" has already been deployed.`,
            );
          }

          console.log(
            `MultiBaas: Delete the old contract with label=${contractLabel} and version=${options.contractVersion} to deploy a new one`,
          );
          await this.request(
            `/contracts/${contractLabel}/${options.contractVersion}`,
            {
              method: "DELETE",
            },
          );
        } else {
          console.log(
            `MultiBaas: Contract "${mbContract.contractName} ${mbContract.version}" already created. Skipping creation.`,
          );
          return mbContract;
        }
      } catch (e) {
        if (!(e instanceof MultiBaasAPIError) || e.response.status !== 404)
          throw e;
      }
      contractVersion = options.contractVersion;
    } else {
      // First attempt to get a version, by querying the latest version
      try {
        const mbContract = (await this.request(
          `/contracts/${contractLabel}`,
        )) as MultiBaasContract;
        // If contracts share the same bytecode, just return
        if (mbContract.bin === bytecode) {
          console.log(
            `MultiBaas: Contract "${mbContract.contractName} ${mbContract.version}" already created. Skipping creation.`,
          );
          return mbContract;
        }
        let version: string = mbContract.version;
        // Increase it the way the MB frontend does
        if (/\d+$/.exec(version)) {
          version = version.replace(/\d+$/, (v) => `${parseInt(v, 10) + 1}`);
        } else version = `${version}2`;
        contractVersion = contractVersion ?? version;
      } catch (e) {
        if (!(e instanceof MultiBaasAPIError)) throw e; // Not MBResponse
        if (e.response.status !== 404) throw e;
        contractVersion = contractVersion ?? "1.0";
      }
    }

    console.log(
      `MultiBaas: Creating contract "${contractLabel} ${contractVersion}"`,
    );

    const payload: AxiosRequestConfig = {
      method: "POST",
      data: {
        label: contractLabel,
        language: "solidity",
        bin: bytecode,
        // MB expects these to be JSON strings
        rawAbi: abi,
        developerDoc: JSON.stringify(developerDoc) || "{}",
        userDoc: JSON.stringify(userDoc) || "{}",
        version: contractVersion,
        contractName,
      },
    };
    // Upload the contract to MultiBaas
    const mbContract = (await this.request(
      `/contracts/${contractLabel}`,
      payload,
    )) as MultiBaasContract;

    return mbContract;
  }

  /**
   * Gets a MultiBaas contract.
   */
  private async getMBContract(
    contractName: string,
    options: DeployOptions,
  ): Promise<MultiBaasContract> {
    const contractLabel = options.contractLabel ?? contractName.toLowerCase();
    if (contractLabel === undefined) throw new Error("Contract has no name");

    if (options.contractVersion !== undefined) {
      // Try querying the EXACT version
      const mbContract = (await this.request(
        `/contracts/${contractLabel}/${options.contractVersion}`,
      )) as MultiBaasContract;

      return mbContract;
    }

    // Attempt to get a version, by querying the latest version
    const mbContract = (await this.request(
      `/contracts/${contractLabel}`,
    )) as MultiBaasContract;

    return mbContract;
  }

  /**
   * Creates a MultiBaas address instance, with labels!
   */
  private async createMultiBaasAddress(
    address: string,
    contractLabel: string,
    options: DeployOptions,
  ): Promise<MultiBaasAddress> {
    // Check for conflicting addresses
    try {
      const mbAddress = (await this.request(
        `/chains/ethereum/addresses/${address}`,
      )) as MultiBaasAddress;
      if (mbAddress.alias !== "") {
        // If an address already exists, and the user set a different address label
        if (
          options.addressAlias !== undefined &&
          options.addressAlias !== mbAddress.alias
        ) {
          throw new Error(
            `MultiBaas: The address ${address} has already been created under a different alias "${mbAddress.alias}"`,
          );
        }
        console.log(
          `MultiBaas: Address ${address} already created as "${mbAddress.alias}"`,
        );
        return mbAddress;
      }
    } catch (e) {
      if (!(e instanceof MultiBaasAPIError)) throw e; // Not MBResponse
      if (e.response.status !== 404) throw e;
    }

    let addressAlias = options.addressAlias;
    if (addressAlias === undefined) {
      // Attempt to get an unique addressAlias.
      const allAliases: Set<string> = new Set(
        (
          (await this.request(
            `/chains/ethereum/addresses`,
          )) as MultiBaasAddress[]
        ).map((v) => v.alias),
      );
      if (!allAliases.has(contractLabel)) addressAlias = contractLabel;
      else {
        // Same as how MB frontend does it
        let num = 2;
        while (allAliases.has(`${contractLabel}${num}`)) num++;
        addressAlias = `${contractLabel}${num}`;
      }
    } else {
      // We need to confirm if this address exists.
      try {
        const mbAddress = (await this.request(
          `/chains/ethereum/addresses/${addressAlias}`,
        )) as MultiBaasAddress;
        // Ok it does. And it's different.
        // Does the current network support label modifications?
        const allowUpdateAddress = this.mbConfig.allowUpdateAddress;
        if (
          !allowUpdateAddress ||
          (allowUpdateAddress instanceof Array &&
            allowUpdateAddress.indexOf(this.network) === -1)
        ) {
          throw new Error(
            `MultiBaas: Another address ${mbAddress.address} was created under the alias "${addressAlias}"`,
          );
        }
        // Modifications allowed. Just... delete it?
        console.log(
          `MultiBaas: Deleting old address ${mbAddress.address} with same label`,
        );
        await this.request(`/chains/ethereum/addresses/${addressAlias}`, {
          method: "DELETE",
        });
      } catch (e) {
        if (!(e instanceof MultiBaasAPIError) || e.response.status !== 404)
          throw e;
      }
    }

    // Create it
    console.log(
      `MultiBaas: Creating address ${address} with alias "${addressAlias}"`,
    );
    const mbAddress = (await this.request(`/chains/ethereum/addresses`, {
      method: "POST",
      data: {
        address,
        alias: addressAlias,
      },
    })) as MultiBaasAddress;

    return mbAddress;
  }

  /**
   * Link a MB Contract to a MB Address.
   */
  private async linkContractToAddress(
    contract: MultiBaasContract,
    address: MultiBaasAddress,
    startingBlock: string,
  ): Promise<MultiBaasAddress> {
    // First check if the address already has the contract
    for (const c of address.contracts) {
      if (c.label === contract.label && c.version === contract.version) {
        console.log(
          `MultiBaas: Contract "${contract.label} ${contract.version}" is already linked to address "${address.alias}"`,
        );
        return address;
      }
    }
    console.log(
      `MultiBaas: Linking contract "${contract.label} ${contract.version}" to address "${address.alias}"`,
    );
    const mbAddress = (await this.request(
      `/chains/ethereum/addresses/${address.alias}/contracts`,
      {
        method: "POST",
        data: {
          label: contract.label,
          version: contract.version,
          startingBlock: startingBlock,
        },
      },
    )) as MultiBaasAddress;

    return mbAddress;
  }

  /**
   * Normalize an undefined starting block to a sane default of 100 blocks prior to the current one.
   *
   * @param startingBlock a starting block to normalize.
   *
   * @returns a normalied starting block
   */
  private normalizeStartingBlock(startingBlock?: string): string {
    if (startingBlock === undefined) {
      return "-100";
    }

    return startingBlock;
  }

  private async getContractArtifact(contractName: string): Promise<Artifact> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const hre = require("hardhat") as HardhatRuntimeEnvironment;
    return await hre.artifacts.readArtifact(contractName);
  }

  private async getContractBuildInfo(
    contractName: string,
  ): Promise<ExtendedCompilerOutputContract | Record<string, never>> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const hre = require("hardhat") as HardhatRuntimeEnvironment;
    const artifactPaths: string[] = await hre.artifacts.getArtifactPaths();
    for (const artifactPath of artifactPaths) {
      const artifactName = path.basename(artifactPath, ".json");
      if (artifactName !== contractName) {
        continue;
      }
      const artifact = (await readJSON(artifactPath)) as Artifact;
      const artifactDBGPath = path.join(
        path.dirname(artifactPath),
        artifactName + ".dbg.json",
      );
      const artifactDBG = (await readJSON(artifactDBGPath)) as ArtifactDBG;
      const buildInfoPath = path.join(
        path.dirname(artifactDBGPath),
        artifactDBG.buildInfo,
      );
      const buildInfo: BuildInfo = (await readJSON(buildInfoPath)) as BuildInfo;
      const contractBuildInfo =
        buildInfo.output.contracts[artifact.sourceName] || {};
      return (
        (contractBuildInfo[artifactName] as ExtendedCompilerOutputContract) ||
        {}
      );
    }
    return {};
  }

  /**
   * Deploy a contract with `contractName` name using `hardhat-ethers` plugin.
   * The contract's compiled bytecode and its ABI are uploaded to MultiBaas.
   * After a successful deployment, the deployed instance is linked to the corresponding contract on MultiBaas.
   *
   * @param signerOrOptions an `ethers.js`'s `Signer` or a `hardhat-ethers`'s `FactoryOptions` used to
   * get the `ContractFactory` associated with the deploy contract.
   * @param contractName the deploy contract's name as specified in `contracts/`
   * @param contractArguments the deploy contract's constructor arguments
   * @param options an optional `DeployOptions` struct used for uploading
   * and linking the deploy contract on MultiBaas
   *
   * @returns an array consisting of [Contract (`ethers.js`'s `Contract`), MultiBaasContract, MultiBaasAddress] in order
   */
  async deploy(
    signerOrOptions: Signer | FactoryOptions,
    contractName: string,
    contractArguments: unknown[] = [],
    options: DeployOptions = {},
  ): Promise<DeployResult> {
    const factory = await this.ethers.getContractFactory(
      contractName,
      signerOrOptions,
    );

    const artifact = await this.getContractArtifact(contractName);
    const contractBuildInfo = await this.getContractBuildInfo(contractName);

    // after finishing compiling, upload the bytecode and
    // contract's data to MultiBaas
    const mbContract = await this.createMBContract(
      contractName,
      factory.bytecode,
      JSON.stringify(artifact.abi),
      options,
      contractBuildInfo["devdoc"],
      contractBuildInfo["userdoc"],
    );

    if (typeof options.overrides === "object") {
      console.log(
        `MultiBaas: Override the default transaction arguments with ${JSON.stringify(
          options.overrides,
        )}`,
      );

      contractArguments.push(options.overrides);
    }

    const contract = await factory.deploy(...contractArguments);
    await contract.waitForDeployment();

    const startingBlock = this.normalizeStartingBlock(options.startingBlock);

    // create a new instance and linked it to the deployed contract on MultiBaas
    let mbAddress = await this.createMultiBaasAddress(
      await contract.getAddress(),
      mbContract.label,
      options,
    );
    mbAddress = await this.linkContractToAddress(
      mbContract,
      mbAddress,
      startingBlock,
    );

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    return { contract, mbContract, mbAddress };
  }

  /**
   * Deploy a contract and its proxy with `contractName` name using `hardhat-upgrades` plugin.
   * The contract's compiled bytecode and its ABI are uploaded to MultiBaas.
   * After a successful deployment, the deployed instance is linked to the corresponding contract on MultiBaas.
   *
   * @param signerOrOptions an `ethers.js`'s `Signer` or a `hardhat-ethers`'s `FactoryOptions` used to
   * get the `ContractFactory` associated with the deploy contract.
   * @param contractName the deploy contract's name as specified in `contracts/`
   * @param contractArguments the deploy contract's constructor arguments
   * @param options an optional `DeployOptions` struct used for uploading
   * and linking the deploy contract on MultiBaas
   *
   * @returns an array consisting of [Contract (`ethers.js`'s `Contract`), MultiBaasContract, MultiBaasAddress] in order
   */
  async deployProxy(
    signerOrOptions: Signer | FactoryOptions,
    contractName: string,
    contractArguments: unknown[] = [],
    options: DeployOptions = {},
  ): Promise<DeployProxyResult> {
    const factory = await this.ethers.getContractFactory(
      contractName,
      signerOrOptions,
    );

    const artifact = await this.getContractArtifact(contractName);
    const contractBuildInfo = await this.getContractBuildInfo(contractName);

    // after finishing compiling, upload the bytecode and
    // contract's data to MultiBaas
    const mbContract = await this.createMBContract(
      contractName,
      factory.bytecode,
      JSON.stringify(artifact.abi),
      options,
      contractBuildInfo["devdoc"],
      contractBuildInfo["userdoc"],
    );

    if (typeof options.overrides === "object") {
      console.log(
        `MultiBaas: Override the default transaction arguments with ${JSON.stringify(
          options.overrides,
        )}`,
      );

      contractArguments.push(options.overrides);
    }

    // hard default to 'transparent' to avoid any surprises
    if (options.proxyKind === undefined) {
      options.proxyKind = "transparent";
    }

    const contract = await this.upgrades.deployProxy(
      factory,
      contractArguments,
      {
        kind: options.proxyKind,
        constructorArgs: options.constructorArgs,
      },
    );
    await contract.waitForDeployment();

    const adminAddress = await this.upgrades.erc1967.getAdminAddress(
      await contract.getAddress(),
    );
    const implementationAddress =
      await this.upgrades.erc1967.getImplementationAddress(
        await contract.getAddress(),
      );
    const startingBlock = this.normalizeStartingBlock(options.startingBlock);

    // create a new instance and linked it to the deployed contract on MultiBaas
    let mbAddress = await this.createMultiBaasAddress(
      await contract.getAddress(),
      mbContract.label,
      options,
    );
    mbAddress = await this.linkContractToAddress(
      mbContract,
      mbAddress,
      startingBlock,
    );

    return {
      contract,
      mbContract,
      mbAddress,
      adminAddress,
      implementationAddress,
    };
  }

  /**
   * Link a contract with `contractName` name to an address on MultiBaas.
   *
   * @param signerOrOptions an `ethers.js`'s `Signer` or a `hardhat-ethers`'s `FactoryOptions` used to
   * get the `ContractFactory` associated with the deploy contract.
   * @param contractName the deploy contract's name as specified in `contracts/`
   * @param address the deployed contract's address to link
   * @param options an optional `DeployOptions` struct used for uploading
   * and linking the deploy contract on MultiBaas
   *
   * @returns an array consisting of [Contract (`ethers.js`'s `Contract`), MultiBaasContract, MultiBaasAddress] in order
   */
  async link(
    signerOrOptions: Signer | FactoryOptions,
    contractName: string,
    address: string,
    options: DeployOptions = {},
  ): Promise<DeployResult> {
    const factory = await this.ethers.getContractFactory(
      contractName,
      signerOrOptions,
    );

    const contract = factory.attach(address);

    // get a contract that has already been compiled and
    // uploaded to MultiBaas
    const mbContract = await this.getMBContract(contractName, options);

    const startingBlock = this.normalizeStartingBlock(options.startingBlock);

    // create a new instance and linked it to the deployed contract on MultiBaas
    let mbAddress = await this.createMultiBaasAddress(
      await contract.getAddress(),
      mbContract.label,
      options,
    );
    mbAddress = await this.linkContractToAddress(
      mbContract,
      mbAddress,
      startingBlock,
    );

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    return { contract, mbContract, mbAddress };
  }
}
