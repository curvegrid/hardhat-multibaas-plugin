import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import hre from "hardhat";

async function main() {
  const signers = await hre.ethers.getSigners();
  const signer = signers[0];

  await hre.mbDeployer.setup();

  const convertLibInstance = (
    await hre.mbDeployer.deploy(
      signer,
      "ConvertLib",
      [],
      // we don't want to deploy multiple contracts into MultiBaas
      {
        contractVersion: "1.0",
        addressLabel: "convertlib",
        contractLabel: "convertlib",
      },
    )
  ).contract;

  await hre.mbDeployer.deploy(
    {
      signer,
      // MetaCoin must be linked with ConvertLib before deploying
      libraries: {
        ConvertLib: await convertLibInstance.getAddress(),
      },
    },
    "MetaCoin",
    [],
    // we don't want to deploy multiple contracts into MultiBaas
    {
      contractVersion: "1.0",
      addressLabel: "metacoin",
      contractLabel: "metacoin",
      startingBlock: "0",
    },
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
