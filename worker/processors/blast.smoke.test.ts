// @vitest-environment node
//
// Layer 3 (real output + version-drift protection). The ONLY layer that runs a
// real blast+ binary: it builds args with the same `buildBlastArgs` used in
// production, runs `blastp` against the `testdata/blastdb/landmark` database,
// and pipes the genuine XML2 output through the real parser. This is what catches
// the class a mocked grid never could -- e.g. a flag like `-no_taxid_expansion`
// (valid only on blast+ >= 2.16) breaking, or BLAST changing its output shape.
//
// It is excluded from the default suites and only runs deliberately, via
// `RUN_BLAST_SMOKE=1 npm run test:smoke`, where blast+ is on PATH and the
// database is on disk (e.g. the worker image / a CI job that installs blast+).

import { spawnSync } from "child_process";
import path from "path";
import os from "os";
import fs from "fs";
import { fileURLToPath } from "node:url";

import { buildBlastArgs } from "./blast";
import {
  parseBlastXml,
  processRawHit,
} from "../../src/app/api/[...jobId]/formatResults";
import {
  BLASTFLAVOUR_DEFAULTS,
  BLASTN_TASK_PRESETS,
  type BlastParameters,
} from "@/lib/blast/schema";

/** The value immediately following `flag` in the arg list, or undefined. */
function flagValue(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i === -1 ? undefined : args[i + 1];
}

/** True when a blast+ tool is on PATH and answers `-version`. */
function toolAvailable(tool: string): boolean {
  try {
    return spawnSync(tool, ["-version"]).status === 0;
  } catch {
    return false;
  }
}

// In the worker image the DBs are mounted at APP_BLAST_DB_PATH (/blastdb); for a
// local/CI checkout fall back to the gitignored ./testdata/blastdb at the repo root.
const dbDir =
  process.env.APP_BLAST_DB_PATH ||
  fileURLToPath(new URL("../../testdata/blastdb", import.meta.url));
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

  // Guards the flag combinations the pure test can't validate: that the real
  // binary accepts -culling_limit alongside -max_target_seqs, plus the explicit
  // -comp_based_stats / -soft_masking / -seg the wired form fields now emit.
  it("accepts a culling limit + filtering flags on the real binary", () => {
    const query = "MWVTKLLPALLLQHVLLHLLLLPIAIPYAEGTRSLG";
    const data = {
      ...BLASTFLAVOUR_DEFAULTS.blastp,
      database: "landmark",
      query,
      maxMatchesInQueryRange: 10,
      filterLowComplexity: true,
      softMasking: true,
      compositionalAdjustment: "Universal compositional score matrix adjustment",
    } as BlastParameters;

    const args = buildBlastArgs(data, {
      dbPath,
      numThreads: "1",
      taxidListFile: null,
    });
    expect(args).toContain("-culling_limit");

    const result = spawnSync("blastp", args, {
      input: query,
      maxBuffer: 256 * 1024 * 1024,
    });

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
  });
});

// Real megablast against a self-built nucleotide DB. Unlike the blastp block above
// this owns its database (there is no nucleotide DB in ./testdata/blastdb), building
// a tiny one with makeblastdb so the whole megablast path -- the frontend program
// preset (page.tsx) -> buildBlastArgs -> real `blastn -task megablast` -> parser --
// runs end to end and stays pinned to NCBI web megablast's defaults (notably
// -soft_masking true, which the app now defaults on for blastn).
const megablastShouldRun =
  gated && toolAvailable("blastn") && toolAvailable("makeblastdb");

describe.skipIf(!megablastShouldRun)(
  "megablast smoke (real binary, self-built nucleotide DB)",
  () => {
    // A varied (non-low-complexity) 60 bp query that is an exact substring of the
    // subject below, so a "highly similar" megablast (word size 28) is guaranteed a hit.
    const query =
      "ACGATTGCCAGTTCAGGATCGTACCGATTGCAAGCTTGGACATCGGTACAGCTTAGCCATG";
    const subjectFasta =
      ">testseq1 synthetic nucleotide\n" +
      "GGCATTAGCCTAGCTAGGCA" + query + "TTAGGCATTCCGGATTACGCA\n";

    let dbDir: string;
    let dbPath: string;

    beforeAll(() => {
      dbDir = fs.mkdtempSync(path.join(os.tmpdir(), "blastserver-megablast-"));
      const fasta = path.join(dbDir, "subject.fa");
      fs.writeFileSync(fasta, subjectFasta);
      dbPath = path.join(dbDir, "testnt");
      const mk = spawnSync("makeblastdb", [
        "-in", fasta,
        "-dbtype", "nucl",
        "-parse_seqids",
        "-out", dbPath,
        "-title", "testnt",
      ]);
      expect(mk.status).toBe(0);
    });

    afterAll(() => {
      if (dbDir) fs.rmSync(dbDir, { recursive: true, force: true });
    });

    it("runs megablast exactly as the wired form builds it and parses a hit", () => {
      // Mirror the frontend program swap (page.tsx ProgramSelection): selecting
      // megablast applies its preset word size / match-mismatch / gap costs.
      const preset = BLASTN_TASK_PRESETS["Megablast (Highly similar sequences)"];
      const data = {
        ...BLASTFLAVOUR_DEFAULTS.blastn,
        program: "Megablast (Highly similar sequences)",
        database: "testnt",
        query,
        wordSize: preset.wordSize,
        matchMismatch: preset.matchMismatch,
        gapCosts: preset.gapCosts,
      } as BlastParameters;

      const args = buildBlastArgs(data, {
        dbPath,
        numThreads: "1",
        taxidListFile: null,
      });

      // The command line the real binary receives must match NCBI web megablast.
      expect(flagValue(args, "-task")).toBe("megablast");
      expect(flagValue(args, "-word_size")).toBe("28");
      expect(flagValue(args, "-reward")).toBe("1");
      expect(flagValue(args, "-penalty")).toBe("-2");
      expect(flagValue(args, "-soft_masking")).toBe("true");
      expect(flagValue(args, "-dust")).toBe("yes");
      expect(args).not.toContain("-gapopen"); // linear gaps

      const result = spawnSync("blastn", args, {
        input: query,
        maxBuffer: 256 * 1024 * 1024,
      });
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(0);

      const xml = result.stdout
        .toString("utf8")
        .replace('encoding="US-ASCII"', 'encoding="UTF8"');
      const parsed = parseBlastXml(xml);

      expect(parsed.program).toBe("blastn");
      expect(parsed.version).toMatch(/2\./);
      expect(parsed.rawHits.length).toBeGreaterThan(0);

      const hit = processRawHit({
        ...parsed.rawHits[0],
        queryLen: Number(parsed.queryLen),
      });
      expect(hit.accession).toBeTruthy();
      expect(hit.queryCover).toBeGreaterThan(0);
    });
  }
);
