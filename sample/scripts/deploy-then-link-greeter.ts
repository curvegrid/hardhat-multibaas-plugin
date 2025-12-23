import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import hre from "hardhat";

async function main() {
  const signers = await hre.ethers.getSigners();
  const signer = signers[0];

  await hre.mbDeployer.setup();

  const factory = await hre.ethers.getContractFactory("Greeter", signer);
  const contract = await factory.deploy("Hello, world!");
  await contract.waitForDeployment();

  await hre.mbDeployer.link(
    signer as SignerWithAddress,
    "Greeter",
    await contract.getAddress(),
    {
      addressAlias: "linked_greeter",
      contractVersion: "1.0",
      contractLabel: "greeter",
    },
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
