// The pg-boss worker runtime. `WorkerRuntime` owns a worker process end to end:
// it creates the Prisma client and the pg-boss connection, registers a
// retry-aware job handler, and drains in-flight jobs on SIGTERM/SIGINT (rather
// than letting them be killed and left for the expiry to retry) on rolling
// updates / scale-down. A worker file just describes its queue and how to
// process a job, then calls `run()`.

import type { PrismaClient } from "../src/generated/prisma/client.js";
import { PgBoss } from "pg-boss";

import { createPrismaClient } from "../src/lib/prisma.js";
import { PGBOSS_MAX_CONNECTIONS } from "../src/lib/queue.js";

/** Error codes that mean "couldn't reach Postgres", not a job failure. */
const CONN_CODES = new Set(["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT"]);
const codeOf = (e: unknown) => (e as { code?: string } | null)?.code ?? "";

/** True when the error (or any AggregateError member) is a connection failure. */
function isConnectionError(err: unknown): boolean {
  if (err instanceof AggregateError)
    return err.errors.some((e) => CONN_CODES.has(codeOf(e)));
  return CONN_CODES.has(codeOf(err));
}

/** Human-readable summary that expands AggregateError's hidden nested errors. */
function describeError(err: unknown): string {
  if (err instanceof AggregateError) {
    const inner = err.errors.map((e) =>
      e instanceof Error ? e.message : String(e)
    );
    return `AggregateError: ${inner.join("; ")}`;
  }
  return err instanceof Error ? `${err.name}: ${err.message}` : String(err);
}

/**
 * Creates and starts a pg-boss client for a worker process and ensures its
 * queue exists. pg-boss provisions its own schema on first `start()` (guarded by
 * a Postgres advisory lock, so concurrent replicas are safe) and `createQueue`
 * is idempotent.
 */
async function startWorkerBoss(queue: string): Promise<PgBoss> {
  const boss = new PgBoss({
    connectionString: process.env.DATABASE_URL,
    max: PGBOSS_MAX_CONNECTIONS,
  });
  await boss.start();
  await boss.createQueue(queue);
  return boss;
}

/** A pg-boss job plus the retry metadata enabled by `includeMetadata: true`. */
type JobWithRetries<T> = { data: T; retryCount: number; retryLimit: number };

/**
 * Everything a worker process needs to describe itself. The job payload `T` must
 * carry the `jobId` used to address its row in Postgres.
 */
export interface WorkerConfig<T extends { jobId: string }> {
  /** pg-boss queue this worker consumes. */
  queue: string;
  /** Human-readable label used in logs (e.g. "BLAST"). */
  name: string;
  /** Runs one job. Throw to fail the attempt — pg-boss retries until exhausted. */
  process: (prisma: PrismaClient, data: T) => Promise<void>;
  /**
   * Marks the job's row terminally failed (e.g. set `err` + `finished`). Called
   * only once retries are exhausted; only the target table differs per worker.
   */
  recordFailure: (
    prisma: PrismaClient,
    jobId: string,
    message: string
  ) => Promise<void>;
  /**
   * Test seam: override how the Prisma client / pg-boss connection are created.
   * Production workers omit this and get the real implementations.
   */
  deps?: {
    createPrisma?: () => PrismaClient;
    startBoss?: (queue: string) => Promise<PgBoss>;
  };
}

/**
 * Owns a worker process end to end: it creates the Prisma client and the pg-boss
 * connection, registers a retry-aware job handler, and drains in-flight work on
 * SIGTERM/SIGINT. A worker file describes its queue and how to process a job,
 * then calls `run()`:
 *
 *   new WorkerRuntime<BlastJobData>({ queue, name, process, recordFailure }).run();
 *
 * `shutdown()` is split out from the signal handler (it drains without calling
 * `process.exit`), and the previously closure-captured `draining` state is
 * inspectable instance state — both so the runtime is directly unit-testable.
 */
export class WorkerRuntime<T extends { jobId: string }> {
  private readonly prisma: PrismaClient;
  private boss?: PgBoss;
  private draining = false;

  constructor(private readonly config: WorkerConfig<T>) {
    this.prisma = (config.deps?.createPrisma ?? createPrismaClient)();
  }

  /** Whether a graceful drain is in progress; lets tests/callers observe it. */
  get isDraining(): boolean {
    return this.draining;
  }

  /**
   * Boots the worker: opens the pg-boss connection, registers the job handler,
   * then wires error logging + graceful SIGTERM/SIGINT draining. The single
   * entrypoint a worker process calls.
   */
  async run(): Promise<void> {
    const startBoss = this.config.deps?.startBoss ?? startWorkerBoss;
    this.boss = await startBoss(this.config.queue);

    await this.boss.work<T>(
      this.config.queue,
      { includeMetadata: true },
      async ([job]) => this.handleJob(job)
    );

    console.log(`${this.config.name} worker started`);
    this.installLifecycle();
  }

  /**
   * Graceful drain: stop accepting new jobs and wait for the in-flight job to
   * finish (`boss.stop({ graceful: true })`), then close the DB connection.
   * Idempotent. Does NOT exit the process, so it is safe to call from a unit
   * test.
   */
  async shutdown(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    if (this.boss) await this.boss.stop({ graceful: true }); // once active jobs finish
    await this.prisma.$disconnect();
  }

  /**
   * Runs one job with the retry-aware error handling shared by every worker: log
   * success, and on failure persist the error only once retries are exhausted
   * (so a job that will still be retried isn't prematurely shown as failed in the
   * UI), then rethrow so pg-boss records the failed attempt.
   */
  private async handleJob(job: JobWithRetries<T>): Promise<void> {
    const { name } = this.config;
    const { jobId } = job.data;
    try {
      await this.config.process(this.prisma, job.data);
      console.log(`Completed ${name} job ${jobId}`);
    } catch (err) {
      if (job.retryCount >= job.retryLimit) {
        console.warn(`Failed ${name} job ${jobId} (final attempt): ${err}`);
        const message = err instanceof Error ? err.message : String(err);
        await this.config.recordFailure(this.prisma, jobId, message);
      } else {
        console.warn(
          `${name} job ${jobId} attempt ${job.retryCount + 1} failed, will retry: ${err}`
        );
      }
      throw err; // let pg-boss record the failed attempt and retry if any remain
    }
  }

  /** Side-effecting setup: error logging + signal handlers. */
  private installLifecycle(): void {
    this.attachErrorLogging();
    process.on("SIGTERM", this.handleSignal);
    process.on("SIGINT", this.handleSignal);
  }

  // Bound field so it can be registered as a listener with `this` intact.
  private handleSignal = async (signal: NodeJS.Signals): Promise<void> => {
    if (this.draining) return; // a second signal is a no-op while draining
    console.log(
      `Received ${signal}; draining ${this.config.name} worker before exit...`
    );
    try {
      await this.shutdown();
    } catch (err) {
      console.error("Error during graceful shutdown:", err);
    } finally {
      process.exit(0);
    }
  };

  /**
   * Logs pg-boss `error` events with their real cause. A Postgres-unreachable
   * error is collapsed to a single actionable hint until it recovers, instead of
   * spamming an opaque error on every reconnect attempt.
   */
  private attachErrorLogging(): void {
    const { name } = this.config;
    let connHintShown = false;
    this.boss?.on("error", (err) => {
      if (isConnectionError(err)) {
        if (!connHintShown) {
          console.error(
            `[${name}] Cannot reach Postgres — is DATABASE_URL correct and the ` +
              "database running? Suppressing further connection errors until recovery."
          );
          connHintShown = true;
        }
        return;
      }
      console.warn(`[${name}] pg-boss error: ${describeError(err)}`, err);
    });
  }
}
