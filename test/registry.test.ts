import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import {
  getRegisteredLinks,
  registerLink,
  resetRegistry,
} from "../dist/internal/registry.js";
import { mb } from "../dist/ignition.js";

describe("link registry", () => {
  beforeEach(() => {
    resetRegistry();
  });

  it("registers links with copied options", () => {
    const future = { id: "future-1", contractName: "Greeter" };
    const options = { contractLabel: "greeter", contractVersion: "1.0" };

    registerLink(future, options);
    options.contractLabel = "changed";

    const [link] = getRegisteredLinks();
    assert.equal(link.futureId, "future-1");
    assert.equal(link.contractName, "Greeter");
    assert.equal(link.options.contractLabel, "greeter");
  });

  it("throws when the future id is invalid", () => {
    assert.throws(
      () => registerLink({ id: "", contractName: "Greeter" }),
      /Invalid future id/,
    );
  });

  it("throws when the contract name is invalid", () => {
    assert.throws(
      () => registerLink({ id: "future-1", contractName: "" }),
      /Invalid contract name/,
    );
  });

  it("mb.link registers and returns the same future", () => {
    const future = { id: "future-2", contractName: "MetaCoin" };

    const result = mb.link(future, { addressAlias: "metacoin" });

    assert.strictEqual(result, future);
    const [link] = getRegisteredLinks();
    assert.equal(link.options.addressAlias, "metacoin");
  });
});
