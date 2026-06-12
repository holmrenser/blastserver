import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client.js";
import type { BlastParameters } from "../src/lib/blast/schema";
import { BLAST_QUEUE } from "../src/lib/queue.js";
import { runBlastJob } from "./processors/blast.js";
import { setupWorkerRuntime, startWorkerBoss } from "./runtime.js";

type BlastJobData = { jobId: string; parameters: BlastParameters };

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const boss = await startWorkerBoss(BLAST_QUEUE);

  await boss.work<BlastJobData>(
    BLAST_QUEUE,
    { includeMetadata: true },
    async ([job]) => {
      const { jobId, parameters } = job.data;
      try {
        await runBlastJob(prisma, jobId, parameters);
        console.log(`Completed BLAST job ${jobId}`);
      } catch (err) {
        // Only persist the error once retries are exhausted, so a job that will
        // still be retried isn't prematurely shown as failed in the UI.
        if (job.retryCount >= job.retryLimit) {
          console.warn(`Failed BLAST job ${jobId} (final attempt): ${err}`);
          await prisma.blastjob.update({
            where: { id: jobId },
            data: {
              err: err instanceof Error ? err.message : String(err),
              finished: new Date(),
            },
          });
        } else {
          console.warn(
            `BLAST job ${jobId} attempt ${job.retryCount + 1} failed, will retry: ${err}`
          );
        }
        throw err; // let pg-boss record the failed attempt and retry if any remain
      }
    }
  );

  console.log("BLAST worker started");
  setupWorkerRuntime(boss, prisma, "BLAST");
}

main().catch((err) => {
  console.error("Fatal: failed to start BLAST worker", err);
  process.exit(1);
});
