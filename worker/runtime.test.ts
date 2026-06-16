// @vitest-environment node
//
// Unit test for the worker lifecycle. Runs in the unit suite (`npm test`) but
// under the node environment, since WorkerRuntime drives Node-only resources
// (process signals) with no DOM involvement. pg-boss and Prisma are injected as
// fakes via `config.deps`, so nothing connects to Postgres and the retry/drain
// logic is exercised directly — no real SIGTERM, no process.exit.

import { vi } from "vitest";
import type { PgBoss } from "pg-boss";
import type { PrismaClient } from "../src/generated/prisma/client.js";
import { WorkerRuntime } from "./runtime.js";

type TestJob = { jobId: string };

/**
 * A pg-boss stand-in. WorkerRuntime only calls on()/stop()/work(); `work`
 * captures the registered handler so a test can drive a job through it via
 * `emit()`.
 */
function makeFakeBoss() {
  let handler: ((jobs: unknown[]) => Promise<void>) | undefined;
  const raw = {
    on: vi.fn(),
    stop: vi.fn().mockResolvedValue(undefined),
    work: vi.fn(
      async (_q: string, _o: unknown, cb: (jobs: unknown[]) => Promise<void>) => {
        handler = cb;
        return "worker-id";
      }
    ),
  };
  return {
    raw,
    boss: raw as unknown as PgBoss,
    /** Feed one job through the handler run() registered. */
    emit: (job: unknown) => {
      if (!handler) throw new Error("work() handler not registered");
      return handler([job]);
    },
  };
}

const fakePrisma = () =>
  ({ $disconnect: vi.fn().mockResolvedValue(undefined) }) as unknown as PrismaClient;

describe("WorkerRuntime", () => {
  // run() registers real SIGTERM/SIGINT handlers; clean them up between tests.
  // Snapshot the signal listeners before each test and remove only the ones a
  // test added (so vitest's own handlers survive).
  const shutdowns: Array<() => Promise<void>> = [];
  let signalsBefore: { term: unknown[]; int: unknown[] };

  beforeEach(() => {
    signalsBefore = {
      term: process.listeners("SIGTERM"),
      int: process.listeners("SIGINT"),
    };
  });
  afterEach(async () => {
    for (const stop of shutdowns.splice(0)) await stop();
    for (const l of process.listeners("SIGTERM"))
      if (!signalsBefore.term.includes(l))
        process.removeListener("SIGTERM", l as never);
    for (const l of process.listeners("SIGINT"))
      if (!signalsBefore.int.includes(l))
        process.removeListener("SIGINT", l as never);
  });

  /** Boot a runtime with injected fakes; auto-shutdown after the test. */
  async function boot(overrides?: {
    process?: (prisma: PrismaClient, data: TestJob) => Promise<void>;
  }) {
    const fake = makeFakeBoss();
    const prisma = fakePrisma();
    const process = vi.fn(overrides?.process ?? (async () => {}));
    const recordFailure = vi.fn().mockResolvedValue(undefined);

    const runtime = new WorkerRuntime<TestJob>({
      queue: "testQueue",
      name: "TEST",
      process,
      recordFailure,
      deps: { createPrisma: () => prisma, startBoss: async () => fake.boss },
    });
    await runtime.run();
    shutdowns.push(() => runtime.shutdown());
    return { runtime, fake, prisma, process, recordFailure };
  }

  it("run() registers the job handler and error logging", async () => {
    const { runtime, fake } = await boot();

    expect(fake.raw.work).toHaveBeenCalledWith(
      "testQueue",
      { includeMetadata: true },
      expect.any(Function)
    );
    expect(fake.raw.on).toHaveBeenCalledWith("error", expect.any(Function));
    expect(runtime.isDraining).toBe(false);
  });

  it("shutdown() drains boss + prisma and is idempotent", async () => {
    const { runtime, fake, prisma } = await boot();

    await runtime.shutdown();
    await runtime.shutdown(); // second call is a no-op

    expect(runtime.isDraining).toBe(true);
    expect(fake.raw.stop).toHaveBeenCalledTimes(1);
    expect(fake.raw.stop).toHaveBeenCalledWith({ graceful: true });
    expect(prisma.$disconnect).toHaveBeenCalledTimes(1);
  });

  it("processes a job with the injected Prisma client", async () => {
    const { fake, prisma, process, recordFailure } = await boot();

    await fake.emit({ data: { jobId: "j1" }, retryCount: 0, retryLimit: 2 });

    expect(process).toHaveBeenCalledWith(prisma, { jobId: "j1" });
    expect(recordFailure).not.toHaveBeenCalled();
  });

  it("records a terminal failure only once retries are exhausted, and always rethrows", async () => {
    const { fake, prisma, recordFailure } = await boot({
      process: async () => {
        throw new Error("boom");
      },
    });

    // Retries remain: rethrow so pg-boss retries, but don't mark it failed yet.
    await expect(
      fake.emit({ data: { jobId: "j1" }, retryCount: 0, retryLimit: 2 })
    ).rejects.toThrow("boom");
    expect(recordFailure).not.toHaveBeenCalled();

    // Final attempt: rethrow AND persist the terminal failure.
    await expect(
      fake.emit({ data: { jobId: "j2" }, retryCount: 2, retryLimit: 2 })
    ).rejects.toThrow("boom");
    expect(recordFailure).toHaveBeenCalledWith(prisma, "j2", "boom");
  });
});
