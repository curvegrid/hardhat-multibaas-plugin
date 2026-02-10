import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { mb } from "hardhat-multibaas-plugin/ignition";

const proxiedGreeterModule = buildModule("ProxiedGreeterModule", (m) => {
  const proxyAdminOwner = m.getAccount(0);
  const implementation = m.contract("ProxiedGreeter", [proxyAdminOwner]);

  const initData = m.encodeFunctionCall(implementation, "initialize", [
    "Hello, world!",
  ]);

  const proxy = m.contract("TransparentUpgradeableProxy", [
    implementation,
    proxyAdminOwner,
    initData,
  ]);

  const proxyAdminAddress = m.readEventArgument(
    proxy,
    "AdminChanged",
    "newAdmin",
  );
  const proxyAdmin = m.contractAt("ProxyAdmin", proxyAdminAddress);

  const proxiedGreeter = m.contractAt("ProxiedGreeter", proxy, {
    id: "ProxiedGreeterProxy",
  });
  mb.link(proxiedGreeter, {
    contractLabel: "proxied_greeter",
    contractVersion: "1.0",
    addressAlias: "proxied_greeter",
  });

  return { proxyAdmin, proxy, proxiedGreeter };
});

export default proxiedGreeterModule;
