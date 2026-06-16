import type { blastjob } from "@/generated/prisma/client";

import prisma from "@/app/api/database";
import formatResults from "@/app/api/[...jobId]/formatResults";
import type { FormattedBlastResults } from "@/app/api/[...jobId]/formatResults";

export type BlastJobResults = Omit<blastjob, "results"> & {
  results: FormattedBlastResults | null;
};

// Shared source of truth for reading a job + formatting its results. Used by the
// results Server Component (src/app/results/[jobId]/page.tsx) and the JSON API
// route (src/app/api/[...jobId]/route.ts).
export async function getBlastJob(id: string): Promise<BlastJobResults | null> {
  const job = await prisma.blastjob.findFirst({ where: { id } });
  if (!job) return null;
  const results = job.results ? await formatResults(job.results) : null;
  return { ...job, results };
}
