# hardhat-multibaas-plugin (Hardhat v3)

Integrate MultiBaas into Hardhat v3 deployments using Ignition modules. The plugin mirrors Ignition's deploy flow, uploads artifacts, creates or updates MultiBaas contracts, and links deployed addresses for any futures registered via `mb.link`.

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
    allowUpdateContract: ["development"],
    syncExisting: false,
    requireChainIdMatch: true
  }
});
```

Optional `mbConfig` fields:
- `syncExisting`: When `true`, syncs all registered futures found in Ignition’s deployment result, even if they weren’t executed in the current run.
- `requireChainIdMatch`: When `true` (default), compare MultiBaas chain ID with the Hardhat network chain ID and fail fast on mismatches.

Behavior notes:
- The plugin overrides `hardhat ignition deploy` and keeps Ignition’s prompts, reset behavior, and UI.
- Only futures registered via `mb.link` are synced to MultiBaas.
- By default, the plugin syncs only futures that Ignition executed in the current run.
- When `syncExisting` is enabled, the plugin will sync all registered futures present in the deployment result, including previously deployed contracts.

## Use with Ignition

Register any deployment (or `contractAt`) you want linked in MultiBaas by calling `mb.link` inside your module. The plugin performs MultiBaas linking only for registered futures.

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

## Tests

```bash
npm test
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
