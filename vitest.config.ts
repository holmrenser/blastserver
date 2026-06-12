import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const srcDir = fileURLToPath(new URL("./src", import.meta.url));

// Unit suite: jsdom environment, fast pure-logic + store tests. Integration
// tests (Node env + real Postgres) live in vitest.integration.config.ts.
export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["**/*.integration.test.*", "node_modules/**", ".next/**"],
  },
  resolve: {
    alias: [
      // ESM ".js" import specifiers resolve to their ".ts" sources (the Prisma 7
      // client and worker code use them); strip the extension like the old jest
      // moduleNameMapper did. Bare specifiers are untouched.
      { find: /^(\.{1,2}\/.*)\.js$/, replacement: "$1" },
      { find: /^@\//, replacement: `${srcDir}/` },
    ],
  },
});
