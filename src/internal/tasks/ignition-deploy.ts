import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import type { TaskOverrideActionFunction } from "hardhat/types/tasks";

import path from "node:path";
import { pathToFileURL } from "node:url";

import { HardhatError } from "@nomicfoundation/hardhat-errors";
import {
  ensureDir,
  exists,
  readdir,
  readJsonFile,
  remove,
  writeJsonFile,
} from "@nomicfoundation/hardhat-utils/fs";
import {
  deploy,
  DeploymentResultType,
  type DeploymentParameters,
  type DeploymentResult,
  type ExecutionEventListener,
  type IgnitionModule,
  type SuccessfulDeploymentResult,
} from "@nomicfoundation/ignition-core";
import {
  HardhatArtifactResolver,
  PrettyEventHandler,
  readDeploymentParameters,
  resolveDeploymentId,
} from "@nomicfoundation/hardhat-ignition/helpers";
import chalk from "chalk";
import Prompt from "prompts";

import { MultiBaasClient } from "../multibaas/client.js";
import { getRegisteredLinks, resetRegistry } from "../registry.js";

// Hardhat task override that mirrors Ignition's deploy flow and then syncs
// MultiBaas for any futures registered via mb.link.

interface TaskDeployArguments {
  modulePath: string;
  parameters?: string;
  deploymentId?: string;
  defaultSender?: string;
  strategy: string;
  reset: boolean;
  verify: boolean;
  writeLocalhostDeployment: boolean;
}

const taskAction: TaskOverrideActionFunction = async (
  taskArgs,
  hre: HardhatRuntimeEnvironment,
  _runSuper,
) => {
  // Always start with a clean registry for each deployment run.
  void _runSuper;
  resetRegistry();

  const { result, executedFutureIds } = await runIgnitionDeploy(
    taskArgs as TaskDeployArguments,
    hre,
  );

  if (!isSuccessfulDeployment(result)) {
    return result;
  }

  // If no links were registered during deployment, nothing to sync to MultiBaas.
  const links = getRegisteredLinks();
  if (links.length === 0) {
    return result;
  }

  const shouldSyncExisting = hre.config.mbConfig.syncExisting;

  // Only sync what Ignition executed in this run unless explicitly configured.
  if (executedFutureIds.size === 0 && !shouldSyncExisting) {
    return result;
  }

  const connection = await hre.network.connect();
  const mbClient = new MultiBaasClient(
    hre.config.mbConfig,
    connection.networkName,
    hre.artifacts,
  );

  const chainId = Number(
    await connection.provider.request({
      method: "eth_chainId",
    }),
  );
  await mbClient.setup(chainId);

  // Use the full deployment result to resolve library addresses for bytecode
  // linking, even when only a subset of futures executed.
  const libraryAddresses = buildLibraryAddressMap(result);
  await linkRegisteredContracts(
    links,
    result,
    mbClient,
    libraryAddresses,
    executedFutureIds,
    shouldSyncExisting,
  );

  return result;
};

function isSuccessfulDeployment(
  result: Awaited<ReturnType<TaskOverrideActionFunction>>,
): result is SuccessfulDeploymentResult {
  return (
    result !== null &&
    result?.type === DeploymentResultType.SUCCESSFUL_DEPLOYMENT
  );
}

function buildLibraryAddressMap(
  result: SuccessfulDeploymentResult,
): Record<string, string> {
  const libraryAddresses: Record<string, string> = {};
  for (const contract of Object.values(result.contracts)) {
    libraryAddresses[contract.contractName] = contract.address;
  }
  return libraryAddresses;
}

async function linkRegisteredContracts(
  links: ReturnType<typeof getRegisteredLinks>,
  result: SuccessfulDeploymentResult,
  mbClient: MultiBaasClient,
  libraryAddresses: Record<string, string>,
  executedFutureIds: Set<string>,
  shouldSyncExisting: boolean,
): Promise<void> {
  for (const link of links) {
    if (!shouldSyncExisting && !executedFutureIds.has(link.futureId)) {
      continue;
    }

    const deployment = result.contracts[link.futureId];
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
}

async function runIgnitionDeploy(
  {
    modulePath,
    parameters: parametersInput,
    deploymentId: givenDeploymentId,
    defaultSender,
    reset,
    verify,
    strategy: strategyName,
    writeLocalhostDeployment,
  }: TaskDeployArguments,
  hre: HardhatRuntimeEnvironment,
): Promise<{
  result: DeploymentResult | null;
  executedFutureIds: Set<string>;
}> {
  const connection = await hre.network.connect();

  const chainId = Number(
    await connection.provider.request({
      method: "eth_chainId",
    }),
  );

  const deploymentId = resolveDeploymentId(
    givenDeploymentId === undefined || givenDeploymentId === ""
      ? undefined
      : givenDeploymentId,
    chainId,
  );

  const deploymentDir =
    connection.networkConfig.type === "edr-simulated" &&
    !writeLocalhostDeployment
      ? undefined
      : path.join(hre.config.paths.ignition, "deployments", deploymentId);

  await verifyArtifactsVersion(deploymentDir);

  if (chainId !== 31337) {
    if (process.env.HARDHAT_IGNITION_CONFIRM_DEPLOYMENT === undefined) {
      const confirmed = await confirmPrompt(
        `Confirm deploy to network ${connection.networkName} (${chainId})?`,
        "networkConfirmation",
      );

      if (!confirmed) {
        console.log("Deploy cancelled");
        process.exitCode = 1;
        return { result: null, executedFutureIds: new Set() };
      }
    }

    if (reset && process.env.HARDHAT_IGNITION_CONFIRM_RESET === undefined) {
      const confirmed = await confirmPrompt(
        `Confirm reset of deployment "${deploymentId}" on chain ${chainId}?`,
        "resetConfirmation",
      );

      if (!confirmed) {
        console.log("Deploy cancelled");
        process.exitCode = 1;
        return { result: null, executedFutureIds: new Set() };
      }
    }
  } else if (deploymentDir !== undefined) {
    // On hardhat-network, wipe deployment state if the in-memory instance changed.
    const instanceFilePath = path.join(
      hre.config.paths.cache,
      ".hardhat-network-instances.json",
    );
    const instanceFileExists = await exists(instanceFilePath);

    const instanceFile: {
      [deploymentId: string]: string;
    } = instanceFileExists ? await readJsonFile(instanceFilePath) : {};

    const metadata = (await connection.provider.request({
      method: "hardhat_metadata",
    })) as { instanceId: string };

    if (instanceFile[deploymentId] !== metadata.instanceId) {
      await remove(deploymentDir);
    }

    // save current instanceId to instanceFile for future runs
    instanceFile[deploymentId] = metadata.instanceId;
    await ensureDir(path.dirname(instanceFilePath));
    await writeJsonFile(instanceFilePath, instanceFile);
  }

  if (reset) {
    if (deploymentDir === undefined) {
      throw new HardhatError(
        HardhatError.ERRORS.IGNITION.INTERNAL.CANNOT_RESET_EPHEMERAL_NETWORK,
      );
    } else {
      await remove(deploymentDir);
    }
  }

  if (strategyName !== "basic" && strategyName !== "create2") {
    throw new HardhatError(
      HardhatError.ERRORS.IGNITION.STRATEGIES.UNKNOWN_STRATEGY,
      {
        strategyName,
      },
    );
  }

  await hre.tasks.getTask("build").run({
    quiet: true,
    noTests: true,
    defaultBuildProfile: "production",
  });

  const userModule = (await loadModule(
    hre.config.paths.ignition,
    modulePath,
  )) as IgnitionModule | null | undefined;

  if (userModule === undefined || userModule === null) {
    throw new HardhatError(
      HardhatError.ERRORS.IGNITION.INTERNAL.NO_MODULES_FOUND,
    );
  }

  let parameters: DeploymentParameters | undefined;
  if (parametersInput === undefined) {
    parameters = await resolveParametersFromModuleName(
      userModule.id,
      hre.config.paths.ignition,
    );
  } else if (
    parametersInput.endsWith(".json") ||
    parametersInput.endsWith(".json5")
  ) {
    parameters = await resolveParametersFromFileName(parametersInput);
  } else {
    parameters = await resolveParametersString(parametersInput);
  }

  const accounts = (await connection.provider.request({
    method: "eth_accounts",
  })) as string[];

  const artifactResolver = new HardhatArtifactResolver(hre.artifacts);
  const prettyEventHandler = new PrettyEventHandler(hre.interruptions);
  // Track which futures Ignition plans to execute in this run.
  const executionTracker = createExecutionTracker();
  const executionEventListener = createCompositeExecutionEventListener([
    prettyEventHandler,
    executionTracker.listener,
  ]);

  const strategyConfig = hre.config.ignition.strategyConfig?.[strategyName];

  if (
    hre.config.ignition.maxRetries === undefined &&
    hre.config.networks[connection.networkName]?.ignition.maxRetries !==
      undefined
  ) {
    hre.config.ignition.maxRetries =
      hre.config.networks[connection.networkName]?.ignition.maxRetries;
  }

  if (
    hre.config.ignition.retryInterval === undefined &&
    hre.config.networks[connection.networkName]?.ignition.retryInterval !==
      undefined
  ) {
    hre.config.ignition.retryInterval =
      hre.config.networks[connection.networkName]?.ignition.retryInterval;
  }

  // Allow tests to override deploy() without touching module internals.
  const deployFn = resolveDeploy();
  const result = await deployFn({
    config: hre.config.ignition,
    provider: connection.provider,
    executionEventListener,
    artifactResolver,
    deploymentDir,
    ignitionModule: userModule,
    deploymentParameters: parameters ?? {},
    accounts,
    defaultSender:
      defaultSender === undefined || defaultSender === ""
        ? undefined
        : defaultSender,
    strategy: strategyName,
    strategyConfig,
    maxFeePerGasLimit:
      hre.config.networks[connection.networkName]?.ignition.maxFeePerGasLimit,
    maxFeePerGas:
      hre.config.networks[connection.networkName]?.ignition.maxFeePerGas,
    maxPriorityFeePerGas:
      hre.config.networks[connection.networkName]?.ignition
        .maxPriorityFeePerGas,
    gasPrice: hre.config.networks[connection.networkName]?.ignition.gasPrice,
    disableFeeBumping:
      hre.config.ignition.disableFeeBumping ??
      hre.config.networks[connection.networkName]?.ignition.disableFeeBumping,
  });

  if (result.type === DeploymentResultType.SUCCESSFUL_DEPLOYMENT && verify) {
    console.log("");
    console.log(chalk.bold("Verifying deployed contracts"));
    console.log("");

    await hre.tasks.getTask(["ignition", "verify"]).run({ deploymentId });
  }

  if (result.type !== DeploymentResultType.SUCCESSFUL_DEPLOYMENT) {
    process.exitCode = 1;
  }

  return { result, executedFutureIds: executionTracker.executedFutureIds };
}

type DeployFn = typeof deploy;

function resolveDeploy(): DeployFn {
  // Test-only override hook.
  const override = (globalThis as { __MB_PLUGIN_DEPLOY__?: DeployFn })
    .__MB_PLUGIN_DEPLOY__;
  return override ?? deploy;
}

function createCompositeExecutionEventListener(
  listeners: ExecutionEventListener[],
): ExecutionEventListener {
  // Fan out Ignition execution events to multiple listeners.
  const notify = async <K extends keyof ExecutionEventListener>(
    method: K,
    event: Parameters<ExecutionEventListener[K]>[0],
  ) => {
    for (const listener of listeners) {
      await (listener[method] as (event: unknown) => Promise<void>)(event);
    }
  };

  return {
    wipeApply: (event) => notify("wipeApply", event),
    deploymentExecutionStateInitialize: (event) =>
      notify("deploymentExecutionStateInitialize", event),
    deploymentExecutionStateComplete: (event) =>
      notify("deploymentExecutionStateComplete", event),
    callExecutionStateInitialize: (event) =>
      notify("callExecutionStateInitialize", event),
    callExecutionStateComplete: (event) =>
      notify("callExecutionStateComplete", event),
    staticCallExecutionStateInitialize: (event) =>
      notify("staticCallExecutionStateInitialize", event),
    staticCallExecutionStateComplete: (event) =>
      notify("staticCallExecutionStateComplete", event),
    sendDataExecutionStateInitialize: (event) =>
      notify("sendDataExecutionStateInitialize", event),
    sendDataExecutionStateComplete: (event) =>
      notify("sendDataExecutionStateComplete", event),
    contractAtExecutionStateInitialize: (event) =>
      notify("contractAtExecutionStateInitialize", event),
    readEventArgumentExecutionStateInitialize: (event) =>
      notify("readEventArgumentExecutionStateInitialize", event),
    encodeFunctionCallExecutionStateInitialize: (event) =>
      notify("encodeFunctionCallExecutionStateInitialize", event),
    networkInteractionRequest: (event) =>
      notify("networkInteractionRequest", event),
    transactionPrepareSend: (event) => notify("transactionPrepareSend", event),
    transactionSend: (event) => notify("transactionSend", event),
    transactionConfirm: (event) => notify("transactionConfirm", event),
    staticCallComplete: (event) => notify("staticCallComplete", event),
    onchainInteractionBumpFees: (event) =>
      notify("onchainInteractionBumpFees", event),
    onchainInteractionDropped: (event) =>
      notify("onchainInteractionDropped", event),
    onchainInteractionReplacedByUser: (event) =>
      notify("onchainInteractionReplacedByUser", event),
    onchainInteractionTimeout: (event) =>
      notify("onchainInteractionTimeout", event),
    deploymentStart: (event) => notify("deploymentStart", event),
    deploymentInitialize: (event) => notify("deploymentInitialize", event),
    reconciliationWarnings: (event) => notify("reconciliationWarnings", event),
    batchInitialize: (event) => notify("batchInitialize", event),
    runStart: (event) => notify("runStart", event),
    beginNextBatch: (event) => notify("beginNextBatch", event),
    deploymentComplete: (event) => notify("deploymentComplete", event),
    setModuleId: (event) => notify("setModuleId", event),
    setStrategy: (event) => notify("setStrategy", event),
  };
}

function createExecutionTracker(): {
  executedFutureIds: Set<string>;
  listener: ExecutionEventListener;
} {
  const executedFutureIds = new Set<string>();
  const noop = async () => {};

  const listener: ExecutionEventListener = {
    wipeApply: noop,
    deploymentExecutionStateInitialize: noop,
    deploymentExecutionStateComplete: noop,
    callExecutionStateInitialize: noop,
    callExecutionStateComplete: noop,
    staticCallExecutionStateInitialize: noop,
    staticCallExecutionStateComplete: noop,
    sendDataExecutionStateInitialize: noop,
    sendDataExecutionStateComplete: noop,
    contractAtExecutionStateInitialize: noop,
    readEventArgumentExecutionStateInitialize: noop,
    encodeFunctionCallExecutionStateInitialize: noop,
    networkInteractionRequest: noop,
    transactionPrepareSend: noop,
    transactionSend: noop,
    transactionConfirm: noop,
    staticCallComplete: noop,
    onchainInteractionBumpFees: noop,
    onchainInteractionDropped: noop,
    onchainInteractionReplacedByUser: noop,
    onchainInteractionTimeout: noop,
    deploymentStart: noop,
    deploymentInitialize: noop,
    reconciliationWarnings: noop,
    // The batch list reflects which futures Ignition will execute this run.
    batchInitialize: async (event) => {
      for (const batch of event.batches) {
        for (const futureId of batch) {
          executedFutureIds.add(futureId);
        }
      }
    },
    runStart: noop,
    beginNextBatch: noop,
    deploymentComplete: noop,
    setModuleId: noop,
    setStrategy: noop,
  };

  return { executedFutureIds, listener };
}

async function resolveParametersFromModuleName(
  moduleName: string,
  ignitionPath: string,
): Promise<DeploymentParameters | undefined> {
  const files = await readdir(ignitionPath);
  const configFilename = `${moduleName}.config.json`;

  return files.includes(configFilename)
    ? readDeploymentParameters(path.resolve(ignitionPath, configFilename))
    : undefined;
}

async function resolveParametersFromFileName(
  fileName: string,
): Promise<DeploymentParameters> {
  const filepath = path.resolve(process.cwd(), fileName);

  return readDeploymentParameters(filepath);
}

async function resolveParametersString(
  paramString: string,
): Promise<DeploymentParameters> {
  try {
    const {
      default: { parse },
    } = await import("json5");

    return await parse(paramString, bigintReviver);
  } catch (e) {
    if (HardhatError.isHardhatError(e)) {
      throw e;
    }

    if (e instanceof Error) {
      throw new HardhatError(
        HardhatError.ERRORS.IGNITION.INTERNAL.FAILED_TO_PARSE_JSON,
        e,
      );
    }

    throw e;
  }
}

type ConfirmPromptName = "networkConfirmation" | "resetConfirmation";

type ConfirmPromptOptions = {
  type: "confirm";
  name: ConfirmPromptName;
  message: string;
  initial: boolean;
};

type ConfirmPromptResponse = {
  networkConfirmation?: boolean;
  resetConfirmation?: boolean;
};

const confirmPrompt = async (
  message: string,
  name: ConfirmPromptName,
): Promise<boolean> => {
  // prompts lacks types in this repo; isolate the cast to one place.
  const runPrompt = Prompt as unknown as (
    options: ConfirmPromptOptions,
  ) => Promise<ConfirmPromptResponse>;

  const response = await runPrompt({
    type: "confirm",
    name,
    message,
    initial: false,
  });

  return response[name] === true;
};

function bigintReviver(key: string, value: unknown): unknown {
  if (typeof value === "string" && /^\d+n$/.test(value)) {
    return BigInt(value.slice(0, -1));
  }

  if (typeof value === "number" && value > Number.MAX_SAFE_INTEGER) {
    throw new HardhatError(
      HardhatError.ERRORS.IGNITION.INTERNAL
        .PARAMETER_EXCEEDS_MAXIMUM_SAFE_INTEGER,
      { parameter: key, value },
    );
  }

  return value;
}

async function loadModule(
  ignitionDirectory: string,
  modulePath: string,
): Promise<unknown> {
  const modulesDirectory = path.resolve(ignitionDirectory, "modules");
  const fullpathToModule = path.resolve(modulePath);

  if (!(await exists(fullpathToModule))) {
    throw new HardhatError(
      HardhatError.ERRORS.IGNITION.INTERNAL.MODULE_NOT_FOUND_AT_PATH,
      {
        modulePath,
      },
    );
  }

  if (!isInModuleDirectory(modulesDirectory, fullpathToModule)) {
    throw new HardhatError(
      HardhatError.ERRORS.IGNITION.INTERNAL.MODULE_OUTSIDE_MODULE_DIRECTORY,
      {
        modulePath,
        shortModulesDirectoryName: path.join(ignitionDirectory, "modules"),
      },
    );
  }

  let module;
  try {
    module = await import(pathToFileURL(fullpathToModule).href);
  } catch (e) {
    if (HardhatError.isHardhatError(e)) {
      // Errors thrown from within ModuleBuilder use this error number.
      // They have a stack trace that's useful to the user, so we display it here.
      if (e.number === 10702) {
        console.error(e);
        throw new HardhatError(
          HardhatError.ERRORS.IGNITION.INTERNAL.MODULE_VALIDATION_FAILED,
          e,
        );
      }
    }

    throw e;
  }

  return module.default ?? module;
}

function isInModuleDirectory(
  modulesDirectory: string,
  modulePath: string,
): boolean {
  const resolvedModulesDirectory = path.resolve(modulesDirectory);
  const moduleRelativeToModuleDir = path.relative(
    resolvedModulesDirectory,
    modulePath,
  );

  return (
    !moduleRelativeToModuleDir.startsWith("..") &&
    !path.isAbsolute(moduleRelativeToModuleDir)
  );
}

async function verifyArtifactsVersion(
  deploymentDir: string | undefined,
): Promise<void> {
  // Keep parity with Hardhat Ignition's artifact migration guard.
  const artifactsDir = `${deploymentDir}/artifacts`;
  if (deploymentDir === undefined || !(await exists(artifactsDir))) {
    return;
  }

  for (const filename of await readdir(artifactsDir)) {
    if (filename.endsWith(".dbg.json")) {
      continue;
    }

    const artifactPath = path.join(artifactsDir, filename);
    const artifact = await readJsonFile(artifactPath);

    if (hasFormat(artifact, "hh-sol-artifact-1")) {
      throw new HardhatError(
        HardhatError.ERRORS.IGNITION.GENERAL.ARTIFACT_MIGRATION_NEEDED,
        {
          deploymentId: deploymentDir.split(path.sep).pop(),
        },
      );
    }
  }

  const buildInfoDir = `${deploymentDir}/build-info`;
  if (!(await exists(buildInfoDir))) {
    return;
  }

  for (const filename of await readdir(buildInfoDir)) {
    const buildInfoPath = path.join(buildInfoDir, filename);
    const buildInfo = await readJsonFile(buildInfoPath);

    if (hasFormat(buildInfo, "hh-sol-build-info-1")) {
      throw new HardhatError(
        HardhatError.ERRORS.IGNITION.GENERAL.ARTIFACT_MIGRATION_NEEDED,
        {
          deploymentId: deploymentDir.split(path.sep).pop(),
        },
      );
    }
  }
}

function hasFormat(
  value: unknown,
  format: "hh-sol-artifact-1" | "hh-sol-build-info-1",
): boolean {
  // Runtime guard for build-info and artifact JSON shapes.
  if (typeof value !== "object" || value === null) {
    return false;
  }

  if (!("_format" in value)) {
    return false;
  }

  return (value as { _format?: unknown })._format === format;
}

export default taskAction;
