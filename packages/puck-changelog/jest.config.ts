import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest/presets/js-with-ts-esm", // TS + ESM (matches core)
  testEnvironment: "jsdom",

  extensionsToTreatAsEsm: [".ts", ".tsx"],

  transform: {
    "^.+\\.[tj]sx?$": ["ts-jest", { useESM: true }],
  },

  // Re-enable transform *inside* selected node_modules (matches core)
  transformIgnorePatterns: [
    "/node_modules/(?!(?:@preact/signals-core|@preact/signals-react|@dnd-kit)/)",
  ],

  moduleNameMapper: {
    // Resolve the sibling workspace package from source — CI runs tests
    // before any build, so @puckeditor/core has no dist yet.
    "^@puckeditor/core$": "<rootDir>/../core/bundle/core.ts",
    // stub out style & asset imports
    "\\.(css|less|sass|scss)$": "identity-obj-proxy",
  },
};

export default config;
