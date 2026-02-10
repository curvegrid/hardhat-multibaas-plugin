import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { mb } from "hardhat-multibaas-plugin/ignition";

const metaCoinModule = buildModule("MetaCoinModule", (m) => {
  const convertLib = m.library("ConvertLib");
  mb.link(convertLib, {
    contractLabel: "convertlib",
    contractVersion: "1.0",
    addressAlias: "convertlib",
  });

  const metaCoin = m.contract("MetaCoin", [], {
    libraries: {
      ConvertLib: convertLib,
    },
  });
  mb.link(metaCoin, {
    contractLabel: "metacoin",
    contractVersion: "1.0",
    addressAlias: "metacoin",
    startingBlock: "0",
  });

  return { convertLib, metaCoin };
});

export default metaCoinModule;
