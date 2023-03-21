'use server';

import hash from 'object-hash';
import { Worker, Job } from "bullmq";
import { PrismaClient } from '@prisma/client';

import { queue, connection } from './queue';

const prisma = new PrismaClient();

async function jobProcessor(job: Job) {
  console.log(`Processing job ${job.id}`);
  job.updateProgress(10);
  return await prisma.blastjob.update({
    where: {id: job.id},
    data: { results: 'finished'}
  });
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
  console.log(`Failed job ${job?.id}: ${err}`);
});

worker.on("error", (err) => {
  console.log({ err });
});

export async function POST(request: Request) {
  const parameters = await request.json();
  const jobId = hash(parameters);
  const existingJob = await prisma.blastjob.findFirst({ where: { id: jobId }});
  console.log({ existingJob })
  if (!existingJob) {
    await prisma.blastjob.create({
      data: {
        id: jobId,
        parameters
      }
    })
    await queue.add('blast', parameters, { jobId });
  }
  return Response.json({ jobId })
}
