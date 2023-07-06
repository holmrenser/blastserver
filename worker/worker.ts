import { spawnSync } from "child_process";
import path from "path";
import { Worker, Job } from "bullmq";
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const connection = {
  host: process.env.JOBQUEUE_HOST,
  port: Number(process.env.JOBQUEUE_PORT),
};

export default async function jobProcessor(job: Job) {
  console.log(`Started job ${job.id}`);
  const { data: 
    { program, query, expectThreshold, matrix, database, gapCosts, wordSize, maxTargetSeqs }
  } = job;
  const [gapOpen,gapExtend] = gapCosts.split(',');
  const dbPath = path.join(process.env.BLASTDB_PATH || '', database);
  const numThreads = process.env.NUM_BLAST_THREADS || '4';
  const args = [
    '-db', dbPath,
    '-evalue', expectThreshold,
    '-matrix', matrix,
    '-outfmt', '16',
    '-gapopen', gapOpen,
    '-gapextend', gapExtend,
    '-word_size', wordSize,
    '-num_threads', numThreads,
    '-max_target_seqs', maxTargetSeqs
  ];
  const options = { input: query, maxBuffer: 1_000_000_000_000 };
  const result = spawnSync(program, args, options);
  // console.dir({ result }, { depth: null})
  const stderr = result.stderr.toString('utf8');
  if (stderr) throw new Error(stderr);
  const stdout = result.stdout.toString('utf8');
  await prisma.blastjob.update({
    where: {id: job.id},
    data: { 
      results: stdout,
      finished: new Date()
     }
  });
  return 'finished'
}

// HACK: extreme lock duration (1 hour) to prevent multiple workers picking up the same job 
const worker = new Worker("jobqueue", jobProcessor, { connection, lockDuration: 3_600_000 });

console.log("worker started");

worker.on("progress", (job, progress) => {
  console.log(`Progress job ${job.id}: ${progress}`);
});

worker.on("completed", (job, returnValue) => {
  console.log(`Completed job ${job.id}: ${returnValue}`);
});

worker.on("failed", async (job, err) => {
  console.warn(`Failed job ${job?.id}: ${err}`);
  await prisma.blastjob.update({
    where: {id: job?.id},
    data: { 
      err: err.message,
      finished: new Date()
    }
  })
});

worker.on("error", (err) => {
  console.warn(`Error: ${ err }`);
});