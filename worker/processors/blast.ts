import { spawnSync } from "child_process";
import path from "path";
import Crypto from "crypto";
import { tmpdir } from "os";
import fs from "fs";
import type { PrismaClient } from "../../src/generated/prisma/client.js";

import type { BlastParameters } from "../../src/lib/blast/schema";
import {
  isAllowedDatabase,
  isAllowedFlavour,
} from "../../src/lib/blast/constants.js";
import { MAX_BUFFER } from "../limits.js";

/** Resolved, side-effecting context the pure arg builder can't derive itself. */
export interface BlastArgsContext {
  /** Absolute path to the BLAST database (APP_BLAST_DB_PATH + db name). */
  dbPath: string;
  /** `-num_threads` value. */
  numThreads: string;
  /**
   * Path to the taxid list file the caller wrote (the resolved, ancestor-expanded
   * taxids), or null when no taxonomy filter was requested.
   */
  taxidListFile: string | null;
}

/**
 * Pure translation of validated BLAST parameters into a `blast+` argument list.
 * Kept free of Postgres / fs / spawn so it can be unit-tested directly (see
 * buildBlastArgs.test.ts); `runBlastJob` resolves the side-effecting bits
 * (db path, taxid file) and passes them in via `ctx`.
 *
 * Note: `-no_taxid_expansion` is unconditional and is only valid on BLAST+ ≥2.16
 * (added with the 2.16 taxonomy options); the pinned binary is 2.17, so there is
 * no version guard. If the binary is ever downgraded below 2.16 this flag breaks.
 */
export function buildBlastArgs(
  data: BlastParameters,
  ctx: BlastArgsContext
): string[] {
  const {
    flavour,
    query,
    expectThreshold,
    gapCosts,
    maxTargetSeqs,
    queryTo,
    queryFrom,
    excludeTaxids,
    lcaseMasking,
  } = data;

  const [gapOpen, gapExtend] = gapCosts.split(",");
  const args: string[] = [
    "-db",
    ctx.dbPath,
    "-evalue",
    String(expectThreshold),
    "-outfmt",
    "16",
    "-num_threads",
    ctx.numThreads,
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

  // Protein searches (blastp/blastx/tblastn) carry a scoring matrix; nucleotide
  // ones don't. `"matrix" in data` narrows the discriminated union structurally.
  if ("matrix" in data) {
    args.push("-matrix", data.matrix, "-word_size", String(data.wordSize));
  }

  if (ctx.taxidListFile) {
    if (excludeTaxids) {
      args.push("-negative_taxidlist", ctx.taxidListFile, "-no_taxid_expansion");
    } else {
      args.push("-taxidlist", ctx.taxidListFile, "-no_taxid_expansion");
    }
  }

  return args;
}

/**
 * Runs a single BLAST job: marks the row started, validates the request
 * (defense in depth — the submit route already validated, but a job must never
 * run an arbitrary binary or read an arbitrary path even if it reaches the queue
 * directly), builds the BLAST command line, runs the binary, and writes the XML
 * result to the `blastjob` row identified by `jobId` — or throws on failure.
 *
 * Kept free of any queue-backend coupling so the worker bootstrap and the
 * integration test can both drive it directly.
 */
export async function runBlastJob(
  prisma: PrismaClient,
  jobId: string,
  data: BlastParameters
): Promise<void> {
  console.log(`Started BLAST job ${jobId}`);
  await prisma.blastjob.update({
    where: { id: jobId },
    data: { started: new Date() },
  });

  const { flavour, program, query, database, taxids } = data;

  if (typeof query !== "string" || query.length === 0) {
    throw new Error("No query provided");
  }
  if (!isAllowedFlavour(flavour)) {
    throw new Error(`Refusing to run unknown BLAST flavour: ${flavour}`);
  }
  if (!isAllowedDatabase(flavour, database)) {
    throw new Error(`Refusing to use unknown database: ${database}`);
  }

  const dbPath = path.join(process.env.APP_BLAST_DB_PATH || "", database);
  const numThreads = process.env.NUM_BLAST_THREADS || "4";

  // Resolve the taxonomy filter (if any) to a temp file of ancestor-expanded
  // taxids; the pure arg builder only needs its path.
  let taxidListFile: string | null = null;
  if (taxids && taxids.length) {
    const allTaxids = (
      await prisma.taxonomy.findMany({
        where: { ancestors: { hasSome: taxids } },
        select: { id: true },
      })
    ).map(({ id }) => id);
    taxidListFile = path.join(
      tmpdir(),
      `blastserver.${Crypto.randomBytes(16).toString("hex")}.tmp`
    );

    try {
      await fs.promises.writeFile(taxidListFile, allTaxids.join("\n"));
    } catch (err) {
      throw new Error(`Writing tmp file failed: ${err}`);
    }
  }

  const args = buildBlastArgs(data, { dbPath, numThreads, taxidListFile });

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
      console.warn(`BLAST job ${jobId} stderr: ${stderr}`);
    }
    const stdout = result.stdout
      .toString("utf8")
      .replace('encoding="US-ASCII"', 'encoding="UTF8"');

    await prisma.blastjob.update({
      where: { id: jobId },
      data: {
        results: stdout,
        finished: new Date(),
      },
    });
  } finally {
    if (taxidListFile) {
      await fs.promises.unlink(taxidListFile).catch(() => {});
    }
  }
}
