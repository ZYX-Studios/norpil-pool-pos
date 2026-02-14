import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",

    // Legacy/one-off node scripts (not part of app bundle). Keep out of CI lint.
    "scripts/**",
    "reproduce-kds.js",
    "verify-kds-fix.js",
  ]),
]);

export default eslintConfig;
