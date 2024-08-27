import { HardhatRuntimeEnvironment } from "hardhat/types";

const migration = async (hre: HardhatRuntimeEnvironment) => {
  const { deploy, log } = hre.deployments;
  const { deployer } = await hre.getNamedAccounts();

  const deployedContract = await deploy("ConvertLib", {
    from: deployer!,
    log: true,
    contract: "ConvertLib",
  });

  log(
    `ConvertLib: Deployed ${deployedContract.address} (tx: ${deployedContract.transactionHash})`
  );
};

migration.skip = async (hre: HardhatRuntimeEnvironment) => {
  const { log } = hre.deployments;
  const deployment = await hre.deployments.getOrNull("ConvertLib");
  if (deployment) {
    log(`ConvertLib: already deployed at ${deployment.address}, skipping...`);
    return true;
  }
  return false;
};

export default migration;
