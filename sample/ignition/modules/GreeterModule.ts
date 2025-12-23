import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { mb } from "hardhat-multibaas-plugin/ignition";

const greeterModule = buildModule("GreeterModule", (m) => {
  const greeter = m.contract("Greeter", ["Hello, world!"]);
  mb.link(greeter, {
    contractLabel: "greeter",
    contractVersion: "1.0",
    addressAlias: "greeter",
  });

  return { greeter };
});

export default greeterModule;
