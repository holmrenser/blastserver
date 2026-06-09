import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

/** @type {import('jest').Config} */
const config = {
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testEnvironment: "jest-environment-jsdom",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  modulePathIgnorePatterns: ["<rootDir>/.next/", "<rootDir>/worker/build/"],
  // Integration tests (Node env, real Postgres) run via jest.integration.config.mjs.
  testPathIgnorePatterns: ["/node_modules/", "\\.integration\\.test\\."],
};

export default createJestConfig(config);
