import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";

import { MultiBaasClient } from "../dist/internal/multibaas/client.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function axiosOk(result) {
  return { data: { status: 200, message: "success", result } };
}

function notFoundError() {
  const err = new Error("Not found");
  (err as any).response = { status: 404 };
  return err;
}

function createMockContractsApi(overrides = {}) {
  return {
    getContract: mock.fn(async () => {
      throw notFoundError();
    }),
    getContractVersion: mock.fn(async () => {
      throw notFoundError();
    }),
    createContract: mock.fn(async (_label, payload) =>
      axiosOk({
        label: payload.label,
        contractName: payload.contractName,
        version: payload.version,
        bin: payload.bin,
        rawAbi: payload.rawAbi,
        contracts: [],
      }),
    ),
    deleteContractVersion: mock.fn(async () => axiosOk({})),
    linkAddressContract: mock.fn(async (_alias, _req) =>
      axiosOk({
        alias: _alias,
        address: "0x1234",
        chain: "ethereum",
        contracts: [],
      }),
    ),
    ...overrides,
  };
}

function createMockAddressesApi(overrides = {}) {
  return {
    getAddress: mock.fn(async () => {
      throw notFoundError();
    }),
    setAddress: mock.fn(async (payload) =>
      axiosOk({
        alias: payload.alias,
        address: payload.address,
        chain: "ethereum",
        contracts: [],
      }),
    ),
    listAddresses: mock.fn(async () => axiosOk([])),
    deleteAddress: mock.fn(async () => axiosOk({})),
    ...overrides,
  };
}

function createMockChainsApi(overrides = {}) {
  return {
    getChainStatus: mock.fn(async () =>
      axiosOk({ blockNumber: 100, version: "1.0", chainID: 1, networkID: 1 }),
    ),
    ...overrides,
  };
}

function createMockArtifacts(overrides = {}) {
  return {
    readArtifact: mock.fn(async () => ({
      contractName: "Greeter",
      sourceName: "contracts/Greeter.sol",
      abi: [{ type: "function", name: "greet" }],
      bytecode: "0xaabbccdd",
      linkReferences: {},
      deployedBytecode: "0x",
      deployedLinkReferences: {},
    })),
    getBuildInfoId: mock.fn(async () => undefined),
    getBuildInfoOutputPath: mock.fn(async () => undefined),
    ...overrides,
  };
}

function defaultConfig(overrides = {}) {
  return {
    host: "http://localhost:8080",
    apiKey: "test-key",
    allowUpdateAddress: [],
    allowUpdateContract: [],
    syncExisting: false,
    requireChainIdMatch: true,
    ...overrides,
  };
}

function createTestClient({
  config,
  networkName,
  artifacts,
  contractsApi,
  addressesApi,
  chainsApi,
}: {
  config?: ReturnType<typeof defaultConfig>;
  networkName?: string;
  artifacts?: ReturnType<typeof createMockArtifacts>;
  contractsApi?: ReturnType<typeof createMockContractsApi>;
  addressesApi?: ReturnType<typeof createMockAddressesApi>;
  chainsApi?: ReturnType<typeof createMockChainsApi>;
} = {}) {
  const mbConfig = config ?? defaultConfig();
  const client = new MultiBaasClient(
    mbConfig as any,
    networkName ?? "development",
    (artifacts ?? createMockArtifacts()) as any,
  );

  const mocks = {
    contractsApi: contractsApi ?? createMockContractsApi(),
    addressesApi: addressesApi ?? createMockAddressesApi(),
    chainsApi: chainsApi ?? createMockChainsApi(),
  };

  // Replace private API instances at runtime (TS private is not enforced in JS).
  (client as any)._contractsApi = mocks.contractsApi;
  (client as any)._addressesApi = mocks.addressesApi;
  (client as any)._chainsApi = mocks.chainsApi;

  return { client, ...mocks };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

let originalLog: typeof console.log;
let originalWarn: typeof console.warn;

beforeEach(() => {
  originalLog = console.log;
  originalWarn = console.warn;
  console.log = () => {};
  console.warn = () => {};
});

afterEach(() => {
  console.log = originalLog;
  console.warn = originalWarn;
  mock.restoreAll();
});

describe("MultiBaasClient", () => {
  // -----------------------------------------------------------------------
  // setup()
  // -----------------------------------------------------------------------
  describe("setup()", () => {
    it("succeeds when chain IDs match", async () => {
      const { client } = createTestClient();
      await client.setup(1); // mock returns chainID: 1
    });

    it("throws on chain ID mismatch when requireChainIdMatch is true", async () => {
      const chainsApi = createMockChainsApi({
        getChainStatus: mock.fn(async () =>
          axiosOk({ blockNumber: 100, version: "1.0", chainID: 5, networkID: 5 }),
        ),
      });
      const { client } = createTestClient({ chainsApi });

      await assert.rejects(
        () => client.setup(1),
        /Chain ID mismatch \(Hardhat 1, MultiBaas 5\)/,
      );
    });

    it("does not throw when requireChainIdMatch is false", async () => {
      const chainsApi = createMockChainsApi({
        getChainStatus: mock.fn(async () =>
          axiosOk({ blockNumber: 100, version: "1.0", chainID: 5, networkID: 5 }),
        ),
      });
      const { client } = createTestClient({
        config: defaultConfig({ requireChainIdMatch: false }),
        chainsApi,
      });

      await client.setup(1); // should not throw
    });

    it("does not throw when expectedChainId is undefined", async () => {
      const chainsApi = createMockChainsApi({
        getChainStatus: mock.fn(async () =>
          axiosOk({ blockNumber: 100, version: "1.0", chainID: 999, networkID: 999 }),
        ),
      });
      const { client } = createTestClient({ chainsApi });

      await client.setup(undefined); // should not throw
    });
  });

  // -----------------------------------------------------------------------
  // linkDeployedContract() — idempotency
  // -----------------------------------------------------------------------
  describe("linkDeployedContract() idempotency", () => {
    it("skips all ops when address exists with matching linked contract", async () => {
      const addressesApi = createMockAddressesApi({
        getAddress: mock.fn(async () =>
          axiosOk({
            alias: "greeter",
            address: "0x1234",
            chain: "ethereum",
            contracts: [{ label: "greeter", name: "Greeter", version: "1.0" }],
          }),
        ),
      });
      const contractsApi = createMockContractsApi();
      const { client } = createTestClient({ addressesApi, contractsApi });

      await client.linkDeployedContract("Greeter", "0x1234");

      assert.equal(contractsApi.createContract.mock.callCount(), 0);
      assert.equal(contractsApi.linkAddressContract.mock.callCount(), 0);
    });

    it("proceeds when address exists but no matching contract linked", async () => {
      const addressesApi = createMockAddressesApi({
        getAddress: mock.fn(async (addressOrAlias) => {
          if (addressOrAlias === "0x1234") {
            return axiosOk({
              alias: "greeter",
              address: "0x1234",
              chain: "ethereum",
              contracts: [{ label: "other", name: "Other", version: "1.0" }],
            });
          }
          throw notFoundError();
        }),
      });
      const contractsApi = createMockContractsApi();
      const { client } = createTestClient({ addressesApi, contractsApi });

      await client.linkDeployedContract("Greeter", "0x1234");

      assert.equal(contractsApi.createContract.mock.callCount(), 1);
    });
  });

  // -----------------------------------------------------------------------
  // linkDeployedContract() — full flow
  // -----------------------------------------------------------------------
  describe("linkDeployedContract() full flow", () => {
    it("creates contract, address, and link for a new deployment", async () => {
      const contractsApi = createMockContractsApi();
      const addressesApi = createMockAddressesApi();
      const { client } = createTestClient({ contractsApi, addressesApi });

      await client.linkDeployedContract("Greeter", "0xABCD");

      assert.equal(contractsApi.createContract.mock.callCount(), 1);
      assert.equal(addressesApi.setAddress.mock.callCount(), 1);
      assert.equal(contractsApi.linkAddressContract.mock.callCount(), 1);
    });

    it("uses lowercase contractName as default label", async () => {
      const contractsApi = createMockContractsApi();
      const { client } = createTestClient({ contractsApi });

      await client.linkDeployedContract("MyToken", "0xABCD");

      const createCall = contractsApi.createContract.mock.calls[0];
      assert.equal(createCall.arguments[0], "mytoken");
      assert.equal(createCall.arguments[1].label, "mytoken");
    });

    it("uses options.contractLabel when provided", async () => {
      const contractsApi = createMockContractsApi();
      const { client } = createTestClient({ contractsApi });

      await client.linkDeployedContract("MyToken", "0xABCD", {
        contractLabel: "custom-label",
      });

      const createCall = contractsApi.createContract.mock.calls[0];
      assert.equal(createCall.arguments[0], "custom-label");
      assert.equal(createCall.arguments[1].label, "custom-label");
    });
  });

  // -----------------------------------------------------------------------
  // Contract version management
  // -----------------------------------------------------------------------
  describe("contract version management", () => {
    it("creates version 1.0 when contract does not exist", async () => {
      const contractsApi = createMockContractsApi();
      const { client } = createTestClient({ contractsApi });

      await client.linkDeployedContract("Greeter", "0x1234");

      const payload = contractsApi.createContract.mock.calls[0].arguments[1];
      assert.equal(payload.version, "1.0");
    });

    it("reuses existing contract when bytecode matches", async () => {
      const contractsApi = createMockContractsApi({
        getContract: mock.fn(async () =>
          axiosOk({
            label: "greeter",
            contractName: "Greeter",
            version: "1.0",
            bin: "0xaabbccdd",
            rawAbi: "[]",
            contracts: [],
          }),
        ),
        getContractVersion: mock.fn(async () => {
          throw notFoundError();
        }),
        createContract: mock.fn(async (_label, payload) =>
          axiosOk({ ...payload, contracts: [] }),
        ),
        deleteContractVersion: mock.fn(async () => axiosOk({})),
        linkAddressContract: mock.fn(async (_alias) =>
          axiosOk({ alias: _alias, address: "0x1234", chain: "ethereum", contracts: [] }),
        ),
      });
      const { client } = createTestClient({ contractsApi });

      await client.linkDeployedContract("Greeter", "0x1234");

      assert.equal(contractsApi.createContract.mock.callCount(), 0);
    });

    it("increments version when bytecode differs (auto-version)", async () => {
      const contractsApi = createMockContractsApi({
        getContract: mock.fn(async () =>
          axiosOk({
            label: "greeter",
            contractName: "Greeter",
            version: "1.0",
            bin: "0xdeadbeef",
            rawAbi: "[]",
            contracts: [],
          }),
        ),
        getContractVersion: mock.fn(async () => {
          throw notFoundError();
        }),
        createContract: mock.fn(async (_label, payload) =>
          axiosOk({ ...payload, contracts: [] }),
        ),
        deleteContractVersion: mock.fn(async () => axiosOk({})),
        linkAddressContract: mock.fn(async (_alias) =>
          axiosOk({ alias: _alias, address: "0x1234", chain: "ethereum", contracts: [] }),
        ),
      });
      const { client } = createTestClient({ contractsApi });

      await client.linkDeployedContract("Greeter", "0x1234");

      const payload = contractsApi.createContract.mock.calls[0].arguments[1];
      assert.equal(payload.version, "1.1");
    });

    it("creates requested version when explicit and does not exist", async () => {
      const contractsApi = createMockContractsApi();
      const { client } = createTestClient({ contractsApi });

      await client.linkDeployedContract("Greeter", "0x1234", {
        contractVersion: "2.0",
      });

      const payload = contractsApi.createContract.mock.calls[0].arguments[1];
      assert.equal(payload.version, "2.0");
    });

    it("deletes and recreates when explicit version has different bytecode and update allowed", async () => {
      const contractsApi = createMockContractsApi({
        getContract: mock.fn(async () => {
          throw notFoundError();
        }),
        getContractVersion: mock.fn(async () =>
          axiosOk({
            label: "greeter",
            contractName: "Greeter",
            version: "2.0",
            bin: "0xdeadbeef",
            rawAbi: "[]",
            contracts: [],
          }),
        ),
        createContract: mock.fn(async (_label, payload) =>
          axiosOk({ ...payload, contracts: [] }),
        ),
        deleteContractVersion: mock.fn(async () => axiosOk({})),
        linkAddressContract: mock.fn(async (_alias) =>
          axiosOk({ alias: _alias, address: "0x1234", chain: "ethereum", contracts: [] }),
        ),
      });
      const { client } = createTestClient({
        config: defaultConfig({ allowUpdateContract: ["development"] }),
        contractsApi,
      });

      await client.linkDeployedContract("Greeter", "0x1234", {
        contractVersion: "2.0",
      });

      assert.equal(contractsApi.deleteContractVersion.mock.callCount(), 1);
      assert.equal(contractsApi.createContract.mock.callCount(), 1);
    });

    it("throws when explicit version has different bytecode and update not allowed", async () => {
      const contractsApi = createMockContractsApi({
        getContractVersion: mock.fn(async () =>
          axiosOk({
            label: "greeter",
            contractName: "Greeter",
            version: "2.0",
            bin: "0xdeadbeef",
            rawAbi: "[]",
            contracts: [],
          }),
        ),
      });
      const { client } = createTestClient({ contractsApi });

      await assert.rejects(
        () =>
          client.linkDeployedContract("Greeter", "0x1234", {
            contractVersion: "2.0",
          }),
        /updates are disabled for network "development"/,
      );
    });

    it("returns cached contract on second call without extra API call", async () => {
      const contractsApi = createMockContractsApi();
      // First getAddress returns 404, second returns the created address
      let addressCallCount = 0;
      const addressesApi = createMockAddressesApi({
        getAddress: mock.fn(async () => {
          addressCallCount++;
          if (addressCallCount <= 2) {
            // First linkDeployedContract: two getAddress calls (by address + by alias)
            throw notFoundError();
          }
          // Second linkDeployedContract: address lookup for different address
          throw notFoundError();
        }),
      });
      const { client } = createTestClient({ contractsApi, addressesApi });

      await client.linkDeployedContract("Greeter", "0x1111");
      assert.equal(contractsApi.createContract.mock.callCount(), 1);

      await client.linkDeployedContract("Greeter", "0x2222");
      // Contract should be cached — still only 1 create call
      assert.equal(contractsApi.createContract.mock.callCount(), 1);
    });
  });

  // -----------------------------------------------------------------------
  // Address management
  // -----------------------------------------------------------------------
  describe("address management", () => {
    it("creates address with auto-generated alias", async () => {
      const addressesApi = createMockAddressesApi();
      const { client } = createTestClient({ addressesApi });

      await client.linkDeployedContract("Greeter", "0x1234");

      const setCall = addressesApi.setAddress.mock.calls[0];
      assert.equal(setCall.arguments[0].alias, "greeter");
      assert.equal(setCall.arguments[0].address, "0x1234");
    });

    it("reuses existing address with matching alias", async () => {
      const addressesApi = createMockAddressesApi({
        getAddress: mock.fn(async (query) => {
          if (query === "0x1234") {
            return axiosOk({
              alias: "greeter",
              address: "0x1234",
              chain: "ethereum",
              contracts: [],
            });
          }
          throw notFoundError();
        }),
      });
      const contractsApi = createMockContractsApi();
      const { client } = createTestClient({ addressesApi, contractsApi });

      await client.linkDeployedContract("Greeter", "0x1234");

      assert.equal(addressesApi.setAddress.mock.callCount(), 0);
    });

    it("throws when address exists with different alias than requested", async () => {
      const addressesApi = createMockAddressesApi({
        getAddress: mock.fn(async (query) => {
          if (query === "0x1234") {
            return axiosOk({
              alias: "existing-alias",
              address: "0x1234",
              chain: "ethereum",
              contracts: [],
            });
          }
          throw notFoundError();
        }),
      });
      const contractsApi = createMockContractsApi();
      const { client } = createTestClient({ addressesApi, contractsApi });

      await assert.rejects(
        () =>
          client.linkDeployedContract("Greeter", "0x1234", {
            addressAlias: "different-alias",
          }),
        /already exists under alias "existing-alias"/,
      );
    });

    it("generates unique alias suffix when base collides", async () => {
      const addressesApi = createMockAddressesApi({
        listAddresses: mock.fn(async () =>
          axiosOk([
            { alias: "greeter", address: "0xold1" },
            { alias: "greeter2", address: "0xold2" },
          ]),
        ),
      });
      const { client } = createTestClient({ addressesApi });

      await client.linkDeployedContract("Greeter", "0xNEW");

      const setCall = addressesApi.setAddress.mock.calls[0];
      assert.equal(setCall.arguments[0].alias, "greeter3");
    });

    it("deletes and recreates when alias exists and update allowed", async () => {
      const addressesApi = createMockAddressesApi({
        getAddress: mock.fn(async (query) => {
          if (query === "0x1234") {
            throw notFoundError();
          }
          if (query === "my-alias") {
            return axiosOk({
              alias: "my-alias",
              address: "0xOLD",
              chain: "ethereum",
              contracts: [],
            });
          }
          throw notFoundError();
        }),
      });
      const { client } = createTestClient({
        config: defaultConfig({ allowUpdateAddress: ["development"] }),
        addressesApi,
      });

      await client.linkDeployedContract("Greeter", "0x1234", {
        addressAlias: "my-alias",
      });

      assert.equal(addressesApi.deleteAddress.mock.callCount(), 1);
      assert.equal(addressesApi.setAddress.mock.callCount(), 1);
    });

    it("throws when alias exists and update not allowed", async () => {
      const addressesApi = createMockAddressesApi({
        getAddress: mock.fn(async (query) => {
          if (query === "0x1234") {
            throw notFoundError();
          }
          if (query === "my-alias") {
            return axiosOk({
              alias: "my-alias",
              address: "0xOLD",
              chain: "ethereum",
              contracts: [],
            });
          }
          throw notFoundError();
        }),
      });
      const { client } = createTestClient({ addressesApi });

      await assert.rejects(
        () =>
          client.linkDeployedContract("Greeter", "0x1234", {
            addressAlias: "my-alias",
          }),
        /updates are disabled for network "development"/,
      );
    });
  });

  // -----------------------------------------------------------------------
  // Linking
  // -----------------------------------------------------------------------
  describe("linking", () => {
    it("calls linkAddressContract when not already linked", async () => {
      const contractsApi = createMockContractsApi();
      const { client } = createTestClient({ contractsApi });

      await client.linkDeployedContract("Greeter", "0x1234");

      assert.equal(contractsApi.linkAddressContract.mock.callCount(), 1);
    });

    it("skips linking when contract already linked to address", async () => {
      // Address doesn't exist yet; setAddress returns it with the contract already linked.
      const addressesApi = createMockAddressesApi({
        setAddress: mock.fn(async (payload) =>
          axiosOk({
            alias: payload.alias,
            address: payload.address,
            chain: "ethereum",
            contracts: [{ label: "greeter", name: "Greeter", version: "1.0" }],
          }),
        ),
      });
      const contractsApi = createMockContractsApi();
      const { client } = createTestClient({ addressesApi, contractsApi });

      await client.linkDeployedContract("Greeter", "0x1234");

      assert.equal(contractsApi.linkAddressContract.mock.callCount(), 0);
    });

    it("uses default starting block -100 when not specified", async () => {
      const contractsApi = createMockContractsApi();
      const { client } = createTestClient({ contractsApi });

      await client.linkDeployedContract("Greeter", "0x1234");

      const linkCall = contractsApi.linkAddressContract.mock.calls[0];
      assert.equal(linkCall.arguments[1].startingBlock, "-100");
    });

    it("uses custom starting block from options", async () => {
      const contractsApi = createMockContractsApi();
      const { client } = createTestClient({ contractsApi });

      await client.linkDeployedContract("Greeter", "0x1234", {
        startingBlock: "12345",
      });

      const linkCall = contractsApi.linkAddressContract.mock.calls[0];
      assert.equal(linkCall.arguments[1].startingBlock, "12345");
    });
  });

  // -----------------------------------------------------------------------
  // Bytecode library resolution
  // -----------------------------------------------------------------------
  describe("bytecode library resolution", () => {
    it("returns bytecode as-is when no linkReferences", async () => {
      const contractsApi = createMockContractsApi();
      const { client } = createTestClient({ contractsApi });

      await client.linkDeployedContract("Greeter", "0x1234");

      const payload = contractsApi.createContract.mock.calls[0].arguments[1];
      assert.equal(payload.bin, "0xaabbccdd");
    });

    it("replaces library placeholders with provided addresses", async () => {
      // Bytecode: 0x + 2 hex chars of real code + 40 hex chars placeholder + 2 hex chars
      const bytecodeWithPlaceholder = "0xff" + "0".repeat(40) + "ee";
      const artifacts = createMockArtifacts({
        readArtifact: mock.fn(async () => ({
          contractName: "MyToken",
          sourceName: "contracts/MyToken.sol",
          abi: [],
          bytecode: bytecodeWithPlaceholder,
          linkReferences: {
            "contracts/Lib.sol": {
              SafeMath: [{ start: 1, length: 20 }],
            },
          },
          deployedBytecode: "0x",
          deployedLinkReferences: {},
        })),
        getBuildInfoId: mock.fn(async () => undefined),
        getBuildInfoOutputPath: mock.fn(async () => undefined),
      });
      const contractsApi = createMockContractsApi();
      const { client } = createTestClient({ artifacts, contractsApi });

      await client.linkDeployedContract(
        "MyToken",
        "0xADDR",
        {},
        { SafeMath: "0x1234567890123456789012345678901234567890" },
      );

      const payload = contractsApi.createContract.mock.calls[0].arguments[1];
      assert.ok(
        payload.bin.includes("1234567890123456789012345678901234567890"),
        `Expected library address in bytecode, got: ${payload.bin}`,
      );
    });

    it("zero-fills placeholders for missing library addresses", async () => {
      const bytecodeWithPlaceholder = "0xaa" + "0".repeat(40) + "bb";
      const artifacts = createMockArtifacts({
        readArtifact: mock.fn(async () => ({
          contractName: "MyToken",
          sourceName: "contracts/MyToken.sol",
          abi: [],
          bytecode: bytecodeWithPlaceholder,
          linkReferences: {
            "contracts/Lib.sol": {
              MissingLib: [{ start: 1, length: 20 }],
            },
          },
          deployedBytecode: "0x",
          deployedLinkReferences: {},
        })),
        getBuildInfoId: mock.fn(async () => undefined),
        getBuildInfoOutputPath: mock.fn(async () => undefined),
      });
      const contractsApi = createMockContractsApi();
      const { client } = createTestClient({ artifacts, contractsApi });

      await client.linkDeployedContract("MyToken", "0xADDR", {}, {});

      const payload = contractsApi.createContract.mock.calls[0].arguments[1];
      // Should have zero-filled the placeholder (40 zeros)
      assert.ok(
        payload.bin.includes("0".repeat(40)),
        `Expected zero-filled placeholder, got: ${payload.bin}`,
      );
    });
  });
});
