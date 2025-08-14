import { Queue } from "bullmq";

export const connection = {
  host: process.env.JOBQUEUE_HOST!,
  port: Number(process.env.JOBQUEUE_PORT),
  enableOfflineQueue: false,
};

export const blastQueue = new Queue("blastQueue", { connection });
export const downloadQueue = new Queue("downloadQueue", { connection });
