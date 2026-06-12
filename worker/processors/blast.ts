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

  const {
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
    lcaseMasking,
  } = data;

  if (typeof query !== "string" || query.length === 0) {
    throw new Error("No query provided");
  }
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

  // Protein searches (blastp/blastx/tblastn) carry a scoring matrix; nucleotide
  // ones don't. `"matrix" in data` narrows the discriminated union structurally.
  if ("matrix" in data) {
    args.push("-matrix", data.matrix, "-word_size", String(data.wordSize));
  }

  if (taxids && taxids.length) {
    const allTaxids = (
      await prisma.taxonomy.findMany({
        where: { ancestors: { hasSome: taxids } },
        select: { id: true },
      })
    ).map(({ id }) => id);
    tmpFile = path.join(
      tmpdir(),
      `blastserver.${Crypto.randomBytes(16).toString("hex")}.tmp`
    );

    try {
      await fs.promises.writeFile(tmpFile, allTaxids.join("\n"));
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
    if (tmpFile) {
      await fs.promises.unlink(tmpFile).catch(() => {});
    }
  }
}
