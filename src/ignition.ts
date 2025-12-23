import type { ContractFuture } from "@nomicfoundation/ignition-core";

import type { MultiBaasLinkOptions } from "./types.js";
import { registerLink } from "./internal/registry.js";

export function link<ContractNameT extends string>(
  future: ContractFuture<ContractNameT>,
  options: MultiBaasLinkOptions = {},
): ContractFuture<ContractNameT> {
  registerLink(future as ContractFuture<string>, options);
  return future;
}

export const mb = { link };
