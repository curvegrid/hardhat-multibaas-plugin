import { CompilerOutputContract } from "hardhat/types";

export interface CompilerSettings {
  outputSelection?: OutputSelection;
}

export interface OutputSelection {
  "*": {
    "*": string[];
    "": string[];
  };
}

export interface ExtendedCompilerOutputContract extends CompilerOutputContract {
  devdoc?: unknown;
  userdoc?: unknown;
}

export interface ArtifactDBG {
  buildInfo: string;
}
