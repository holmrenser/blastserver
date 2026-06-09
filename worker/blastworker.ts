import { spawnSync } from "child_process";
import path from "path";
import { Worker, Job } from "bullmq";
import { PrismaClient } from "@prisma/client";
import Crypto from "crypto";
import { tmpdir } from "os";
import Path from "path";
import fs from "fs";

import type { BlastParameters } from "../src/lib/blast/schema";
import {
  isAllowedDatabase,
  isAllowedFlavour,
} from "../src/lib/blast/constants.js";
import { setupWorkerRuntime, MAX_BUFFER, LOCK_DURATION } from "./runtime.js";

const prisma = new PrismaClient();

async function blastJobProcessor(job: Job) {
  console.log(`Started BLAST job ${job.id}`);
  const {
    data: {
      flavour,
      program,
      query,
      expectThreshold,
      database,
      gapCosts,
      maxTargetSeqs,
      queryTo,
      queryFrom,
      taxids,
      excludeTaxids,
      //filterLowComplexity,
      lcaseMasking,
      // softMasking,
      // shortQueries,
    },
  }: { data: BlastParameters } = job;

  if (typeof query !== "string" || query.length === 0) {
    throw new Error("No query provided");
  }
  // Defense in depth: the submit route validates parameters, but the worker
  // must never run an arbitrary binary or read an arbitrary path even if a job
  // reaches the queue directly.
  if (!isAllowedFlavour(flavour)) {
    throw new Error(`Refusing to run unknown BLAST flavour: ${flavour}`);
  }
  if (!isAllowedDatabase(flavour, database)) {
    throw new Error(`Refusing to use unknown database: ${database}`);
  }

  const [gapOpen, gapExtend] = gapCosts.split(",");
  const dbPath = path.join(process.env.APP_BLAST_DB_PATH || "", database);
  let tmpFile: string | null = null;
  const numThreads = process.env.NUM_BLAST_THREADS || "4";
  const args: string[] = [
    "-db",
    dbPath,
    "-evalue",
    String(expectThreshold),
    "-outfmt",
    "16",
    "-num_threads",
    numThreads,
    "-max_target_seqs",
    String(maxTargetSeqs),
    "-query_loc",
    `${queryFrom || 1}-${queryTo || query.length}`,
  ];

  if (flavour !== "tblastx") {
    args.push("-gapopen", gapOpen, "-gapextend", gapExtend);
  }

  if (lcaseMasking) {
    args.push("-lcase_masking");
  }

  if (flavour === "blastp" || flavour === "blastx" || flavour === "tblastn") {
    const {
      data: { matrix, wordSize /*compositionalAdjustment*/ },
    } = job;
    args.push("-matrix", matrix, "-word_size", String(wordSize));
  }

  if (taxids && taxids.length) {
    const allTaxids = (
      await prisma.taxonomy.findMany({
        where: { ancestors: { hasSome: taxids } },
        select: { id: true },
      })
    ).map(({ id }) => id);
    tmpFile = Path.join(
      tmpdir(),
      `blastserver.${Crypto.randomBytes(16).toString("hex")}.tmp`
    );
    const taxidString = allTaxids.join("\n");

    try {
      await fs.promises.writeFile(tmpFile, taxidString);
    } catch (err) {
      throw new Error(`Writing tmp file failed: ${err}`);
    }
    if (excludeTaxids) {
      args.push("-negative_taxidlist", tmpFile, "-no_taxid_expansion");
    } else {
      args.push("-taxidlist", tmpFile, "-no_taxid_expansion");
    }
  }

  // Bounded output buffer (configurable via BLAST_MAX_BUFFER) so a single job
  // can't try to buffer unbounded output into memory.
  const options = { input: query, maxBuffer: MAX_BUFFER };

  console.log(`Running '${program} ${args.join(" ")}'`);

  try {
    const result = spawnSync(flavour, args, options);

    if (result.error) {
      throw result.error;
    }
    if (result.status !== 0) {
      throw new Error(
        result.stderr?.toString("utf8") ||
          `BLAST exited with status ${result.status}`
      );
    }
    // BLAST writes non-fatal warnings to stderr while exiting 0; log, don't fail.
    const stderr = result.stderr.toString("utf8");
    if (stderr) {
      console.warn(`BLAST job ${job.id} stderr: ${stderr}`);
    }
    const stdout = result.stdout
      .toString("utf8")
      .replace('encoding="US-ASCII"', 'encoding="UTF8"');

    await prisma.blastjob.update({
      where: { id: job.id },
      data: {
        results: stdout,
        finished: new Date(),
      },
    });
    return "finished";
  } finally {
    if (tmpFile) {
      await fs.promises.unlink(tmpFile).catch(() => {});
    }
  }
}

const blastWorker = new Worker("blastQueue", blastJobProcessor, {
  connection: {
    host: process.env.JOBQUEUE_HOST,
    port: Number(process.env.JOBQUEUE_PORT),
  },
  // BullMQ auto-renews the lock while the worker is alive, so this only bounds
  // how long a crashed/stalled job stays locked before it can be retried.
  lockDuration: LOCK_DURATION,
});

console.log("BLAST worker started");

blastWorker.on("progress", (job, progress) => {
  console.log(`Progress BLAST job ${job.id}: ${progress}`);
});

blastWorker.on("completed", (job, returnValue) => {
  console.log(`Completed BLAST job ${job.id}: ${returnValue}`);
});

blastWorker.on("failed", async (job, err) => {
  console.warn(`Failed BLAST job ${job?.id}: ${err}`);
  await prisma.blastjob.update({
    where: { id: job?.id },
    data: {
      err: err.message,
      finished: new Date(),
    },
  });
});

// Error logging + health probes + graceful drain on SIGTERM/SIGINT.
setupWorkerRuntime(blastWorker, prisma, "BLAST");
