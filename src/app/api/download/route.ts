import hash from "object-hash";
import { NextResponse, NextRequest } from "next/server";

import { getBoss } from "../queue";
import prisma from "../database";
import { DB_NAMES } from "@/lib/blast/schema";
import { DOWNLOAD_QUEUE, JOB_EXPIRE_SECONDS, JOB_RETRY_LIMIT } from "@/lib/queue";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let params: unknown;
  try {
    params = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { sequenceIds, database } = (params ?? {}) as {
    sequenceIds?: unknown;
    database?: unknown;
  };

  if (
    !Array.isArray(sequenceIds) ||
    !sequenceIds.every((id) => typeof id === "string")
  ) {
    return NextResponse.json(
      { error: "Must provide an array of sequence identifiers" },
      { status: 400 }
    );
  }
  if (sequenceIds.length === 0) {
    return NextResponse.json(
      { error: "Must provide at least one sequence identifier" },
      { status: 400 }
    );
  }
  if (sequenceIds.length > 500) {
    return NextResponse.json(
      { error: "Cannot download more than 500 sequences" },
      { status: 400 }
    );
  }
  if (typeof database !== "string" || !DB_NAMES.has(database)) {
    return NextResponse.json(
      { error: "Unknown database" },
      { status: 400 }
    );
  }

  const sortedIds = [...sequenceIds].sort();
  const jobId = hash(sortedIds).slice(0, 10);
  console.log(`Download request ${jobId}`);

  try {
    const boss = await getBoss();
    await prisma.$transaction(async (tx) => {
      const existingJob = await tx.download.findFirst({ where: { id: jobId } });
      if (existingJob) {
        console.log(`Found existing download job: ${existingJob.id}`);
        return;
      }
      await tx.download.create({
        data: { id: jobId, sequenceIds: sortedIds, submitted: new Date() },
      });
      await boss.send(
        DOWNLOAD_QUEUE,
        { jobId, sequenceIds: sortedIds, database },
        {
          singletonKey: jobId,
          retryLimit: JOB_RETRY_LIMIT,
          retryBackoff: true,
          expireInSeconds: JOB_EXPIRE_SECONDS,
        }
      );
    });
  } catch (error) {
    console.error(`Failed to submit download job ${jobId}:`, error);
    return NextResponse.json(
      { error: "Failed to submit download" },
      { status: 500 }
    );
  }

  return NextResponse.json({ jobId });
}
