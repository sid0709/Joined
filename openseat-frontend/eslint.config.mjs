import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    files: ["src/candidate/**/*.{ts,tsx}", "app/marketplace/candidate/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/src/client/**", "@/client/**", "@/src/client/**"],
              message: "Candidate code must not import from the client module. Use @/src/shared/* instead.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/client/**/*.{ts,tsx}", "app/marketplace/client/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/src/candidate/**", "@/candidate/**", "@/src/candidate/**"],
              message: "Client code must not import from the candidate module. Use @/src/shared/* instead.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/shared/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/src/candidate/**", "**/src/client/**", "@/candidate/**", "@/client/**"],
              message: "Shared code must not import from candidate or client modules.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
