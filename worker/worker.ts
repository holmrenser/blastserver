import { spawnSync } from "child_process";
import path from "path";
import { Worker, Job } from "bullmq";
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config()

const prisma = new PrismaClient();

const connection = {
  host: process.env.JOBQUEUE_HOST,
  port: Number(process.env.JOBQUEUE_PORT),
};

export default async function jobProcessor(job: Job) {
  console.log(`Started job ${job.id}`);
  const { data: { program, query, expectThreshold, matrix } } = job;
  const dbPath = path.join(process.env.BLASTDB_PATH || '', 'landmark')
  const args = [
    '-db', dbPath,
    '-evalue', expectThreshold,
    '-matrix', matrix,
    '-outfmt', '16',
  ];
  const options = { input: query };
  const result = spawnSync(program, args, options);
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

const worker = new Worker("jobqueue", jobProcessor, { connection });

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