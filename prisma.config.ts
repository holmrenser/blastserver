// Prisma 7 reads CLI configuration (schema location, migrations, datasource)
// from this file instead of the `package.json#prisma` block or implicit env
// loading. `.env` (a symlink to `.env.development`) is loaded explicitly via
// dotenv for local CLI runs; in containers DATABASE_URL is injected through the
// environment, so dotenv is a no-op there.
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Read directly (not prisma's strict `env()`, which throws at config-load
    // time if unset) so `prisma generate` works in the Docker build where no
    // DATABASE_URL is present; `migrate deploy` gets the real value at runtime.
    url: process.env.DATABASE_URL,
  },
});
