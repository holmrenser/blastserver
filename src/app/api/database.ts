import type { PrismaClient } from "@/generated/prisma/client";
import { createPrismaClient } from "@/lib/prisma";

// The shared factory (src/lib/prisma.ts) builds the Prisma 7 "Rust-free" client
// via the pg driver adapter. Here we add the dev singleton that avoids
// exhausting connections across Next hot reloads.
declare global {
  var prisma: PrismaClient | undefined;
}

const prisma = global.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}

export default prisma;
