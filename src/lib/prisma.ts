// Shared Prisma client factory used by both the Next app and the pg-boss
// workers, so the "Rust-free" Prisma 7 bootstrap (a @prisma/adapter-pg driver
// adapter wired to a PrismaClient) lives in exactly one place.
//
// Like src/lib/queue.ts, this is imported two ways: the app via the "@/" alias
// (@/lib/prisma) and the tsc-compiled workers via a relative path
// (../src/lib/prisma.js). For that to resolve under both builds the generated
// client is imported relatively with an explicit .js extension — the worker's
// `moduleResolution: node` requires it, and Next bundles it without issue (the
// generated client uses the same `.js` specifiers internally).
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../generated/prisma/client.js";

/**
 * Creates a fresh PrismaClient backed by the pg driver adapter. Callers manage
 * lifetime: the app memoises a dev singleton (see src/app/api/database.ts) to
 * survive hot reloads, while each long-lived worker process creates one.
 */
export function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({
    adapter,
    errorFormat: "pretty",
    log: ["info", "warn", "error"],
  });
}
