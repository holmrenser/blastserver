import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const srcDir = fileURLToPath(new URL("./src", import.meta.url));

// Smoke suite: runs a REAL blast+ binary against the committed blastdb/landmark
// database and pipes its output through the parser. Needs blast+ on PATH and the
// database on disk, so it only runs deliberately (RUN_BLAST_SMOKE=1) inside the
// worker Docker image — never in the default `npm test` / `npm run test:integration`.
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["dotenv/config"],
    include: ["**/*.smoke.test.{ts,tsx}"],
    exclude: ["node_modules/**", ".next/**", "worker/build/**"],
  },
  resolve: {
    alias: [
      { find: /^(\.{1,2}\/.*)\.js$/, replacement: "$1" },
      { find: /^@\//, replacement: `${srcDir}/` },
    ],
  },
});
