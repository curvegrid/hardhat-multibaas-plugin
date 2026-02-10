import "hardhat/types/config";

import type { MBConfig, MBConfigUserConfig } from "./types.js";

declare module "hardhat/types/config" {
  export interface HardhatUserConfig {
    mbConfig?: MBConfigUserConfig;
  }

  export interface HardhatConfig {
    mbConfig?: MBConfig;
  }
}
