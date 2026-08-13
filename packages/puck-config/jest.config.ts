import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest/presets/js-with-ts-esm", // TS + ESM (matches core)
  testEnvironment: "jsdom",

  setupFiles: ["<rootDir>/jest.setup.ts"],

  extensionsToTreatAsEsm: [".ts", ".tsx"],

  transform: {
    "^.+\\.[tj]sx?$": ["ts-jest", { useESM: true }],
  },

  // Re-enable transform *inside* selected node_modules (matches core)
  transformIgnorePatterns: [
    "/node_modules/(?!(?:@preact/signals-core|@preact/signals-react|@dnd-kit)/)",
  ],

  moduleNameMapper: {
    // Resolve sibling workspace packages from source — CI runs tests
    // before any build, so nothing has a dist yet.
    "^@puckeditor/core$": "<rootDir>/../core/bundle/core.ts",
    "^@pacsarcade/variant-engine$": "<rootDir>/../variant-engine/src/index.ts",
    // stub out style & asset imports
    "\\.(css|less|sass|scss)$": "identity-obj-proxy",
  },
};

export default config;
