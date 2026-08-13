import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest/presets/js-with-ts-esm", // TS + ESM (matches the repo)
  testEnvironment: "node", // pure engine — no DOM anywhere

  extensionsToTreatAsEsm: [".ts"],

  transform: {
    "^.+\\.[tj]sx?$": ["ts-jest", { useESM: true }],
  },
};

export default config;
