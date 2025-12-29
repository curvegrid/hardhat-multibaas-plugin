import { defineConfig } from "hardhat/config";
import hardhatIgnition from "@nomicfoundation/hardhat-ignition";
import hardhatMultiBaasPlugin from "hardhat-multibaas-plugin";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const networkName = process.env.HARDHAT_NETWORK ?? "development";
const configPath = path.resolve(
  __dirname,
  `./deployment-config.${networkName}.ts`,
);

const { deploymentConfig } = (await import(pathToFileURL(configPath).href)) as {
  deploymentConfig: {
    deploymentEndpoint: string;
    ethChainID: number;
    web3Key: string;
    adminApiKey: string;
    deployerPrivateKey: string;
  };
};

export default defineConfig({
  plugins: [hardhatIgnition, hardhatMultiBaasPlugin],
  solidity: {
    version: "0.8.28",
    npmFilesToBuild: [
      "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol",
      "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol",
    ],
  },
  ignition: {
    requiredConfirmations: 1,
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
});
