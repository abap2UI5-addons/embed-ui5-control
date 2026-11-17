import js from "@eslint/js";
import globals from "globals";

const rules = {
  ...js.configs.recommended.rules,
  "no-unused-vars": [
    "error",
    { caughtErrors: "none", argsIgnorePattern: "^_" },
  ],
  eqeqeq: ["error", "smart"],
  "prefer-const": "error",
};

export default [
  {
    ignores: [
      "**/node_modules/**",
      // the abap2UI5 checkout CI builds its backend and takes its BSP tools
      // from
      ".abap2ui5/**",
      "**/dist/**",
      // the branches scripts/build-bsp.mjs writes - generated pages
      "out/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  // UI5 modules, run in the browser: the control, the example apps and the
  // card
  {
    files: ["packages/*/src/**/*.js", "examples/*/webapp/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: { ...globals.browser, sap: "readonly" },
    },
    rules,
  },
  // tooling
  {
    files: ["**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: globals.node,
    },
    rules,
  },
  // e2e tests - the functions passed to page.evaluate( ) run in the page
  {
    files: ["test/e2e/**/*.mjs"],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser, sap: "readonly" },
    },
  },
];
