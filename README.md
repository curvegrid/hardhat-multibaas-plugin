# hardhat-multibaas-plugin (Hardhat v3)

Integrate MultiBaas into Hardhat v3 deployments using Ignition modules. This plugin uploads artifacts, creates or updates MultiBaas contracts, and links deployed addresses after Ignition completes.

## Install

```bash
npm install --save-dev hardhat hardhat-multibaas-plugin @nomicfoundation/hardhat-ignition
```

## Configure

Add the plugin to `plugins` and provide `mbConfig` in your Hardhat config:

```ts
import hardhatIgnitionPlugin from "@nomicfoundation/hardhat-ignition";
import { configVariable, defineConfig } from "hardhat/config";
import hardhatMultiBaasPlugin from "hardhat-multibaas-plugin";

export default defineConfig({
  plugins: [hardhatIgnitionPlugin, hardhatMultiBaasPlugin],
  networks: {
    development: {
      type: "http",
      chainType: "l1",
      url: configVariable("MB_PLUGIN_RPC_URL"),
      accounts: {
        mnemonic: configVariable("MB_PLUGIN_MNEMONIC")
      }
    }
  },
  mbConfig: {
    host: configVariable("MB_PLUGIN_HOST"),
    apiKey: configVariable("MB_PLUGIN_API_KEY"),
    allowUpdateAddress: ["development"],
    allowUpdateContract: ["development"]
  }
});
```

## Use with Ignition

Register any deployment (or `contractAt`) you want linked in MultiBaas by calling `mb.link` inside your module. The plugin overrides `ignition deploy` and performs MultiBaas linking only for registered futures.

```ts
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { mb } from "hardhat-multibaas-plugin/ignition";

export default buildModule("GreeterModule", (m) => {
  const greeter = m.contract("Greeter", ["Hello, world!"]);

  mb.link(greeter, {
    contractLabel: "greeter",
    contractVersion: "1.0",
    addressAlias: "greeter",
    startingBlock: "-100"
  });

  return { greeter };
});
```

Then deploy the module:

```bash
npx hardhat ignition deploy ignition/modules/GreeterModule.ts
```

## MultiBaas link options

```ts
interface MultiBaasLinkOptions {
  contractLabel?: string;
  contractVersion?: string;
  addressAlias?: string;
  startingBlock?: string;
}
```

Notes:
- `contractLabel` defaults to the lowercased contract name.
- `contractVersion` defaults to `1.0` or auto-increments if a different bytecode already exists.
- `startingBlock` defaults to `-100` (100 blocks before current).

## Upgradeable proxies

Use Ignition’s proxy patterns and link the proxy address via `contractAt`:

```ts
const proxy = m.contract("TransparentUpgradeableProxy", [impl, admin, initData]);
const proxiedGreeter = m.contractAt("ProxiedGreeter", proxy);
mb.link(proxiedGreeter, { contractLabel: "proxied_greeter" });
```

## Build

```bash
npm run build
```

## Using Legacy Hardhat v2

If you want to work with legacy Hardhat v2, refer to the following branch.

https://github.com/curvegrid/hardhat-multibaas-plugin/tree/legacy/hardhat-v2
