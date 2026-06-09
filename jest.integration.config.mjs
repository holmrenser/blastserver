import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

/**
 * Integration tests: Node environment + a real Postgres (DATABASE_URL must point
 * at a migrated database — CI starts one as a service container). Runs files
 * named *.integration.test.ts, separately from the jsdom unit suite.
 *
 * @type {import('jest').Config}
 */
const config = {
  testEnvironment: "node",
  testMatch: ["<rootDir>/**/*.integration.test.ts"],
  moduleNameMapper: {
    // Worker code uses ESM-style ".js" import specifiers that resolve to ".ts"
    // sources; strip the extension so Jest finds them.
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  modulePathIgnorePatterns: ["<rootDir>/.next/", "<rootDir>/worker/build/"],
};

export default createJestConfig(config);
