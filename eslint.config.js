const typescriptEslint = require("@typescript-eslint/eslint-plugin");
const typescriptEslintParser = require("@typescript-eslint/parser");
const importPlugin = require("eslint-plugin-import");
const eslintComments = require("eslint-plugin-eslint-comments");
const prettier = require("eslint-plugin-prettier");

module.exports = [
  {
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
    },
    ignores: ["eslint.config.js", "node_modules/*", "sample/*", "lib/*"],
  },
];
