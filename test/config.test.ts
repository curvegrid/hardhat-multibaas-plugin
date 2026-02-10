import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resolveUserConfig,
  validateUserConfig,
} from "../dist/internal/hook-handlers/config.js";
import type { ConfigurationVariableResolver } from "hardhat/types/config";

const resolveConfigurationVariable: ConfigurationVariableResolver = (value) => {
  const resolvedValue = String(value);

  return {
    _type: "ResolvedConfigurationVariable",
    format: "string",
    get: async () => `resolved:${resolvedValue}`,
    getUrl: async () => `resolved-url:${resolvedValue}`,
    getBigInt: async () => BigInt(0),
    getHexString: async () => "0x0",
  };
};

describe("mbConfig validation", () => {
  it("requires mbConfig", async () => {
    const errors = await validateUserConfig({});

    assert.deepEqual(errors, [
      {
        path: ["mbConfig"],
        message:
          "MultiBaas config is required. Add mbConfig to your Hardhat config.",
      },
    ]);
  });

  it("rejects non-object mbConfig values", async () => {
    const errors = await validateUserConfig({
      mbConfig: "invalid",
    });

    assert.deepEqual(errors, [
      {
        path: ["mbConfig"],
        message: "mbConfig must be an object.",
      },
    ]);
  });

  it("requires host and apiKey", async () => {
    const errors = await validateUserConfig({
      mbConfig: {},
    });

    assert.deepEqual(errors, [
      {
        path: ["mbConfig", "host"],
        message: "mbConfig.host is required.",
      },
      {
        path: ["mbConfig", "apiKey"],
        message: "mbConfig.apiKey is required.",
      },
    ]);
  });

  it("rejects non-string allowUpdate entries", async () => {
    const errors = await validateUserConfig({
      mbConfig: {
        host: "http://example.com",
        apiKey: "key",
        allowUpdateAddress: ["development", 123],
        allowUpdateContract: [false],
      },
    });

    assert.deepEqual(errors, [
      {
        path: ["mbConfig", "allowUpdateAddress"],
        message: "mbConfig.allowUpdateAddress must be an array of strings.",
      },
      {
        path: ["mbConfig", "allowUpdateContract"],
        message: "mbConfig.allowUpdateContract must be an array of strings.",
      },
    ]);
  });

  it("rejects numeric host value", async () => {
    const errors = await validateUserConfig({
      mbConfig: {
        host: 123,
        apiKey: "key",
      },
    });

    assert.equal(errors.length, 1);
    assert.equal(errors[0].path[1], "host");
    assert.match(errors[0].message, /must be a string or configuration variable/);
  });

  it("rejects boolean apiKey value", async () => {
    const errors = await validateUserConfig({
      mbConfig: {
        host: "http://example.com",
        apiKey: false,
      },
    });

    assert.equal(errors.length, 1);
    assert.equal(errors[0].path[1], "apiKey");
    assert.match(errors[0].message, /must be a string or configuration variable/);
  });

  it("accepts valid mbConfig", async () => {
    const errors = await validateUserConfig({
      mbConfig: {
        host: "http://example.com",
        apiKey: "key",
        allowUpdateAddress: ["development"],
        allowUpdateContract: [],
      },
    });

    assert.equal(errors.length, 0);
  });
});

describe("mbConfig resolution", () => {
  it("returns the next config when mbConfig is missing", async () => {
    const baseConfig = { base: true };
    const resolved = await resolveUserConfig(
      {},
      resolveConfigurationVariable,
      async () => baseConfig,
    );

    assert.strictEqual(resolved, baseConfig);
  });

  it("throws when host or apiKey are missing", async () => {
    await assert.rejects(
      () =>
        resolveUserConfig(
          { mbConfig: { host: "http://example.com" } },
          resolveConfigurationVariable,
          async () => ({}),
        ),
      /mbConfig\.host and mbConfig\.apiKey are required/,
    );
  });

  it("resolves mbConfig defaults and values", async () => {
    const resolved = await resolveUserConfig(
      {
        mbConfig: {
          host: "http://example.com",
          apiKey: "key",
        },
      },
      resolveConfigurationVariable,
      async () => ({ resolvedBase: true }),
    );

    assert.deepEqual(resolved.mbConfig, {
      host: "resolved-url:http://example.com",
      apiKey: "resolved:key",
      allowUpdateAddress: [],
      allowUpdateContract: [],
      syncExisting: false,
      requireChainIdMatch: true,
    });
  });

  it("preserves allowUpdate arrays", async () => {
    const resolved = await resolveUserConfig(
      {
        mbConfig: {
          host: "http://example.com",
          apiKey: "key",
          allowUpdateAddress: ["dev"],
          allowUpdateContract: ["dev"],
        },
      },
      resolveConfigurationVariable,
      async () => ({}),
    );

    assert.deepEqual(resolved.mbConfig.allowUpdateAddress, ["dev"]);
    assert.deepEqual(resolved.mbConfig.allowUpdateContract, ["dev"]);
  });
});
