import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

// Prisma 7 is "Rust-free": the client talks to Postgres through a driver
// adapter instead of a bundled query engine, so the connection string is passed
// to the adapter rather than the datasource. The dev singleton avoids exhausting
// connections across hot reloads.
declare global {
  var prisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({
    adapter,
    errorFormat: "pretty",
    log: ["info", "warn", "error"],
  });
}

const prisma = global.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}

export default prisma;
