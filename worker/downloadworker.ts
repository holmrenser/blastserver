import { spawnSync } from "child_process";
import path from "path";
import { Worker, Job } from "bullmq";
import { PrismaClient } from "@prisma/client";
import Crypto from "crypto";
import { tmpdir } from "os";
import Path from "path";
import fs from "fs";
import { gzipSync } from "zlib";

import { DB_NAMES } from "../src/lib/blast/constants.js";
import { setupWorkerRuntime, MAX_BUFFER, LOCK_DURATION } from "./runtime.js";

const prisma = new PrismaClient();

const connection = {
  host: process.env.JOBQUEUE_HOST,
  port: Number(process.env.JOBQUEUE_PORT),
};

async function downloadJobProcessor(job: Job) {
  console.log(`Started download job ${job.id}`);
  const {
    data: { sequenceIds, database },
  }: { data: { sequenceIds: string[]; database: string } } = job;

  // Defense in depth: never read an arbitrary path even if a job reaches the
  // queue directly.
  if (!DB_NAMES.has(database)) {
    throw new Error(`Refusing to use unknown database: ${database}`);
  }

  const tmpFile = Path.join(
    tmpdir(),
    `blastserver.${Crypto.randomBytes(16).toString("hex")}.tmp`
  );

  try {
    const seqidString = sequenceIds.join("\n");
    try {
      await fs.promises.writeFile(tmpFile, seqidString);
    } catch (err) {
      throw new Error(`Writing tmp file failed: ${err}`);
    }

    const dbPath = path.join(process.env.APP_BLAST_DB_PATH || "", database);
    const args = ["-db", dbPath, "-entry_batch", tmpFile];

    // Bounded output buffer (configurable via BLAST_MAX_BUFFER).
    const options = { maxBuffer: MAX_BUFFER };

    console.log(`Running 'blastdbcmd ${args.join(" ")}'`);

    const result = spawnSync("blastdbcmd", args, options);
    if (result.error) {
      throw result.error;
    }
    if (result.status !== 0) {
      throw new Error(
        result.stderr?.toString("utf8") ||
          `blastdbcmd exited with status ${result.status}`
      );
    }
    const stderr = result.stderr.toString("utf8");
    if (stderr) {
      console.warn(`Download job ${job.id} stderr: ${stderr}`);
    }
    const stdout = result.stdout.toString("utf8");
    const compressedOutput = gzipSync(stdout);

    await prisma.download.update({
      where: { id: job.id },
      data: {
        results: compressedOutput,
        finished: new Date(),
      },
    });
    return "finished";
  } finally {
    await fs.promises.unlink(tmpFile).catch(() => {});
  }
}

const downloadWorker = new Worker("downloadQueue", downloadJobProcessor, {
  connection,
  // BullMQ auto-renews the lock while the worker is alive, so this only bounds
  // how long a crashed/stalled job stays locked before it can be retried.
  lockDuration: LOCK_DURATION,
});

console.log("Download worker started");

downloadWorker.on("progress", (job, progress) => {
  console.log(`Progress download job ${job.id}: ${progress}`);
});

downloadWorker.on("completed", (job, returnValue) => {
  console.log(`Completed download job ${job.id}: ${returnValue}`);
});

downloadWorker.on("failed", async (job, err) => {
  console.warn(`Failed download job ${job?.id}: ${err}`);
  await prisma.download.update({
    where: { id: job?.id },
    data: {
      err: err.message,
      finished: new Date(),
    },
  });
});

// Error logging + health probes + graceful drain on SIGTERM/SIGINT.
setupWorkerRuntime(downloadWorker, prisma, "Download");
