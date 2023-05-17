'use server';

import hash from 'object-hash';
import { readFile } from 'fs/promises';
import { Worker, Job } from "bullmq";
import { NextResponse } from 'next/server';

import { queue, connection } from './queue';
import prisma from './database';


async function jobProcessor(job: Job) {
  console.log(`Processing job ${job.id}`);
  const results = await readFile('/Users/rensholmer/Code/blastserver/src/app/api/test_2.xml2', { encoding: 'utf-8' })
  // await sleep(5000)
  await prisma.blastjob.update({
    where: {id: job.id},
    data: { results }
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

worker.on("failed", (job, err) => {
  console.warn(`Failed job ${job?.id}: ${err}`);
  prisma.blastjob.update({
    where: {id: job?.id},
    data: { err: err.message }
  })
});

worker.on("error", (err) => {
  console.error({ err });
});

export async function POST(request: Request) {
  const parameters = await request.json();
  const jobId = hash(parameters);
  const existingJob = await prisma.blastjob.findFirst({ where: { id: jobId }});
  if (!existingJob) {
    prisma.blastjob.create({
      data: {
        id: jobId,
        parameters
      }
    }).then(() => queue.add('blast', parameters, { jobId }))
  } else {
    console.log(`Found existing job: ${existingJob.id}`)
  }
  return NextResponse.json({ jobId })
}
