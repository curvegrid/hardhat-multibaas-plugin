import assert from "node:assert/strict";
import { describe, it } from "node:test";

import solidityHook from "../dist/internal/hook-handlers/solidity.js";

describe("solidity output selection hook", () => {
  it("adds userdoc/devdoc when outputSelection is missing", async () => {
    const hooks = await solidityHook();
    const solcInput = { settings: {} };
    const next = async (_context, input) => input;

    await hooks.preprocessSolcInputBeforeBuilding({}, solcInput, next);

    const selectors = solcInput.settings.outputSelection["*"]["*"];
    assert.ok(selectors.includes("userdoc"));
    assert.ok(selectors.includes("devdoc"));
  });

  it("adds userdoc/devdoc to all selector entries", async () => {
    const hooks = await solidityHook();
    const solcInput = {
      settings: {
        outputSelection: {
          "*": {
            "*": ["abi", "devdoc"],
          },
          "contracts/Greeter.sol": {
            Greeter: ["abi"],
          },
        },
      },
    };
    const next = async (_context, input) => input;

    await hooks.preprocessSolcInputBeforeBuilding({}, solcInput, next);

    const wildcardSelectors = solcInput.settings.outputSelection["*"]["*"];
    const greeterSelectors =
      solcInput.settings.outputSelection["contracts/Greeter.sol"].Greeter;

    assert.ok(wildcardSelectors.includes("userdoc"));
    assert.ok(wildcardSelectors.includes("devdoc"));
    assert.ok(greeterSelectors.includes("userdoc"));
    assert.ok(greeterSelectors.includes("devdoc"));

    assert.equal(
      wildcardSelectors.filter((item) => item === "devdoc").length,
      1,
    );
  });
});
