import type { SensitiveString } from "hardhat/types/config";

export interface MBConfigUserConfig {
  host: SensitiveString;
  apiKey: SensitiveString;
  allowUpdateAddress?: string[];
  allowUpdateContract?: string[];
  syncExisting?: boolean;
  requireChainIdMatch?: boolean;
}

export interface MBConfig {
  host: string;
  apiKey: string;
  allowUpdateAddress: string[];
  allowUpdateContract: string[];
  syncExisting: boolean;
  requireChainIdMatch: boolean;
}

export interface MultiBaasLinkOptions {
  contractLabel?: string;
  contractVersion?: string;
  addressAlias?: string;
  startingBlock?: string;
}

export interface RegisteredLink {
  futureId: string;
  contractName: string;
  options: MultiBaasLinkOptions;
}
