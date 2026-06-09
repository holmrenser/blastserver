import { NextResponse } from "next/server";

import prisma from "../database";

export const dynamic = "force-dynamic";

/**
 * Reports how the job queue is doing. Counts are derived directly from the
 * `blastjob` / `download` tables (the source of truth the UI already polls),
 * using the `submitted`/`started`/`finished`/`err` timestamps, so this read
 * path doesn't depend on the queue backend:
 *   waiting   = submitted, not yet picked up
 *   active    = picked up, not finished
 *   completed = finished without error
 *   failed    = errored
 */
async function countStates(model: {
  count: (args: { where: object }) => Promise<number>;
}) {
  const [waiting, active, completed, failed] = await Promise.all([
    model.count({ where: { started: null, finished: null, err: null } }),
    model.count({ where: { started: { not: null }, finished: null, err: null } }),
    model.count({ where: { finished: { not: null }, err: null } }),
    model.count({ where: { err: { not: null } } }),
  ]);
  return { waiting, active, completed, failed };
}

export async function GET() {
  const [blast, download] = await Promise.all([
    countStates(prisma.blastjob),
    countStates(prisma.download),
  ]);

  return NextResponse.json({
    waiting: blast.waiting + download.waiting,
    active: blast.active + download.active,
    completed: blast.completed + download.completed,
    failed: blast.failed + download.failed,
  });
}
