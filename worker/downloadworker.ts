import { PrismaClient } from "@prisma/client";

import { DOWNLOAD_QUEUE } from "../src/lib/queue.js";
import { runDownloadJob } from "./processors/download.js";
import { setupWorkerRuntime, startWorkerBoss } from "./runtime.js";

type DownloadJobData = {
  jobId: string;
  sequenceIds: string[];
  database: string;
};

const prisma = new PrismaClient();

async function main() {
  const boss = await startWorkerBoss(DOWNLOAD_QUEUE);

  await boss.work<DownloadJobData>(
    DOWNLOAD_QUEUE,
    { includeMetadata: true },
    async ([job]) => {
      const { jobId, sequenceIds, database } = job.data;
      try {
        await runDownloadJob(prisma, jobId, { sequenceIds, database });
        console.log(`Completed download job ${jobId}`);
      } catch (err) {
        if (job.retryCount >= job.retryLimit) {
          console.warn(`Failed download job ${jobId} (final attempt): ${err}`);
          await prisma.download.update({
            where: { id: jobId },
            data: {
              err: err instanceof Error ? err.message : String(err),
              finished: new Date(),
            },
          });
        } else {
          console.warn(
            `Download job ${jobId} attempt ${job.retryCount + 1} failed, will retry: ${err}`
          );
        }
        throw err; // let pg-boss record the failed attempt and retry if any remain
      }
    }
  );

  console.log("Download worker started");
  setupWorkerRuntime(boss, prisma, "Download");
}

main().catch((err) => {
  console.error("Fatal: failed to start download worker", err);
  process.exit(1);
});
