import { HardhatRuntimeEnvironment } from "hardhat/types";

const migration = async (hre: HardhatRuntimeEnvironment) => {
  const { deploy, log } = hre.deployments;
  const { deployer } = await hre.getNamedAccounts();

  const deployedContract = await deploy("Greeter@1.0", {
    from: deployer!,
    log: true,
    contract: "Greeter",
    args: ["Hello, world!"],
  });

  log(
    `Greeter@1.0: Deployed ${deployedContract.address} (tx: ${deployedContract.transactionHash})`
  );
};

migration.skip = async (hre: HardhatRuntimeEnvironment) => {
  const { log } = hre.deployments;
  const deployment = await hre.deployments.getOrNull("Greeter@1.0");
  if (deployment) {
    log(`Greeter@1.0: already deployed at ${deployment.address}, skipping...`);
    return true;
  }
  return false;
};

migration.tags = ["Greeter"];

export default migration;
