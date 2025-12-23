import type { CompilerInput } from "hardhat/types/solidity";
import type { SolidityHooks } from "hardhat/types/hooks";

const DOC_SELECTORS = ["userdoc", "devdoc"];

export default async (): Promise<Partial<SolidityHooks>> => ({
  preprocessSolcInputBeforeBuilding: async (context, solcInput, next) => {
    const outputSelection = ensureOutputSelection(
      solcInput.settings.outputSelection,
    );

    solcInput.settings.outputSelection = outputSelection;
    return next(context, solcInput);
  },
});

function ensureOutputSelection(
  outputSelection: CompilerInput["settings"]["outputSelection"] | undefined,
): CompilerInput["settings"]["outputSelection"] {
  const selection = outputSelection ?? {};

  selection["*"] ??= {};
  selection["*"]["*"] ??= [];

  for (const docType of DOC_SELECTORS) {
    if (!selection["*"]["*"].includes(docType)) {
      selection["*"]["*"].push(docType);
    }
  }

  for (const contracts of Object.values(selection)) {
    for (const selectors of Object.values(contracts)) {
      for (const docType of DOC_SELECTORS) {
        if (!selectors.includes(docType)) {
          selectors.push(docType);
        }
      }
    }
  }

  return selection;
}
