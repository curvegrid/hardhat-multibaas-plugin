import type { ContractFuture } from "@nomicfoundation/ignition-core";

import type { MultiBaasLinkOptions, RegisteredLink } from "../types.js";

const linkRegistry = new Map<string, RegisteredLink>();

export function registerLink(
  future: ContractFuture<string>,
  options: MultiBaasLinkOptions = {},
): void {
  const futureId = (future as { id?: unknown }).id;
  const contractName = (future as { contractName?: unknown }).contractName;

  if (typeof futureId !== "string" || futureId.length === 0) {
    throw new Error("MultiBaas: Invalid future id in link registration.");
  }

  if (typeof contractName !== "string" || contractName.length === 0) {
    throw new Error("MultiBaas: Invalid contract name in link registration.");
  }

  linkRegistry.set(futureId, {
    futureId,
    contractName,
    options: { ...options },
  });
}

export function getRegisteredLinks(): RegisteredLink[] {
  return Array.from(linkRegistry.values());
}

export function resetRegistry(): void {
  linkRegistry.clear();
}
