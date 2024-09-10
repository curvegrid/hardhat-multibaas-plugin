// Copyright (c) 2021 Curvegrid Inc.
import "@nomicfoundation/hardhat-ethers";
import "@openzeppelin/hardhat-upgrades";
import { extendConfig, extendEnvironment, task } from "hardhat/config";
import { lazyObject } from "hardhat/plugins";
import {
  HardhatConfig,
  HardhatRuntimeEnvironment,
  HardhatUserConfig,
  SolcUserConfig,
} from "hardhat/types";
import { MBDeployer } from "./deploy";
import { Deployment, SubmitOptions } from "./type-extensions";
import { CompilerSettings, OutputSelection } from "./types";
import * as types from "hardhat/internal/core/params/argumentTypes";

export const MULTIBAAS_SUBMIT_TASKNAME = "mb-submit";

task(MULTIBAAS_SUBMIT_TASKNAME)
  .setDescription("Submit contracts deployed with hardhat-deploy to MutiBaas")
  .addOptionalParam(
    "deploymentName",
    "specific deployment name to submit to MultiBaas",
    undefined,
    types.string,
  )
  .setAction(async (args: { deploymentName: string }, hre) => {
    if (hre.deployments === undefined) {
      throw new Error(
        "hardhat-deploy plugin is not installed. Please install it using `npm install --save-dev hardhat-deploy`",
      );
    }

    async function submitDeployment(
      hre: HardhatRuntimeEnvironment,
      deploymentName: string,
      deployment: Deployment,
    ) {
      const bytecode = deployment.bytecode;
      if (bytecode === undefined) {
        console.log(
          `MultiBaas: bytecode is missing for deployment ${deploymentName}, skipping`,
        );
        return;
      }
      let options: SubmitOptions = {};
      if (hre.config.mbConfig.submitOptions !== undefined) {
        options =
          { ...hre.config.mbConfig.submitOptions[deploymentName] } || {};
      }
      const [name, version] = deploymentName.split("@");
      if (options.contractVersion === undefined) {
        options.contractVersion = version;
      }
      const startingBlock = deployment.receipt
        ? String(deployment.receipt.blockNumber - 1)
        : undefined;
      await hre.mbDeployer.submitDeployment(
        name!,
        deployment.address,
        deployment,
        deployment.devdoc,
        deployment.userdoc,
        startingBlock,
        options,
      );
    }

    if (args.deploymentName !== undefined) {
      const deployment = await hre.deployments.get(args.deploymentName);
      await submitDeployment(hre, args.deploymentName, deployment);
      return;
    }

    const deployments = await hre.deployments.all();
    for (const [name, deployment] of Object.entries(deployments)) {
      // When deploying through hardhat-deploy with a proxy, additional deployments files are created for the proxy and implementation
      // However, there is also a standard deployment file created with the address of the proxy and the ABI of the implementation
      if (!name.endsWith("_Proxy") && !name.endsWith("_Implementation")) {
        await submitDeployment(hre, name, deployment);
      }
    }
  });

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
