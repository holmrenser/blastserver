import { NextResponse } from "next/server";

import prisma from "../database";

export const dynamic = "force-dynamic";

// Readiness probe: only take traffic once Postgres is reachable. The job queue
// now lives in Postgres too (pg-boss), so a single database check covers both
// persistence and the queue backend.
export async function GET() {
  const checks: Record<string, boolean> = {};

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = true;
  } catch {
    checks.database = false;
  }

  const ready = Object.values(checks).every(Boolean);
  return NextResponse.json(
    { status: ready ? "ready" : "not ready", checks },
    { status: ready ? 200 : 503 }
  );
}
