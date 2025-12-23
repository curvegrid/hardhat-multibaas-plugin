import type { HardhatPlugin } from "hardhat/types/plugins";

import { overrideTask } from "hardhat/config";

import "./type-extensions.js";

const hardhatMultiBaasPlugin: HardhatPlugin = {
  id: "hardhat-multibaas",
  npmPackage: "hardhat-multibaas-plugin",
  dependencies: () => [import("@nomicfoundation/hardhat-ignition")],
  hookHandlers: {
    config: () => import("./internal/hook-handlers/config.js"),
    solidity: () => import("./internal/hook-handlers/solidity.js"),
  },
  tasks: [
    overrideTask(["ignition", "deploy"])
      .setAction(() => import("./internal/tasks/ignition-deploy.js"))
      .build(),
  ],
};

export default hardhatMultiBaasPlugin;
export type { MBConfig, MBConfigUserConfig, MultiBaasLinkOptions } from "./types.js";
