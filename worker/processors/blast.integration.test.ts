import { randomBytes } from "crypto";
import { vi, type Mock } from "vitest";
import { createPrismaClient } from "@/lib/prisma";

// Mock only the BLAST binary call so the test is deterministic and needs no
// blast+ / database on disk. Keep the rest of child_process real — Prisma's
// platform detection uses it. Hoisted above the imports by Vitest.
vi.mock("child_process", async () => ({
  ...(await vi.importActual<typeof import("child_process")>("child_process")),
  spawnSync: vi.fn(),
}));

import { spawnSync } from "child_process";
import { runBlastJob } from "./blast";
import { BLASTFLAVOUR_DEFAULTS } from "@/lib/blast/schema";

const mockSpawn = spawnSync as unknown as Mock;
const prisma = createPrismaClient();

// A valid blastp request against a real database name (landmark), with a query
// long enough to pass validation.
const params = {
  ...BLASTFLAVOUR_DEFAULTS.blastp,
  database: "landmark" as const,
  query: "MWVTKLLPALLLQHVLLHLLLLPIAIPYAEGTRSLG",
};

const newJobId = () => `itest-${randomBytes(6).toString("hex")}`;

afterAll(async () => {
  await prisma.$disconnect();
});

describe("runBlastJob (integration, real Postgres)", () => {
  beforeEach(() => mockSpawn.mockReset());

  it("marks the job started, runs BLAST, and stores the XML result", async () => {
    const jobId = newJobId();
    await prisma.blastjob.create({
      data: { id: jobId, parameters: params, submitted: new Date() },
    });
    // The US-ASCII declaration is rewritten to UTF8 by the processor so the
    // Postgres XML column accepts it (Postgres then strips the declaration on
    // storage, so we assert on the document body instead).
    mockSpawn.mockReturnValue({
      status: 0,
      stdout: Buffer.from(
        '<?xml version="1.0" encoding="US-ASCII"?><BlastOutput2><report>ok</report></BlastOutput2>'
      ),
      stderr: Buffer.from(""),
    });

    try {
      await runBlastJob(prisma, jobId, params);

      const job = await prisma.blastjob.findUniqueOrThrow({
        where: { id: jobId },
      });
      expect(job.started).not.toBeNull();
      expect(job.finished).not.toBeNull();
      expect(job.err).toBeNull();
      expect(job.results).toContain("<report>ok</report>");

      // The right binary + database + stdin query were used.
      expect(mockSpawn).toHaveBeenCalledWith(
        "blastp",
        expect.arrayContaining(["-db", expect.stringContaining("landmark")]),
        expect.objectContaining({ input: params.query })
      );
    } finally {
      await prisma.blastjob.delete({ where: { id: jobId } });
    }
  });

  it("throws and leaves the job unfinished when BLAST exits non-zero", async () => {
    const jobId = newJobId();
    await prisma.blastjob.create({
      data: { id: jobId, parameters: params, submitted: new Date() },
    });
    mockSpawn.mockReturnValue({
      status: 1,
      stdout: Buffer.from(""),
      stderr: Buffer.from("boom"),
    });

    try {
      await expect(runBlastJob(prisma, jobId, params)).rejects.toThrow("boom");

      const job = await prisma.blastjob.findUniqueOrThrow({
        where: { id: jobId },
      });
      // Started is set before the run; results/finished are left for the worker
      // to set (terminally) only after retries are exhausted.
      expect(job.started).not.toBeNull();
      expect(job.finished).toBeNull();
      expect(job.results).toBeNull();
    } finally {
      await prisma.blastjob.delete({ where: { id: jobId } });
    }
  });
});
