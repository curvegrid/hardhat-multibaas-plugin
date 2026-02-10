import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createHardhatRuntimeEnvironment } from "hardhat/hre";

import hardhatMultiBaasPlugin from "../dist/index.js";
import { createFixtureProjectHRE } from "./helpers/fixture-projects.ts";

describe("hardhat-multibaas plugin integration", () => {
  it("loads a fixture project config", async () => {
    const hre = await createFixtureProjectHRE("base-project");

    assert.ok(hre.config.mbConfig.host.startsWith("http://localhost:8080"));
    assert.equal(hre.config.mbConfig.apiKey, "fixture-api-key");
  });

  it("resolves mbConfig from an inline config", async () => {
    const hre = await createHardhatRuntimeEnvironment({
      plugins: [hardhatMultiBaasPlugin],
      mbConfig: {
        host: "http://example.com",
        apiKey: "inline-key",
        allowUpdateAddress: ["development"],
      },
    });

    assert.ok(hre.config.mbConfig.host.startsWith("http://example.com"));
    assert.equal(hre.config.mbConfig.apiKey, "inline-key");
    assert.deepEqual(hre.config.mbConfig.allowUpdateAddress, ["development"]);
    assert.deepEqual(hre.config.mbConfig.allowUpdateContract, []);
  });
});
