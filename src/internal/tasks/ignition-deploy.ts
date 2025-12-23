import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import type { TaskOverrideActionFunction } from "hardhat/types/tasks";

import {
  DeploymentResultType,
  type SuccessfulDeploymentResult,
} from "@nomicfoundation/ignition-core";

import { MultiBaasClient } from "../multibaas/client.js";
import { getRegisteredLinks, resetRegistry } from "../registry.js";

const taskAction: TaskOverrideActionFunction = async (
  taskArgs,
  hre: HardhatRuntimeEnvironment,
  runSuper,
) => {
  resetRegistry();

  const result = await runSuper(taskArgs);

  if (result === null || result?.type !== DeploymentResultType.SUCCESSFUL_DEPLOYMENT) {
    return result;
  }

  const successfulResult = result as SuccessfulDeploymentResult;

  const links = getRegisteredLinks();
  if (links.length === 0) {
    return result;
  }

  const connection = await hre.network.connect();
  const mbClient = new MultiBaasClient(
    hre.config.mbConfig,
    connection.networkName,
    hre.artifacts,
  );

  await mbClient.setup();

  const libraryAddresses: Record<string, string> = {};
  for (const contract of Object.values(successfulResult.contracts)) {
    libraryAddresses[contract.contractName] = contract.address;
  }

  for (const link of links) {
    const deployment = successfulResult.contracts[link.futureId];
    if (deployment === undefined) {
      console.warn(
        `MultiBaas: Skipping link for ${link.contractName}, no deployment found for future ${link.futureId}`,
      );
      continue;
    }

    await mbClient.linkDeployedContract(
      link.contractName,
      deployment.address,
      link.options,
      libraryAddresses,
    );
  }

  return result;
};

export default taskAction;
