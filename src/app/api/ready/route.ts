import { NextResponse } from "next/server";

import prisma from "../database";
import { blastQueue } from "../queue";

export const dynamic = "force-dynamic";

// Readiness probe: only take traffic once both Postgres and Redis are reachable.
export async function GET() {
  const checks: Record<string, boolean> = {};

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = true;
  } catch {
    checks.database = false;
  }

  try {
    // BullMQ's IRedisClient type omits ping(); the underlying ioredis client has it.
    const client = (await blastQueue.client) as unknown as {
      ping: () => Promise<string>;
    };
    await client.ping();
    checks.redis = true;
  } catch {
    checks.redis = false;
  }

  const ready = Object.values(checks).every(Boolean);
  return NextResponse.json(
    { status: ready ? "ready" : "not ready", checks },
    { status: ready ? 200 : 503 }
  );
}
