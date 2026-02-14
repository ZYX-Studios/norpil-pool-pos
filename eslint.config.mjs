import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // This repo contains legacy code that still uses `any` heavily.
  // Relax it for app/lib only so we can enforce other correctness/React rules.
  {
    files: ["app/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}", "middleware.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/ban-ts-comment": "off",
    },
  },

  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "scripts/**",
    "reproduce-kds.js",
    "verify-kds-fix.js",
  ]),
]);

export default eslintConfig;