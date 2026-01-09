import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DeploymentResultType } from "@nomicfoundation/ignition-core";
import taskAction from "../dist/internal/tasks/ignition-deploy.js";
import {
  getRegisteredLinks,
  registerLink,
  resetRegistry,
} from "../dist/internal/registry.js";

describe("ignition deploy override", () => {
  it("injects a deploymentId when missing", async () => {
    resetRegistry();
    let capturedArgs;

    const runSuper = async (args) => {
      capturedArgs = args;
      return null;
    };

    const result = await taskAction({}, {}, runSuper);

    assert.equal(result, null);
    assert.ok(/^deploy-\d+$/.test(capturedArgs.deploymentId));
  });

  it("preserves an existing deploymentId", async () => {
    resetRegistry();
    let capturedArgs;

    const runSuper = async (args) => {
      capturedArgs = args;
      return null;
    };

    await taskAction({ deploymentId: "fixed-id" }, {}, runSuper);

    assert.equal(capturedArgs.deploymentId, "fixed-id");
  });

  it("clears any previously registered links", async () => {
    resetRegistry();
    registerLink({ id: "future-1", contractName: "Greeter" });
    assert.equal(getRegisteredLinks().length, 1);

    await taskAction({}, {}, async () => null);

    assert.equal(getRegisteredLinks().length, 0);
  });

  it("returns successful results when there are no links", async () => {
    resetRegistry();
    const successResult = {
      type: DeploymentResultType.SUCCESSFUL_DEPLOYMENT,
      contracts: {},
    };

    const result = await taskAction(
      { deploymentId: "fixed-id" },
      {},
      async () => successResult,
    );

    assert.strictEqual(result, successResult);
  });
});
