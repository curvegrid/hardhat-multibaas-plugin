// Copyright (c) 2021 Curvegrid Inc.

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Contract } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployResult } from "hardhat-multibaas-plugin/lib/type-extensions";

export async function deployGreeterContract(
  signer: SignerWithAddress,
  hre: HardhatRuntimeEnvironment
): Promise<DeployResult> {
  await hre.mbDeployer.setup();

  return hre.mbDeployer.deploy(
    signer as SignerWithAddress,
    "Greeter",
    ["Hello, world!"],
    {
      addressLabel: "greeter",
      contractVersion: "1.0",
      contractLabel: "greeter",
    }
  );
}

export async function deployMetaCoinContract(
  signer: SignerWithAddress,
  hre: HardhatRuntimeEnvironment
): Promise<Contract> {
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
      }
    )
  ).contract;

  const metaCoinInstance = (
    await hre.mbDeployer.deploy(
      {
        signer,
        // MetaCoint must be linked with ConvertLib before deploying
        libraries: {
          ConvertLib: convertLibInstance.address,
        },
      },
      "MetaCoin",
      [],
      // we don't want to deploy multiple contracts into MultiBaas
      {
        contractVersion: "1.0",
        addressLabel: "metacoin",
        contractLabel: "metacoin",
      }
    )
  ).contract;

  return metaCoinInstance;
}
