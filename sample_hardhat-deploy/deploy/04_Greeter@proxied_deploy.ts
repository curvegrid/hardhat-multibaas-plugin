import { HardhatRuntimeEnvironment } from "hardhat/types";

const migration = async (hre: HardhatRuntimeEnvironment) => {
  const { deploy, log } = hre.deployments;
  const { deployer } = await hre.getNamedAccounts();

  const deployedContract = await deploy("Greeter@proxied", {
    from: deployer!,
    log: true,
    contract: "Greeter",
    args: ["Hello, world!"],
    proxy: true,
  });

  log(
    `Greeter@proxied: Deployed ${deployedContract.address} (tx: ${deployedContract.transactionHash})`
  );
};

migration.skip = async (hre: HardhatRuntimeEnvironment) => {
  const { log } = hre.deployments;
  const deployment = await hre.deployments.getOrNull("Greeter@proxied");
  if (deployment) {
    log(`Greeter@proxied: already deployed at ${deployment.address}, skipping...`);
    return true;
  }
  return false;
};

export default migration;
