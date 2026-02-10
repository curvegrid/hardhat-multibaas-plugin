import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";

import { DeploymentResultType } from "@nomicfoundation/ignition-core";
import taskAction from "../dist/internal/tasks/ignition-deploy.js";
import { MultiBaasClient } from "../dist/internal/multibaas/client.js";
import {
  getRegisteredLinks,
  registerLink,
  resetRegistry,
} from "../dist/internal/registry.js";

const ORIGINAL_CONFIRM = process.env.HARDHAT_IGNITION_CONFIRM_DEPLOYMENT;

beforeEach(() => {
  process.env.HARDHAT_IGNITION_CONFIRM_DEPLOYMENT = "true";
});

afterEach(() => {
  if (ORIGINAL_CONFIRM === undefined) {
    delete process.env.HARDHAT_IGNITION_CONFIRM_DEPLOYMENT;
  } else {
    process.env.HARDHAT_IGNITION_CONFIRM_DEPLOYMENT = ORIGINAL_CONFIRM;
  }
  delete globalThis.__MB_PLUGIN_DEPLOY__;
  mock.restoreAll();
});

function createHre(configOverrides = {}) {
  return {
    network: {
      connect: async () => ({
        networkName: "development",
        networkConfig: { type: "http" },
        provider: {
          request: async ({ method }) => {
            if (method === "eth_chainId") {
              return "0x1";
            }
            if (method === "eth_accounts") {
              return [];
            }
            if (method === "hardhat_metadata") {
              return { instanceId: "test" };
            }
            return null;
          },
        },
      }),
    },
    config: {
      paths: {
        ignition: "test/fixtures/ignition",
        cache: "cache",
      },
      ignition: {},
      networks: {
        development: {
          ignition: {},
        },
      },
      mbConfig: {
        host: "http://example.com",
        apiKey: "key",
        allowUpdateAddress: [],
        allowUpdateContract: [],
        syncExisting: false,
        requireChainIdMatch: true,
      },
      ...configOverrides,
    },
    tasks: {
      getTask: () => ({
        run: async () => {},
      }),
    },
    artifacts: {
      getBuildInfoId: async () => undefined,
      getBuildInfoPath: async () => undefined,
      readArtifact: async () => ({}),
    },
    interruptions: undefined,
  };
}

function baseArgs(overrides = {}) {
  return {
    modulePath: "test/fixtures/ignition/modules/EmptyModule.ts",
    strategy: "basic",
    reset: false,
    verify: false,
    writeLocalhostDeployment: false,
    ...overrides,
  };
}

describe("ignition deploy override", () => {
  it("injects a deploymentId when missing", async () => {
    resetRegistry();
    let capturedArgs;
    const successResult = {
      type: DeploymentResultType.SUCCESSFUL_DEPLOYMENT,
      contracts: {},
    };

    globalThis.__MB_PLUGIN_DEPLOY__ = async (args) => {
      capturedArgs = args;
      return successResult;
    };

    const result = await taskAction(baseArgs(), createHre(), async () => null);

    assert.strictEqual(result, successResult);
    assert.ok(
      /deployments[\\/]+chain-1$/.test(capturedArgs.deploymentDir),
      `Unexpected deploymentDir: ${capturedArgs.deploymentDir}`,
    );
  });

  it("preserves an existing deploymentId", async () => {
    resetRegistry();
    let capturedArgs;
    const successResult = {
      type: DeploymentResultType.SUCCESSFUL_DEPLOYMENT,
      contracts: {},
    };

    globalThis.__MB_PLUGIN_DEPLOY__ = async (args) => {
      capturedArgs = args;
      return successResult;
    };

    const result = await taskAction(
      baseArgs({ deploymentId: "fixed-id" }),
      createHre(),
      async () => null,
    );

    assert.strictEqual(result, successResult);
    assert.ok(
      /deployments[\\/]+fixed-id$/.test(capturedArgs.deploymentDir),
      `Unexpected deploymentDir: ${capturedArgs.deploymentDir}`,
    );
  });

  it("clears any previously registered links", async () => {
    resetRegistry();
    registerLink({ id: "future-1", contractName: "Greeter" });
    assert.equal(getRegisteredLinks().length, 1);

    globalThis.__MB_PLUGIN_DEPLOY__ = async () => ({
      type: DeploymentResultType.SUCCESSFUL_DEPLOYMENT,
      contracts: {},
    });
    await taskAction(baseArgs(), createHre(), async () => null);

    assert.equal(getRegisteredLinks().length, 0);
  });

  it("returns successful results when there are no links", async () => {
    resetRegistry();
    const successResult = {
      type: DeploymentResultType.SUCCESSFUL_DEPLOYMENT,
      contracts: {},
    };

    globalThis.__MB_PLUGIN_DEPLOY__ = async () => successResult;
    const result = await taskAction(
      baseArgs({ deploymentId: "fixed-id" }),
      createHre(),
      async () => null,
    );

    assert.strictEqual(result, successResult);
  });
});

describe("MultiBaas sync pipeline", () => {
  it("calls mbClient.setup with the chain ID after deployment", async () => {
    const setupMock = mock.method(MultiBaasClient.prototype, "setup", async () => {});
    mock.method(MultiBaasClient.prototype, "linkDeployedContract", async () => {});

    globalThis.__MB_PLUGIN_DEPLOY__ = async (args) => {
      registerLink({ id: "M#Greeter", contractName: "Greeter" });
      await args.executionEventListener.batchInitialize({
        batches: [["M#Greeter"]],
      });
      return {
        type: DeploymentResultType.SUCCESSFUL_DEPLOYMENT,
        contracts: {
          "M#Greeter": { contractName: "Greeter", address: "0xABCD" },
        },
      };
    };

    await taskAction(baseArgs(), createHre(), async () => null);

    assert.equal(setupMock.mock.callCount(), 1);
    assert.equal(setupMock.mock.calls[0].arguments[0], 1); // 0x1 = 1
  });

  it("calls linkDeployedContract for each registered link with matching executedFutureId", async () => {
    mock.method(MultiBaasClient.prototype, "setup", async () => {});
    const linkMock = mock.method(
      MultiBaasClient.prototype,
      "linkDeployedContract",
      async () => {},
    );

    globalThis.__MB_PLUGIN_DEPLOY__ = async (args) => {
      registerLink({ id: "M#Greeter", contractName: "Greeter" }, { contractLabel: "greeter" });
      registerLink({ id: "M#Token", contractName: "Token" });
      await args.executionEventListener.batchInitialize({
        batches: [["M#Greeter", "M#Token"]],
      });
      return {
        type: DeploymentResultType.SUCCESSFUL_DEPLOYMENT,
        contracts: {
          "M#Greeter": { contractName: "Greeter", address: "0xAAA" },
          "M#Token": { contractName: "Token", address: "0xBBB" },
        },
      };
    };

    await taskAction(baseArgs(), createHre(), async () => null);

    assert.equal(linkMock.mock.callCount(), 2);

    const call0 = linkMock.mock.calls[0].arguments;
    assert.equal(call0[0], "Greeter");
    assert.equal(call0[1], "0xAAA");
    assert.deepEqual(call0[2], { contractLabel: "greeter" });

    const call1 = linkMock.mock.calls[1].arguments;
    assert.equal(call1[0], "Token");
    assert.equal(call1[1], "0xBBB");
  });

  it("skips links whose futureId was not in the executed batch", async () => {
    mock.method(MultiBaasClient.prototype, "setup", async () => {});
    const linkMock = mock.method(
      MultiBaasClient.prototype,
      "linkDeployedContract",
      async () => {},
    );

    globalThis.__MB_PLUGIN_DEPLOY__ = async (args) => {
      registerLink({ id: "M#Greeter", contractName: "Greeter" });
      registerLink({ id: "M#Skipped", contractName: "Skipped" });
      // Only M#Greeter was executed in this batch
      await args.executionEventListener.batchInitialize({
        batches: [["M#Greeter"]],
      });
      return {
        type: DeploymentResultType.SUCCESSFUL_DEPLOYMENT,
        contracts: {
          "M#Greeter": { contractName: "Greeter", address: "0xAAA" },
          "M#Skipped": { contractName: "Skipped", address: "0xBBB" },
        },
      };
    };

    await taskAction(baseArgs(), createHre(), async () => null);

    assert.equal(linkMock.mock.callCount(), 1);
    assert.equal(linkMock.mock.calls[0].arguments[0], "Greeter");
  });

  it("syncs all links when syncExisting is true, even without execution events", async () => {
    mock.method(MultiBaasClient.prototype, "setup", async () => {});
    const linkMock = mock.method(
      MultiBaasClient.prototype,
      "linkDeployedContract",
      async () => {},
    );

    globalThis.__MB_PLUGIN_DEPLOY__ = async () => {
      registerLink({ id: "M#Greeter", contractName: "Greeter" });
      // No batchInitialize fired — executedFutureIds will be empty
      return {
        type: DeploymentResultType.SUCCESSFUL_DEPLOYMENT,
        contracts: {
          "M#Greeter": { contractName: "Greeter", address: "0xAAA" },
        },
      };
    };

    const hre = createHre();
    hre.config.mbConfig.syncExisting = true;
    await taskAction(baseArgs(), hre, async () => null);

    assert.equal(linkMock.mock.callCount(), 1);
    assert.equal(linkMock.mock.calls[0].arguments[0], "Greeter");
  });

  it("does not sync when executedFutureIds is empty and syncExisting is false", async () => {
    const setupMock = mock.method(MultiBaasClient.prototype, "setup", async () => {});
    mock.method(MultiBaasClient.prototype, "linkDeployedContract", async () => {});

    globalThis.__MB_PLUGIN_DEPLOY__ = async () => {
      registerLink({ id: "M#Greeter", contractName: "Greeter" });
      // No batchInitialize fired — executedFutureIds will be empty
      return {
        type: DeploymentResultType.SUCCESSFUL_DEPLOYMENT,
        contracts: {
          "M#Greeter": { contractName: "Greeter", address: "0xAAA" },
        },
      };
    };

    await taskAction(baseArgs(), createHre(), async () => null);

    // MultiBaasClient should never be instantiated
    assert.equal(setupMock.mock.callCount(), 0);
  });

  it("passes libraryAddresses built from the deployment result", async () => {
    mock.method(MultiBaasClient.prototype, "setup", async () => {});
    const linkMock = mock.method(
      MultiBaasClient.prototype,
      "linkDeployedContract",
      async () => {},
    );

    globalThis.__MB_PLUGIN_DEPLOY__ = async (args) => {
      registerLink({ id: "M#Token", contractName: "Token" });
      await args.executionEventListener.batchInitialize({
        batches: [["M#Token"]],
      });
      return {
        type: DeploymentResultType.SUCCESSFUL_DEPLOYMENT,
        contracts: {
          "M#Lib": { contractName: "Lib", address: "0xLIB" },
          "M#Token": { contractName: "Token", address: "0xTOK" },
        },
      };
    };

    await taskAction(baseArgs(), createHre(), async () => null);

    assert.equal(linkMock.mock.callCount(), 1);
    const libraryAddresses = linkMock.mock.calls[0].arguments[3];
    assert.equal(libraryAddresses.Lib, "0xLIB");
    assert.equal(libraryAddresses.Token, "0xTOK");
  });

  it("throws when mbConfig is undefined but links are registered", async () => {
    mock.method(MultiBaasClient.prototype, "setup", async () => {});
    mock.method(MultiBaasClient.prototype, "linkDeployedContract", async () => {});

    globalThis.__MB_PLUGIN_DEPLOY__ = async (args) => {
      registerLink({ id: "M#Greeter", contractName: "Greeter" });
      await args.executionEventListener.batchInitialize({
        batches: [["M#Greeter"]],
      });
      return {
        type: DeploymentResultType.SUCCESSFUL_DEPLOYMENT,
        contracts: {
          "M#Greeter": { contractName: "Greeter", address: "0xABCD" },
        },
      };
    };

    const hre = createHre({ mbConfig: undefined });

    await assert.rejects(
      () => taskAction(baseArgs(), hre, async () => null),
      /mbConfig is required/,
    );
  });
});
