import type { BlastParameters } from "../src/lib/blast/schema";
import { BLAST_QUEUE } from "../src/lib/queue.js";
import { runBlastJob } from "./processors/blast.js";
import { WorkerRuntime } from "./runtime.js";

type BlastJobData = { jobId: string; parameters: BlastParameters };

const runtime = new WorkerRuntime<BlastJobData>({
  queue: BLAST_QUEUE,
  name: "BLAST",
  process: (prisma, { jobId, parameters }) => runBlastJob(prisma, jobId, parameters),
  recordFailure: async (prisma, jobId, message) => {
    await prisma.blastjob.update({
      where: { id: jobId },
      data: { err: message, finished: new Date() },
    });
  },
});

runtime.run().catch((err) => {
  console.error("Fatal: failed to start BLAST worker", err);
  process.exit(1);
});
