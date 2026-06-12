import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const srcDir = fileURLToPath(new URL("./src", import.meta.url));

// Integration suite: Node environment + a real Postgres (DATABASE_URL must point
// at a migrated database — CI starts one as a service container; locally it is
// loaded from .env via dotenv). Vitest runs the Prisma 7 ESM/WASM client
// natively, which next/jest's CJS transform could not.
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    // dotenv loads .env (-> .env.development) for local runs; in CI the real
    // env wins (dotenv does not override already-set vars).
    setupFiles: ["dotenv/config"],
    include: ["**/*.integration.test.{ts,tsx}"],
    exclude: ["node_modules/**", ".next/**", "worker/build/**"],
    // Real shared Postgres rows — don't run files in parallel (≈ jest --runInBand).
    fileParallelism: false,
  },
  resolve: {
    alias: [
      { find: /^(\.{1,2}\/.*)\.js$/, replacement: "$1" },
      { find: /^@\//, replacement: `${srcDir}/` },
    ],
  },
});
