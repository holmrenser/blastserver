import { DOWNLOAD_QUEUE } from "../src/lib/queue.js";
import { runDownloadJob } from "./processors/download.js";
import { WorkerRuntime } from "./runtime.js";

type DownloadJobData = {
  jobId: string;
  sequenceIds: string[];
  database: string;
};

const runtime = new WorkerRuntime<DownloadJobData>({
  queue: DOWNLOAD_QUEUE,
  name: "Download",
  process: (prisma, { jobId, sequenceIds, database }) =>
    runDownloadJob(prisma, jobId, { sequenceIds, database }),
  recordFailure: async (prisma, jobId, message) => {
    await prisma.download.update({
      where: { id: jobId },
      data: { err: message, finished: new Date() },
    });
  },
});

runtime.run().catch((err) => {
  console.error("Fatal: failed to start download worker", err);
  process.exit(1);
});
