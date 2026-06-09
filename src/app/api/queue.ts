import { PgBoss } from "pg-boss";

import {
  BLAST_QUEUE,
  DOWNLOAD_QUEUE,
  PGBOSS_MAX_CONNECTIONS,
} from "@/lib/queue";

let bossPromise: Promise<PgBoss> | null = null;

/**
 * Lazily-started, process-wide pg-boss client used by the API to enqueue jobs.
 * Maintenance/scheduling/expiry are handled by the worker processes, so the
 * app instance only sends (supervise/schedule disabled). pg-boss provisions its
 * schema on first start (advisory-locked) and createQueue is idempotent.
 */
export function getBoss(): Promise<PgBoss> {
  if (!bossPromise) {
    bossPromise = (async () => {
      const boss = new PgBoss({
        connectionString: process.env.DATABASE_URL,
        max: PGBOSS_MAX_CONNECTIONS,
        supervise: false,
        schedule: false,
      });
      boss.on("error", (err) => console.error("pg-boss error:", err));
      await boss.start();
      await boss.createQueue(BLAST_QUEUE);
      await boss.createQueue(DOWNLOAD_QUEUE);
      return boss;
    })();
  }
  return bossPromise;
}
