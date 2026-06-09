// Entry point for the standalone Next.js server.
//
// Schema migrations and taxonomy seeding run as a separate one-shot step
// (scripts/migrate-and-seed.ts, executed by the `migrate` service in Compose)
// — never on every app boot. This keeps the app
// container free of write-schema privileges and avoids N replicas racing on
// migrations at startup.
import "./.next/standalone/server.js";
