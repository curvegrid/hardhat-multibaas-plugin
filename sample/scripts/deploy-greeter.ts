import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import hre from "hardhat";

async function main() {
  const signers = await hre.ethers.getSigners();
  const signer = signers[0];

  await hre.mbDeployer.setup();

  await hre.mbDeployer.deploy(
    signer as SignerWithAddress,
    "Greeter",
    ["Hello, world!"],
    {
      addressAlias: "greeter",
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
