import eslint from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores([
    "**/.next/**",
    "**/coverage/**",
    "**/dist/**",
    "**/node_modules/**",
    "**/playwright-report/**",
    "**/test-results/**",
    "**/next-env.d.ts",
  ]),
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...[...nextVitals, ...nextTypescript].map((config) => ({
    ...config,
    files: ["apps/web/**/*.{js,jsx,ts,tsx}", "apps/api/**/*.{js,jsx,ts,tsx}"],
  })),
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@iride/config/server",
                "@iride/config/worker",
                "@iride/database/admin",
                "@iride/worker",
                "@iride/worker/*",
              ],
              message:
                "The web app may only import browser-safe configuration and must not import admin or worker infrastructure.",
            },
          ],
        },
      ],
    },
  },
]);
