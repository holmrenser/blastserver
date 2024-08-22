import { spawnSync } from "child_process";
import path from "path";
import { Worker, Job } from "bullmq";
import { PrismaClient } from '@prisma/client';
import Crypto from 'crypto';
import { tmpdir } from 'os';
import Path from 'path';
import fs from 'fs';
import { gzipSync } from 'zlib';


const prisma = new PrismaClient();

const connection = {
  host: process.env.JOBQUEUE_HOST,
  port: Number(process.env.JOBQUEUE_PORT),
};

async function downloadJobProcessor(job: Job) {
  console.log(`Started download job ${job.id}`);
  const { data: { sequenceIds, database }}: { data: { sequenceIds: string[], database: string }} = job;

  const tmpFile = Path.join(tmpdir(), `blastserver.${Crypto.randomBytes(16).toString('hex')}.tmp`)
  const seqidString = sequenceIds.join('\n')
  try {
    await fs.promises.writeFile(tmpFile, seqidString);
  } catch (err) {
    throw new Error(`Writing tmp file failed: ${err}`)
  }

  const dbPath = path.join(process.env.APP_BLAST_DB_PATH || '', database);

  const args = [
    '-db', dbPath,
    '-entry_batch', tmpFile
  ]

  // Very large max buffer so we capture all BLAST output
  const options = { maxBuffer: 1_000_000_000_000 };

  console.log(`Running 'blastdmcmd ${args.join(' ')}'`)

  const result = spawnSync('blastdbcmd', args, options);
  const stderr = result.stderr.toString('utf8');
  if (stderr) throw new Error(stderr);
  const stdout = result.stdout.toString('utf8');

  const compressedOutput = gzipSync(stdout);

  await prisma.download.update({
    where: {id: job.id},
    data: { 
      results: compressedOutput,
      finished: new Date()
     }
  });
  return 'finished'
}

// HACK: extreme lock duration (2 hours) to prevent multiple workers picking up the same job 
const downloadWorker = new Worker("downloadQueue", downloadJobProcessor, { connection, lockDuration: 7_200_000 });

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
    where: {id: job?.id},
    data: { 
      err: err.message,
      finished: new Date()
    }
  })
});

downloadWorker.on("error", (err) => {
  console.warn(`Download job error: ${ err }`);
});