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
import { CompilerSettings, OutputSelection } from "./types";

// Function to ensure userdoc and devdoc are present in outputSelection
function ensureUserDocAndDevDoc(outputSelection: OutputSelection) {
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
      // Cast settings to CompilerSettings to safely access outputSelection
      const settings = compiler.settings as CompilerSettings;

      if (!settings.outputSelection) {
        settings.outputSelection = {} as OutputSelection;
      }

      settings.outputSelection = ensureUserDocAndDevDoc(
        settings.outputSelection,
      );
    });

    // If there are any overrides, we should also ensure userdoc and devdoc are included
    if (config.solidity.overrides) {
      // Iterate over each override configuration and ensure userdoc and devdoc are included
      Object.values(config.solidity.overrides).forEach(
        (override: SolcUserConfig) => {
          if (!override.settings) {
            override.settings = {};
          }
          // Cast settings to CompilerSettings to safely access outputSelection
          const settings = override.settings as CompilerSettings;

          if (!settings.outputSelection) {
            settings.outputSelection = {} as OutputSelection;
          }

          settings.outputSelection = ensureUserDocAndDevDoc(
            settings.outputSelection,
          );
        },
      );
    }
  },
);
