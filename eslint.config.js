import path from "node:path";
import { fileURLToPath } from "node:url";

import typescriptEslint from "@typescript-eslint/eslint-plugin";
import typescriptEslintParser from "@typescript-eslint/parser";
import importPlugin from "eslint-plugin-import";
import eslintComments from "eslint-plugin-eslint-comments";
import prettier from "eslint-plugin-prettier";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default [
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: typescriptEslintParser,
      parserOptions: {
        tsconfigRootDir: __dirname,
        project: ["./tsconfig.json"],
      },
    },
    plugins: {
      "@typescript-eslint": typescriptEslint,
      import: importPlugin,
      "eslint-comments": eslintComments,
      prettier,
    },
    rules: {
      ...typescriptEslint.configs.recommended.rules,
      ...typescriptEslint.configs["recommended-requiring-type-checking"].rules,
      ...importPlugin.configs.recommended.rules,
      ...eslintComments.configs.recommended.rules,
      ...prettier.configs.recommended.rules,
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/require-await": "off",
      "import/no-unresolved": "off",
    },
    ignores: [
      "eslint.config.js",
      "node_modules/**",
      "dist/**",
      "sample/**",
      "lib/**",
      "test/**",
    ],
  },
];
