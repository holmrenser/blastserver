import { Queue } from 'bullmq';

export const connection = {
  host: process.env.JOBQUEUE_HOST,
  port: Number(process.env.JOBQUEUE_PORT),
};

export const queue = new Queue("jobqueue", { connection });