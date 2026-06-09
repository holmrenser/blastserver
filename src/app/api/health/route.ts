import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Liveness probe: the process is up and serving. Intentionally does NOT touch
// Postgres (that belongs in /api/ready) so a transient dependency blip doesn't
// make a health check kill an otherwise-healthy container.
export function GET() {
  return NextResponse.json({ status: "ok" });
}
