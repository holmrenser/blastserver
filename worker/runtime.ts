// Shared lifecycle helpers for the pg-boss worker processes: a tiny health
// server for health probes and graceful shutdown so in-flight BLAST jobs drain
// (rather than being killed and left for the expiry to retry) on rolling
// updates / scale-down.

import http from "http";
import type { PrismaClient } from "../src/generated/prisma/client.js";
import { PgBoss } from "pg-boss";

import { PGBOSS_MAX_CONNECTIONS } from "../src/lib/queue.js";

/**
 * Starts a minimal HTTP server for liveness/readiness probes.
 *   GET /healthz -> 200 while the process is alive (liveness)
 *   GET /readyz  -> 200 when `isReady()`, else 503 (readiness)
 */
export function startHealthServer(isReady: () => boolean): http.Server {
  const port = Number(process.env.HEALTH_PORT) || 8080;
  const server = http.createServer((req, res) => {
    if (req.url === "/healthz") {
      res.writeHead(200).end("ok");
    } else if (req.url === "/readyz") {
      const ready = isReady();
      res.writeHead(ready ? 200 : 503).end(ready ? "ready" : "not ready");
    } else {
      res.writeHead(404).end();
    }
  });
  server.listen(port, () => console.log(`Health server listening on :${port}`));
  return server;
}

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
export async function startWorkerBoss(queue: string): Promise<PgBoss> {
  const boss = new PgBoss({
    connectionString: process.env.DATABASE_URL,
    max: PGBOSS_MAX_CONNECTIONS,
  });
  await boss.start();
  await boss.createQueue(queue);
  return boss;
}

/**
 * Logs pg-boss `error` events with their real cause. A Postgres-unreachable
 * error is collapsed to a single actionable hint until it recovers, instead of
 * spamming an opaque error on every reconnect attempt.
 */
function attachErrorLogging(boss: PgBoss, name: string): void {
  let connHintShown = false;
  boss.on("error", (err) => {
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

/**
 * Wires error logging + health probes + SIGTERM/SIGINT handling for a worker. On
 * a signal it stops accepting new jobs and waits for the in-flight job to finish
 * (`boss.stop({ graceful: true })`), then closes the health server and the DB
 * connection.
 */
export function setupWorkerRuntime(
  boss: PgBoss,
  prisma: PrismaClient,
  name: string
): void {
  attachErrorLogging(boss, name);

  let shuttingDown = false;
  const healthServer = startHealthServer(() => !shuttingDown);

  const shutdown = async (signal: NodeJS.Signals) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`Received ${signal}; draining worker before exit...`);
    try {
      await boss.stop({ graceful: true }); // resolves once active jobs finish
      await new Promise<void>((resolve) => healthServer.close(() => resolve()));
      await prisma.$disconnect();
    } catch (err) {
      console.error("Error during graceful shutdown:", err);
    } finally {
      process.exit(0);
    }
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
