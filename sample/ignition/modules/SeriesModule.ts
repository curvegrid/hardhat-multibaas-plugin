import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { mb } from "hardhat-multibaas-plugin/ignition";

const seriesModule = buildModule("SeriesModule", (m) => {
  const registry = m.contract("SeriesRegistry");
  mb.link(registry, {
    contractLabel: "series_registry",
    contractVersion: "1.0",
    addressAlias: "series_registry",
  });

  const token = m.contract("SeriesToken", [
    "SeriesToken",
    "SER",
    registry,
    1_000_000n,
  ]);
  mb.link(token, {
    contractLabel: "series_token",
    contractVersion: "1.0",
    addressAlias: "series_token",
  });

  const vault = m.contract("SeriesVault", [token, registry]);
  mb.link(vault, {
    contractLabel: "series_vault",
    contractVersion: "1.0",
    addressAlias: "series_vault",
  });

  const factory = m.contract("SeriesFactory", [registry]);
  mb.link(factory, {
    contractLabel: "series_factory",
    contractVersion: "1.0",
    addressAlias: "series_factory",
  });

  return { registry, token, vault, factory };
});

export default seriesModule;
