import importPlugin from "eslint-plugin-import";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

const sourceFiles = ["**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"];
const typedSourceFiles = ["**/*.{ts,tsx,mts,cts}"];

/**
 * One node_modules at the root means an app could import a package it never declared and still
 * work locally. Every import must be listed in the importing workspace's own package.json.
 */
export const dependencyRules = {
  files: sourceFiles,
  plugins: { import: importPlugin },
  rules: {
    "import/no-extraneous-dependencies": [
      "error",
      { devDependencies: true, peerDependencies: true },
    ],
  },
};

export default [
  ...tseslint.config({
    files: typedSourceFiles,
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
    },
  }),
  {
    files: sourceFiles,
    plugins: { import: importPlugin, "react-hooks": reactHooks },
    settings: {
      "import/extensions": [".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".mts", ".cts"],
    },
    rules: {
      complexity: ["error", 40],
      "import/no-cycle": ["error", { ignoreExternal: true }],
      "import/order": [
        "error",
        {
          groups: [
            "builtin",
            "external",
            "internal",
            "parent",
            "sibling",
            "index",
            "object",
            "type",
          ],
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],
      "react-hooks/exhaustive-deps": "error",
      "react-hooks/rules-of-hooks": "error",
    },
  },
  dependencyRules,
  {
    // JavaScript workspaces (plugins/crawler) write their React components in .jsx.
    files: ["**/*.jsx"],
    languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
  },
];
