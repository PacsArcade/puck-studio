import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest/presets/js-with-ts-esm", // TS + ESM (matches the repo)
  testEnvironment: "node", // pure engine — no DOM anywhere

  extensionsToTreatAsEsm: [".ts"],

  transform: {
    "^.+\\.[tj]sx?$": ["ts-jest", { useESM: true }],
  },

  moduleNameMapper: {
    // Resolve sibling workspace packages from source — CI runs tests
    // before any build, so nothing has a dist yet.
    "^@frens-earth/puck-config/tokens$":
      "<rootDir>/../puck-config/src/tokens/index.ts",
    "^@frens-earth/variant-engine$": "<rootDir>/../variant-engine/src/index.ts",
  },
};

export default config;
