import { defineConfig } from "hardhat/config";
import hardhatMultiBaasPlugin from "hardhat-multibaas-plugin";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const networkName = process.env.HARDHAT_NETWORK ?? "development";
const configPath = path.resolve(
  __dirname,
  `./deployment-config.${networkName}.js`,
);

const { deploymentConfig } = require(configPath) as {
  deploymentConfig: {
    deploymentEndpoint: string;
    ethChainID: number;
    web3Key: string;
    adminApiKey: string;
    deployerPrivateKey: string;
  };
};

export default defineConfig({
  plugins: [hardhatMultiBaasPlugin],
  solidity: {
    version: "0.8.28",
    npmFilesToBuild: [
      "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol",
      "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol",
    ],
  },
  networks: {
    development: {
      type: "http",
      chainType: "l1",
      url: `${deploymentConfig.deploymentEndpoint}/web3/${deploymentConfig.web3Key}`,
      chainId: deploymentConfig.ethChainID,
      accounts: [deploymentConfig.deployerPrivateKey],
    },
  },
  mbConfig: {
    host: deploymentConfig.deploymentEndpoint,
    apiKey: deploymentConfig.adminApiKey,
    allowUpdateAddress: ["development"],
    allowUpdateContract: ["development"],
  },
  ignition: {
    requiredConfirmations: 1,
  },
});
