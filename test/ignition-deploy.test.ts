import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { DeploymentResultType } from "@nomicfoundation/ignition-core";
import taskAction from "../dist/internal/tasks/ignition-deploy.js";
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
});

function createHre() {
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
        ignition: "sample/ignition",
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
    modulePath: "sample/ignition/modules/GreeterModule.ts",
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
