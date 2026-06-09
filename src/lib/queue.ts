// Shared job-queue constants for the pg-boss queues. Kept dependency-free (no
// zod, no Prisma, no "@/" alias) so the workers — compiled with
// tsconfig.worker.json — can import it via a relative path, the same way they
// import ./blast/constants.
//
// Job state lives in the `blastjob` / `download` Postgres tables (the source of
// truth the UI polls); pg-boss only provides the transport + retry/expiry.

export const BLAST_QUEUE = "blastQueue";
export const DOWNLOAD_QUEUE = "downloadQueue";

/** Times a failed job is retried before it is marked permanently failed. */
export const JOB_RETRY_LIMIT = Number(process.env.JOB_RETRY_LIMIT) || 2;

/**
 * Hard cap (seconds) on how long a job may run before pg-boss retries/fails it.
 * BLAST runs synchronously via spawnSync, which blocks the event loop and so
 * can't heartbeat — this bounds a single run, mirroring the previous BullMQ
 * lock-duration ceiling. Raise it if legitimate searches exceed this.
 */
export const JOB_EXPIRE_SECONDS =
  Number(process.env.JOB_EXPIRE_SECONDS) || 1800; // 30 min

/**
 * pg-boss connection-pool size per process. Kept small because every app +
 * worker replica opens its own pg-boss pool alongside Prisma's; the sum must
 * stay under Postgres `max_connections`.
 */
export const PGBOSS_MAX_CONNECTIONS =
  Number(process.env.PGBOSS_MAX_CONNECTIONS) || 5;
