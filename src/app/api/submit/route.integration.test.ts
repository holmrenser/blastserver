import type { NextRequest } from "next/server";

// Stub the queue so no real pg-boss connection is needed; `send` is a stable
// mock shared across getBoss() calls (closure), so we can assert on it.
jest.mock("../queue", () => {
  const send = jest.fn().mockResolvedValue("queued");
  return { getBoss: jest.fn(async () => ({ send })) };
});

import { POST } from "./route";
import { getBoss } from "../queue";
import prisma from "../database";
import { BLASTFLAVOUR_DEFAULTS } from "@/lib/blast/schema";

const params = {
  ...BLASTFLAVOUR_DEFAULTS.blastp,
  query: "MWVTKLLPALLLQHVLLHLLLLPIAIPYAEGTRSLG",
};

const fakeRequest = (body: unknown) =>
  ({ json: async () => body }) as unknown as NextRequest;

afterAll(async () => {
  await prisma.$disconnect();
});

describe("POST /api/submit (integration, real Postgres)", () => {
  it("creates the job + enqueues once, and dedupes a repeat submit", async () => {
    const boss = await getBoss();
    const send = boss.send as jest.Mock;
    send.mockClear();

    let jobId: string | undefined;
    try {
      const res1 = await POST(fakeRequest(params));
      ({ jobId } = (await res1.json()) as { jobId: string });
      expect(jobId).toBeTruthy();

      // Identical parameters hash to the same id and must not re-enqueue.
      const res2 = await POST(fakeRequest(params));
      const body2 = (await res2.json()) as { jobId: string };
      expect(body2.jobId).toBe(jobId);

      expect(await prisma.blastjob.count({ where: { id: jobId } })).toBe(1);
      expect(send).toHaveBeenCalledTimes(1);
    } finally {
      if (jobId) await prisma.blastjob.deleteMany({ where: { id: jobId } });
    }
  });
});
