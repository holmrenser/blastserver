import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getBlastJob } from "@/lib/blastJob";
import type { BlastJobResults } from "@/lib/blastJob";

export type { BlastJobResults };

export const dynamic = "force-dynamic";

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ jobId: string[] }> }
): Promise<NextResponse<BlastJobResults>> {
  const { jobId } = await params;
  console.log(`Requested BLAST job ${jobId}`);

  const id = jobId?.[0];
  if (!id) {
    return new NextResponse("Missing job id", { status: 400 });
  }

  let job: BlastJobResults | null;
  try {
    job = await getBlastJob(id);
  } catch (err) {
    console.error((err as Error).message);
    return new NextResponse((err as Error).message, { status: 500 });
  }
  if (!job) {
    return new NextResponse("Job not found", { status: 404 });
  }
  return NextResponse.json(job);
}
