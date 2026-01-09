import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createHardhatRuntimeEnvironment,
  importUserConfig,
  resolveHardhatConfigPath,
} from "hardhat/hre";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function createFixtureProjectHRE(fixtureProjectName) {
  const fixtureProjectRoot = path.resolve(
    __dirname,
    `../fixture-projects/${fixtureProjectName}`,
  );

  const configPath = await resolveHardhatConfigPath(
    path.join(fixtureProjectRoot, "hardhat.config.js"),
  );

  const userConfig = await importUserConfig(configPath);

  return createHardhatRuntimeEnvironment(
    userConfig,
    {
      config: configPath,
    },
    fixtureProjectRoot,
  );
}
