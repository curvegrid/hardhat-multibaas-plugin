import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { mb } from "hardhat-multibaas-plugin/ignition";

const linkedGreeterModule = buildModule("LinkedGreeterModule", (m) => {
  const deployedGreeter = m.contract("Greeter", ["Hello, world!"]);
  const linkedGreeter = m.contractAt("Greeter", deployedGreeter, {
    id: "LinkedGreeter",
  });

  mb.link(linkedGreeter, {
    contractLabel: "greeter",
    contractVersion: "1.0",
    addressAlias: "linked_greeter",
  });

  return { deployedGreeter, linkedGreeter };
});

export default linkedGreeterModule;
