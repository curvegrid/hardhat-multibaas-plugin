import type { Artifact, ArtifactManager } from "hardhat/types/artifacts";
import type { SolidityBuildInfoOutput } from "hardhat/types/solidity";

import {
  AddressesApi,
  ChainsApi,
  Configuration,
  ContractsApi,
} from "@curvegrid/multibaas-sdk";

import { readFile } from "node:fs/promises";

import type { MBConfig, MultiBaasLinkOptions } from "../../types.js";
import type {
  Address,
  BaseContract,
  Contract,
} from "@curvegrid/multibaas-sdk";

const DEFAULT_STARTING_BLOCK = "-100";

// Thin helper around the MultiBaas SDK that creates contracts, addresses, and
// links them together using Hardhat artifacts produced by Ignition.
export class MultiBaasClient {
  private readonly _contractsApi: ContractsApi;
  private readonly _addressesApi: AddressesApi;
  private readonly _chainsApi: ChainsApi;
  private readonly _allowUpdateAddress: Set<string>;
  private readonly _allowUpdateContract: Set<string>;
  private readonly _contractCache = new Map<string, Contract>();

  constructor(
    private readonly _config: MBConfig,
    private readonly _networkName: string,
    private readonly _artifacts: ArtifactManager,
  ) {
    const basePath = new URL("/api/v0", this._config.host).toString();
    const configuration = new Configuration({
      accessToken: this._config.apiKey,
      basePath,
    });

    this._contractsApi = new ContractsApi(configuration);
    this._addressesApi = new AddressesApi(configuration);
    this._chainsApi = new ChainsApi(configuration);

    this._allowUpdateAddress = new Set(this._config.allowUpdateAddress);
    this._allowUpdateContract = new Set(this._config.allowUpdateContract);
  }

  async setup(): Promise<void> {
    // Verify connectivity and credentials up front.
    await this._chainsApi.getChainStatus();
  }

  async linkDeployedContract(
    contractName: string,
    address: string,
    options: MultiBaasLinkOptions = {},
    libraryAddresses: Record<string, string> = {},
  ): Promise<void> {
    // Create/lookup contract + address and ensure they are linked in MultiBaas.
    const contract = await this._ensureContract(
      contractName,
      options,
      libraryAddresses,
    );
    const mbAddress = await this._ensureAddress(
      address,
      contract.label,
      options,
    );
    await this._ensureLink(contract, mbAddress, options.startingBlock);
  }

  private async _ensureContract(
    contractName: string,
    options: MultiBaasLinkOptions,
    libraryAddresses: Record<string, string> = {},
  ): Promise<Contract> {
    // Load ABI/docs/bytecode from Hardhat outputs and reuse matching versions when possible.
    const { artifact, devdoc, userdoc, metadata } =
      await this._loadArtifactDocs(contractName);
    const bytecode = this._resolveBytecode(artifact, libraryAddresses);
    const rawAbi = JSON.stringify(artifact.abi);

    const contractLabel = options.contractLabel ?? contractName.toLowerCase();

    const cached = this._contractCache.get(
      `${contractLabel}@${options.contractVersion ?? "latest"}`,
    );
    if (cached !== undefined) {
      return cached;
    }

    let contractVersion = options.contractVersion;

    if (contractVersion !== undefined) {
      const existing = await this._tryGetContractVersion(
        contractLabel,
        contractVersion,
      );
      if (existing !== undefined) {
        if (existing.bin !== bytecode) {
          this._ensureUpdateAllowed(
            this._allowUpdateContract,
            "contract",
            contractLabel,
            contractVersion,
          );

          console.log(
            `MultiBaas: Delete old contract ${contractLabel} ${contractVersion} to deploy a new one`,
          );
          await this._contractsApi.deleteContractVersion(
            contractLabel,
            contractVersion,
          );
        } else {
          console.log(
            `MultiBaas: Contract "${existing.contractName} ${existing.version}" already created. Skipping creation.`,
          );
          this._contractCache.set(`${contractLabel}@${contractVersion}`, existing);
          return existing;
        }
      }
    } else {
      const existing = await this._tryGetContract(contractLabel);
      if (existing !== undefined) {
        if (existing.bin === bytecode) {
          console.log(
            `MultiBaas: Contract "${existing.contractName} ${existing.version}" already created. Skipping creation.`,
          );
          this._contractCache.set(
            `${contractLabel}@${existing.version}`,
            existing,
          );
          return existing;
        }

        contractVersion = this._incrementVersion(existing.version);
      } else {
        contractVersion = "1.0";
      }
    }

    console.log(
      `MultiBaas: Creating contract "${contractLabel} ${contractVersion}"`,
    );

    const payload: BaseContract = {
      label: contractLabel,
      contractName,
      version: contractVersion,
      bin: bytecode,
      rawAbi,
      developerDoc: JSON.stringify(devdoc) || "{}",
      userDoc: JSON.stringify(userdoc) || "{}",
      metadata,
    };

    const response = await this._contractsApi.createContract(
      contractLabel,
      payload,
    );
    const created = response.data.result;
    this._contractCache.set(`${contractLabel}@${contractVersion}`, created);
    return created;
  }

  private _resolveBytecode(
    artifact: Artifact,
    libraryAddresses: Record<string, string>,
  ): string {
    // Link library placeholders with provided addresses; warn and zero-fill if missing.
    const normalizedBytecode = stripHexPrefix(artifact.bytecode);
    const references = artifact.linkReferences;
    if (Object.keys(references).length === 0) {
      return `0x${normalizedBytecode}`;
    }

    let linkedBytecode = normalizedBytecode;
    const missingLibraries = new Set<string>();

    for (const libraries of Object.values(references)) {
      for (const [libraryName, refs] of Object.entries(libraries)) {
        const address = libraryAddresses[libraryName];
        if (address === undefined) {
          missingLibraries.add(libraryName);
        }

        for (const ref of refs) {
          const offset = ref.start * 2;
          const length = ref.length * 2;
          const replacement = normalizeHexAddress(address, length);
          linkedBytecode =
            linkedBytecode.slice(0, offset) +
            replacement +
            linkedBytecode.slice(offset + length);
        }
      }
    }

    if (missingLibraries.size > 0) {
      console.warn(
        `MultiBaas: Missing library addresses for ${[...missingLibraries].join(", ")}; using zero address placeholders.`,
      );
    }

    return `0x${linkedBytecode}`;
  }

  private async _ensureAddress(
    address: string,
    contractLabel: string,
    options: MultiBaasLinkOptions,
  ): Promise<Address> {
    // Reuse existing address entries when allowed; otherwise create or replace aliases.
    const existingByAddress = await this._tryGetAddress(address);
    if (existingByAddress !== undefined && existingByAddress.alias !== "") {
      if (
        options.addressAlias !== undefined &&
        options.addressAlias !== existingByAddress.alias
      ) {
        throw new Error(
          `MultiBaas: The address ${address} already exists under alias "${existingByAddress.alias}"`,
        );
      }

      console.log(
        `MultiBaas: Address ${address} already created as "${existingByAddress.alias}"`,
      );
      return existingByAddress;
    }

    let addressAlias = options.addressAlias;
    if (addressAlias === undefined) {
      const aliasesResponse = await this._addressesApi.listAddresses();
      const allAliases = new Set(
        aliasesResponse.data.result.map((item) => item.alias),
      );
      addressAlias = this._pickUniqueAlias(contractLabel, allAliases);
    } else {
      const existingAlias = await this._tryGetAddress(addressAlias);
      if (existingAlias !== undefined) {
        this._ensureUpdateAllowed(
          this._allowUpdateAddress,
          "address",
          addressAlias,
        );

        console.log(
          `MultiBaas: Deleting old address ${existingAlias.address} with alias "${addressAlias}"`,
        );
        await this._addressesApi.deleteAddress(addressAlias);
      }
    }

    console.log(
      `MultiBaas: Creating address ${address} with alias "${addressAlias}"`,
    );

    const created = await this._addressesApi.setAddress({
      address,
      alias: addressAlias,
    });

    return created.data.result;
  }

  private async _ensureLink(
    contract: Contract,
    address: Address,
    startingBlock?: string,
  ): Promise<Address> {
    // Attach a contract version to an address if not already linked.
    const normalizedStartingBlock =
      startingBlock === undefined ? DEFAULT_STARTING_BLOCK : startingBlock;

    if (
      address.contracts.some(
        (item) => item.label === contract.label && item.version === contract.version,
      )
    ) {
      console.log(
        `MultiBaas: Contract "${contract.label} ${contract.version}" already linked to address "${address.alias}"`,
      );
      return address;
    }

    console.log(
      `MultiBaas: Linking contract "${contract.label} ${contract.version}" to address "${address.alias}"`,
    );

    const response = await this._contractsApi.linkAddressContract(
      address.alias,
      {
        label: contract.label,
        version: contract.version,
        startingBlock: normalizedStartingBlock,
      },
    );

    return response.data.result;
  }

  private _pickUniqueAlias(base: string, existing: Set<string>): string {
    if (!existing.has(base)) {
      return base;
    }

    let suffix = 2;
    while (existing.has(`${base}${suffix}`)) {
      suffix += 1;
    }

    return `${base}${suffix}`;
  }

  private _ensureUpdateAllowed(
    allowList: Set<string>,
    target: "contract" | "address",
    label: string,
    version?: string,
  ): void {
    if (allowList.has(this._networkName)) {
      return;
    }

    const id = version === undefined ? label : `${label} ${version}`;

    throw new Error(
      `MultiBaas: A different ${target} "${id}" already exists and updates are disabled for network "${this._networkName}"`,
    );
  }

  private async _tryGetContract(
    contractLabel: string,
  ): Promise<Contract | undefined> {
    try {
      const response = await this._contractsApi.getContract(contractLabel);
      return response.data.result;
    } catch (error) {
      if (isNotFoundError(error)) {
        return undefined;
      }
      throw error;
    }
  }

  private async _tryGetContractVersion(
    contractLabel: string,
    contractVersion: string,
  ): Promise<Contract | undefined> {
    try {
      const response = await this._contractsApi.getContractVersion(
        contractLabel,
        contractVersion,
      );
      return response.data.result;
    } catch (error) {
      if (isNotFoundError(error)) {
        return undefined;
      }
      throw error;
    }
  }

  private async _tryGetAddress(
    addressOrAlias: string,
  ): Promise<Address | undefined> {
    try {
      const response = await this._addressesApi.getAddress(addressOrAlias);
      return response.data.result;
    } catch (error) {
      if (isNotFoundError(error)) {
        return undefined;
      }
      throw error;
    }
  }

  private _incrementVersion(version: string): string {
    if (/\d+$/.exec(version)) {
      return version.replace(/\d+$/, (value) => {
        const parsed = Number.parseInt(value, 10);
        return Number.isNaN(parsed) ? "2" : `${parsed + 1}`;
      });
    }

    return `${version}2`;
  }

  private async _loadArtifactDocs(contractName: string): Promise<{
    artifact: Awaited<ReturnType<ArtifactManager["readArtifact"]>>;
    devdoc?: unknown;
    userdoc?: unknown;
    metadata?: string;
  }> {
    const artifact = await this._artifacts.readArtifact(contractName);

    const buildInfoId = await this._artifacts.getBuildInfoId(contractName);
    if (buildInfoId === undefined) {
      return { artifact };
    }

    const outputPath = await this._artifacts.getBuildInfoOutputPath(buildInfoId);
    if (outputPath === undefined) {
      return { artifact };
    }

    const output = await readJson<SolidityBuildInfoOutput>(outputPath);

    const sourceName = artifact.inputSourceName ?? artifact.sourceName;
    const contractOutput = output.output.contracts?.[sourceName]?.[
      artifact.contractName
    ] as { devdoc?: unknown; userdoc?: unknown; metadata?: string } | undefined;

    return {
      artifact,
      devdoc: contractOutput?.devdoc,
      userdoc: contractOutput?.userdoc,
      metadata: contractOutput?.metadata,
    };
  }
}

async function readJson<T>(filePath: string): Promise<T> {
  const contents = await readFile(filePath, "utf8");
  return JSON.parse(contents) as T;
}

function stripHexPrefix(value: string): string {
  return value.startsWith("0x") ? value.slice(2) : value;
}

function normalizeHexAddress(
  address: string | undefined,
  length: number,
): string {
  if (address === undefined) {
    return "0".repeat(length);
  }

  let normalized = address.toLowerCase();
  if (normalized.startsWith("0x")) {
    normalized = normalized.slice(2);
  }

  if (!/^[0-9a-f]*$/.test(normalized)) {
    return "0".repeat(length);
  }

  if (normalized.length > length) {
    normalized = normalized.slice(-length);
  }

  return normalized.padStart(length, "0");
}

function isNotFoundError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const response = (error as { response?: { status?: number } }).response;
  return response?.status === 404;
}
