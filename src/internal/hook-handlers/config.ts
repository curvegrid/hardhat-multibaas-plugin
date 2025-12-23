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
  const mbConfig = userConfig.mbConfig;

  if (mbConfig === undefined) {
    errors.push({
      path: ["mbConfig"],
      message:
        "MultiBaas config is required. Add mbConfig to your Hardhat config.",
    });
    return errors;
  }

  if (typeof mbConfig !== "object" || mbConfig === null) {
    errors.push({
      path: ["mbConfig"],
      message: "mbConfig must be an object.",
    });
    return errors;
  }

  validateSensitiveString(mbConfig, "host", errors);
  validateSensitiveString(mbConfig, "apiKey", errors);
  validateStringArray(mbConfig, "allowUpdateAddress", errors);
  validateStringArray(mbConfig, "allowUpdateContract", errors);

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
    mbConfig: {
      host: await resolveConfigurationVariable(mbConfig.host).getUrl(),
      apiKey: await resolveConfigurationVariable(mbConfig.apiKey).get(),
      allowUpdateAddress: mbConfig.allowUpdateAddress ?? [],
      allowUpdateContract: mbConfig.allowUpdateContract ?? [],
    },
  };
}

function validateSensitiveString(
  mbConfig: MBConfigUserConfig,
  key: "host" | "apiKey",
  errors: HardhatUserConfigValidationError[],
): void {
  if (mbConfig[key] === undefined) {
    errors.push({
      path: ["mbConfig", key],
      message: `mbConfig.${key} is required.`,
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
