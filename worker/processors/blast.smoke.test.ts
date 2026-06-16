// @vitest-environment node
//
// Layer 3 (real output + version-drift protection). The ONLY layer that runs a
// real blast+ binary: it builds args with the same `buildBlastArgs` used in
// production, runs `blastp` against the committed `blastdb/landmark` database,
// and pipes the genuine XML2 output through the real parser. This is what catches
// the class a mocked grid never could -- e.g. a flag like `-no_taxid_expansion`
// (valid only on blast+ >= 2.16) breaking, or BLAST changing its output shape.
//
// It is excluded from the default suites and only runs deliberately, via
// `RUN_BLAST_SMOKE=1 npm run test:smoke`, where blast+ is on PATH and the
// database is on disk (e.g. the worker image / a CI job that installs blast+).

import { spawnSync } from "child_process";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "node:url";

import { buildBlastArgs } from "./blast";
import {
  parseBlastXml,
  processRawHit,
} from "../../src/app/api/[...jobId]/formatResults";
import { BLASTFLAVOUR_DEFAULTS, type BlastParameters } from "@/lib/blast/schema";

// In the worker image the DBs are mounted at APP_BLAST_DB_PATH (/blastdb); for a
// local/CI checkout fall back to the committed ./blastdb at the repo root.
const dbDir =
  process.env.APP_BLAST_DB_PATH ||
  fileURLToPath(new URL("../../blastdb", import.meta.url));
const dbPath = path.join(dbDir, "landmark");

const gated =
  process.env.RUN_BLAST_SMOKE === "1" || process.env.RUN_BLAST_SMOKE === "true";

function blastpAvailable(): boolean {
  try {
    return spawnSync("blastp", ["-version"]).status === 0;
  } catch {
    return false;
  }
}

function landmarkPresent(): boolean {
  return [".pin", ".phr", ".pdb"].some((ext) => fs.existsSync(dbPath + ext));
}

const shouldRun = gated && blastpAvailable() && landmarkPresent();

describe.skipIf(!shouldRun)("blast smoke (real binary, real DB)", () => {
  it("runs blastp against landmark and parses non-empty hits end to end", () => {
    const query = "MWVTKLLPALLLQHVLLHLLLLPIAIPYAEGTRSLG";
    const data = {
      ...BLASTFLAVOUR_DEFAULTS.blastp,
      database: "landmark",
      query,
    } as BlastParameters;

    const args = buildBlastArgs(data, {
      dbPath,
      numThreads: "1",
      taxidListFile: null,
    });
    const result = spawnSync("blastp", args, {
      input: query,
      maxBuffer: 256 * 1024 * 1024,
    });

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);

    const xml = result.stdout
      .toString("utf8")
      .replace('encoding="US-ASCII"', 'encoding="UTF8"');
    const parsed = parseBlastXml(xml);

    expect(parsed.program).toBe("blastp");
    expect(parsed.version).toMatch(/2\./);
    expect(parsed.db).toContain("landmark");
    expect(parsed.rawHits.length).toBeGreaterThan(0);

    // The real per-hit summarizer copes with genuine output, not just fixtures.
    const hit = processRawHit({
      ...parsed.rawHits[0],
      queryLen: Number(parsed.queryLen),
    });
    expect(hit.accession).toBeTruthy();
    expect(hit.queryCover).toBeGreaterThan(0);
  });
});
