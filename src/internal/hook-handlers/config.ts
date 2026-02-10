import type {
  ConfigurationVariableResolver,
  HardhatConfig,
  HardhatUserConfig,
} from "hardhat/types/config";
import type {
  ConfigHooks,
  HardhatUserConfigValidationError,
} from "hardhat/types/hooks";

import type { MBConfigUserConfig } from "../../types.js";

export default async (): Promise<Partial<ConfigHooks>> => ({
  validateUserConfig,
  resolveUserConfig,
});

export async function validateUserConfig(
  userConfig: HardhatUserConfig,
): Promise<HardhatUserConfigValidationError[]> {
  const errors: HardhatUserConfigValidationError[] = [];
  const mbConfig = getMbConfig(userConfig, errors);
  if (mbConfig === undefined) {
    return errors;
  }

  validateSensitiveString(mbConfig, "host", errors);
  validateSensitiveString(mbConfig, "apiKey", errors);
  validateStringArray(mbConfig, "allowUpdateAddress", errors);
  validateStringArray(mbConfig, "allowUpdateContract", errors);
  validateBoolean(mbConfig, "syncExisting", errors);
  validateBoolean(mbConfig, "requireChainIdMatch", errors);

  return errors;
}

export async function resolveUserConfig(
  userConfig: HardhatUserConfig,
  resolveConfigurationVariable: ConfigurationVariableResolver,
  next: (
    nextUserConfig: HardhatUserConfig,
    nextResolveConfigurationVariable: ConfigurationVariableResolver,
  ) => Promise<HardhatConfig>,
): Promise<HardhatConfig> {
  const resolvedConfig = await next(userConfig, resolveConfigurationVariable);

  const mbConfig = userConfig.mbConfig;
  if (mbConfig === undefined) {
    return resolvedConfig;
  }
  if (mbConfig.host === undefined || mbConfig.apiKey === undefined) {
    throw new Error(
      "MultiBaas: mbConfig.host and mbConfig.apiKey are required.",
    );
  }

  return {
    ...resolvedConfig,
    mbConfig: await resolveMbConfig(mbConfig, resolveConfigurationVariable),
  };
}

function getMbConfig(
  userConfig: HardhatUserConfig,
  errors: HardhatUserConfigValidationError[],
): MBConfigUserConfig | undefined {
  const mbConfig = userConfig.mbConfig;

  if (mbConfig === undefined) {
    errors.push({
      path: ["mbConfig"],
      message:
        "MultiBaas config is required. Add mbConfig to your Hardhat config.",
    });
    return undefined;
  }

  if (typeof mbConfig !== "object" || mbConfig === null) {
    errors.push({
      path: ["mbConfig"],
      message: "mbConfig must be an object.",
    });
    return undefined;
  }

  return mbConfig;
}

async function resolveMbConfig(
  mbConfig: MBConfigUserConfig,
  resolveConfigurationVariable: ConfigurationVariableResolver,
): Promise<{
  host: string;
  apiKey: string;
  allowUpdateAddress: string[];
  allowUpdateContract: string[];
  syncExisting: boolean;
  requireChainIdMatch: boolean;
}> {
  return {
    host: await resolveConfigurationVariable(mbConfig.host).getUrl(),
    apiKey: await resolveConfigurationVariable(mbConfig.apiKey).get(),
    allowUpdateAddress: normalizeAllowList(mbConfig.allowUpdateAddress),
    allowUpdateContract: normalizeAllowList(mbConfig.allowUpdateContract),
    syncExisting: mbConfig.syncExisting ?? false,
    requireChainIdMatch: mbConfig.requireChainIdMatch ?? true,
  };
}

function validateSensitiveString(
  mbConfig: MBConfigUserConfig,
  key: "host" | "apiKey",
  errors: HardhatUserConfigValidationError[],
): void {
  const value = mbConfig[key];
  if (value === undefined) {
    errors.push({
      path: ["mbConfig", key],
      message: `mbConfig.${key} is required.`,
    });
  } else if (typeof value !== "string" && typeof value !== "object") {
    errors.push({
      path: ["mbConfig", key],
      message: `mbConfig.${key} must be a string or configuration variable.`,
    });
  }
}

function validateStringArray(
  mbConfig: MBConfigUserConfig,
  key: "allowUpdateAddress" | "allowUpdateContract",
  errors: HardhatUserConfigValidationError[],
): void {
  const value = mbConfig[key];
  if (value === undefined) {
    return;
  }

  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    errors.push({
      path: ["mbConfig", key],
      message: `mbConfig.${key} must be an array of strings.`,
    });
  }
}

function validateBoolean(
  mbConfig: MBConfigUserConfig,
  key: "syncExisting" | "requireChainIdMatch",
  errors: HardhatUserConfigValidationError[],
): void {
  const value = mbConfig[key];
  if (value === undefined) {
    return;
  }

  if (typeof value !== "boolean") {
    errors.push({
      path: ["mbConfig", key],
      message: `mbConfig.${key} must be a boolean.`,
    });
  }
}

function normalizeAllowList(value: string[] | undefined): string[] {
  return Array.isArray(value) ? value : [];
}
