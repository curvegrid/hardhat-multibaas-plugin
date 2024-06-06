/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
// Copyright (c) 2021 Curvegrid Inc.

import "@nomicfoundation/hardhat-ethers";
import "@openzeppelin/hardhat-upgrades";
import { extendConfig, extendEnvironment } from "hardhat/config";
import { lazyObject } from "hardhat/plugins";
import {
  HardhatConfig,
  HardhatUserConfig,
  SolcUserConfig,
} from "hardhat/types";
import { MBDeployer } from "./deploy";
import "./type-extensions";

// Function to ensure userdoc and devdoc are present in outputSelection
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ensureUserDocAndDevDoc(outputSelection: Record<string, any>) {
  const allContracts = outputSelection["*"] || {};
  if (!allContracts["*"]) {
    allContracts["*"] = [];
  }

  if (!allContracts["*"].includes("userdoc")) {
    allContracts["*"].push("userdoc");
  }

  if (!allContracts["*"].includes("devdoc")) {
    allContracts["*"].push("devdoc");
  }

  outputSelection["*"] = allContracts;
  return outputSelection;
}

extendEnvironment((hre) => {
  hre.mbDeployer = lazyObject(() => {
    return new MBDeployer(
      hre.ethers,
      hre.upgrades,
      hre.config.mbConfig,
      hre.network.name,
    );
  });
});

extendConfig(
  (config: HardhatConfig, userConfig: Readonly<HardhatUserConfig>) => {
    const mbConfig = userConfig.mbConfig;

    if (mbConfig === undefined) {
      throw new Error(
        "error when loading user's config: please specify a value for [mbConfig] field",
      );
    }

    config.mbConfig = mbConfig;

    // Ensure the compiler settings are defined
    if (!config.solidity) {
      throw new Error("Solidity configuration is missing in hardhat.config.js");
    }

    // Ensure the compilers array is defined
    if (!Array.isArray(config.solidity.compilers)) {
      throw new Error(
        "Solidity compilers array is missing in hardhat.config.js",
      );
    }

    // Iterate over each compiler configuration and ensure userdoc and devdoc are included
    config.solidity.compilers.forEach((compiler: SolcUserConfig) => {
      if (!compiler.settings) {
        compiler.settings = {};
      }

      if (!compiler.settings.outputSelection) {
        compiler.settings.outputSelection = {};
      }

      compiler.settings.outputSelection = ensureUserDocAndDevDoc(
        compiler.settings.outputSelection,
      );
    });
  },
);
/* eslint-enable @typescript-eslint/no-unsafe-return */
/* eslint-enable @typescript-eslint/no-unsafe-call */
/* eslint-enable @typescript-eslint/no-unsafe-argument */
/* eslint-enable @typescript-eslint/no-unsafe-assignment */
/* eslint-enable @typescript-eslint/no-unsafe-member-access */
