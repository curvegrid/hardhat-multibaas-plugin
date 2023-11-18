// Copyright (c) 2021 Curvegrid Inc.

import "@nomicfoundation/hardhat-ethers";
import "@openzeppelin/hardhat-upgrades";
import { extendConfig, extendEnvironment } from "hardhat/config";
import { lazyObject } from "hardhat/plugins";
import { HardhatConfig, HardhatUserConfig } from "hardhat/types";
import { MBDeployer } from "./deploy";
import "./type-extensions";

extendEnvironment((hre) => {
  hre.mbDeployer = lazyObject(() => {
    return new MBDeployer(hre.ethers, hre.upgrades, hre.config.mbConfig, hre.network.name);
  });
});

extendConfig(
  (config: HardhatConfig, userConfig: Readonly<HardhatUserConfig>) => {
    const mbConfig = userConfig.mbConfig;

    if (mbConfig === undefined) {
      throw new Error(
        "error when loading user's config: please specify a value for [mbConfig] field"
      );
    }

    config.mbConfig = mbConfig;
  }
);
