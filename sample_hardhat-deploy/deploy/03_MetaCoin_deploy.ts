import { HardhatRuntimeEnvironment } from "hardhat/types";

const migration = async (hre: HardhatRuntimeEnvironment) => {
  const { deploy, log } = hre.deployments;
  const { deployer } = await hre.getNamedAccounts();

  const deployedContract = await deploy("MetaCoin", {
    from: deployer!,
    log: true,
    contract: "MetaCoin",
    libraries: {
      ConvertLib: (await hre.deployments.get("ConvertLib")).address,
    },
  });

  log(
    `MetaCoin: Deployed ${deployedContract.address} (tx: ${deployedContract.transactionHash})`
  );
};

migration.skip = async (hre: HardhatRuntimeEnvironment) => {
  const { log } = hre.deployments;
  const deployment = await hre.deployments.getOrNull("MetaCoin");
  if (deployment) {
    log(`MetaCoin: already deployed at ${deployment.address}, skipping...`);
    return true;
  }
  return false;
};

export default migration;
