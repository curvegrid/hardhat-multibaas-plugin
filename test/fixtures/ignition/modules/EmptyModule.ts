import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const emptyModule = buildModule("EmptyModule", () => {
  return {};
});

export default emptyModule;
