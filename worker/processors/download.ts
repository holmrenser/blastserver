import { spawnSync } from "child_process";
import path from "path";
import Crypto from "crypto";
import { tmpdir } from "os";
import fs from "fs";
import { gzipSync } from "zlib";
import type { PrismaClient } from "@prisma/client";

import { DB_NAMES } from "../../src/lib/blast/constants.js";
import { MAX_BUFFER } from "../limits.js";

export type DownloadJobData = { sequenceIds: string[]; database: string };

/**
 * Extracts the requested sequences with blastdbcmd and writes the gzipped FASTA
 * to the `download` row identified by `jobId` — or throws on failure. Free of
 * any queue-backend coupling so the worker bootstrap and tests can drive it.
 */
export async function runDownloadJob(
  prisma: PrismaClient,
  jobId: string,
  data: DownloadJobData
): Promise<void> {
  console.log(`Started download job ${jobId}`);
  await prisma.download.update({
    where: { id: jobId },
    data: { started: new Date() },
  });

  const { sequenceIds, database } = data;

  // Defense in depth: never read an arbitrary path even if a job reaches the
  // queue directly.
  if (!DB_NAMES.has(database)) {
    throw new Error(`Refusing to use unknown database: ${database}`);
  }

  const tmpFile = path.join(
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
      console.warn(`Download job ${jobId} stderr: ${stderr}`);
    }
    const stdout = result.stdout.toString("utf8");
    const compressedOutput = gzipSync(stdout);

    await prisma.download.update({
      where: { id: jobId },
      data: {
        results: compressedOutput,
        finished: new Date(),
      },
    });
  } finally {
    await fs.promises.unlink(tmpFile).catch(() => {});
  }
}
