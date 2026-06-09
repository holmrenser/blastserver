import hash from "object-hash";
import { NextResponse, NextRequest } from "next/server";

import { blastQueue } from "../queue";
import prisma from "../database";
import { validateBlastParameters } from "@/lib/blast/schema";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = validateBlastParameters(body);
  if (!validation.success) {
    return NextResponse.json(
      {
        error: "Invalid BLAST parameters",
        issues: validation.error.flatten(),
      },
      { status: 400 }
    );
  }

  const parameters = validation.data;
  const jobId = hash(parameters).slice(0, 10);

  try {
    await prisma.$transaction(async (tx) => {
      const existingJob = await tx.blastjob.findFirst({ where: { id: jobId } });
      if (existingJob) {
        console.log(`Found existing BLAST job: ${existingJob.id}`);
        return;
      }
      await tx.blastjob.create({
        data: { id: jobId, parameters, submitted: new Date() },
      });
      await blastQueue.add("blast", parameters, { jobId });
    });
  } catch (error) {
    console.error(`Failed to submit BLAST job ${jobId}:`, error);
    return NextResponse.json({ error: "Failed to submit job" }, { status: 500 });
  }

  return NextResponse.json({ jobId });
}
