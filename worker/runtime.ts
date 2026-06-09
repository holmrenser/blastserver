// Shared lifecycle helpers for the BullMQ worker processes: a tiny health
// server for health probes and graceful shutdown so in-flight BLAST jobs
// drain (rather than being killed and left locked) on rolling updates / scale-down.

import http from "http";
import type { Worker } from "bullmq";
import type { PrismaClient } from "@prisma/client";

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

/** Error codes that mean "couldn't reach the Redis backend", not a job failure. */
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
 * Logs worker `error` events with their real cause. A Redis-unreachable error
 * (which BullMQ re-emits on every reconnect attempt) is collapsed to a single
 * actionable hint until the connection recovers, instead of spamming an opaque
 * "AggregateError" on every retry.
 */
function attachErrorLogging(worker: Worker, name: string): void {
  let redisHintShown = false;
  worker.on("ready", () => {
    redisHintShown = false; // a later drop should warn once more
  });
  worker.on("error", (err) => {
    if (isConnectionError(err)) {
      if (!redisHintShown) {
        const host = process.env.JOBQUEUE_HOST ?? "localhost";
        const port = process.env.JOBQUEUE_PORT ?? "6379";
        console.error(
          `[${name}] Cannot reach Redis at ${host}:${port} — is it running? ` +
            "Start it with `docker compose up -d redis`. " +
            "Suppressing further connection errors until reconnect."
        );
        redisHintShown = true;
      }
      return; // throttle the repeated ECONNREFUSED spam
    }
    console.warn(`[${name}] worker error: ${describeError(err)}`, err);
  });
}

/**
 * Wires error logging + health probes + SIGTERM/SIGINT handling for a worker. On
 * a signal it stops accepting new jobs, waits for the in-flight job to finish
 * (`worker.close()`), then closes the health server and the DB connection.
 */
export function setupWorkerRuntime(
  worker: Worker,
  prisma: PrismaClient,
  name: string
): void {
  attachErrorLogging(worker, name);

  let shuttingDown = false;
  const healthServer = startHealthServer(
    () => worker.isRunning() && !shuttingDown
  );

  const shutdown = async (signal: NodeJS.Signals) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`Received ${signal}; draining worker before exit...`);
    try {
      await worker.close(); // resolves once the active job completes
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

/** Output buffer cap (bytes) for spawnSync; bounded to avoid unbounded memory. */
export const MAX_BUFFER =
  Number(process.env.BLAST_MAX_BUFFER) || 1024 * 1024 * 1024; // 1 GiB

/** BullMQ stalled-job lock (ms); only bounds how long a crashed job stays locked. */
export const LOCK_DURATION =
  Number(process.env.BLAST_LOCK_DURATION_MS) || 1_800_000; // 30 min
