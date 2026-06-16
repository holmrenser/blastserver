// @vitest-environment node
//
// Layer 1 (param -> command-line correctness). `buildBlastArgs` is a pure
// function, so this drives it directly with no Postgres and no spawn mock. The
// flags are independent, so each axis is covered once (it.each tables) and the
// few real branches get a focused case each -- no combinatorial parameter grid.

import { buildBlastArgs, type BlastArgsContext } from "./blast";
import {
  BLASTFLAVOUR_DEFAULTS,
  PROTEIN_MATRICES,
  PROTEIN_GAP_COSTS,
  MAX_TARGET_SEQS,
  type BlastFlavour,
  type BlastParameters,
} from "@/lib/blast/schema";

const ctx: BlastArgsContext = {
  dbPath: "/blastdb/landmark",
  numThreads: "4",
  taxidListFile: null,
};

/** A valid params object for `flavour`, with optional field overrides. */
function params(
  flavour: BlastFlavour,
  overrides: Record<string, unknown> = {}
): BlastParameters {
  return { ...BLASTFLAVOUR_DEFAULTS[flavour], ...overrides } as BlastParameters;
}

/** The value immediately following `flag` in the arg list, or undefined. */
function flagValue(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i === -1 ? undefined : args[i + 1];
}

describe("buildBlastArgs", () => {
  it("emits the core flags every search shares", () => {
    const args = buildBlastArgs(
      params("blastp", { expectThreshold: 0.05, maxTargetSeqs: 100 }),
      ctx
    );
    expect(flagValue(args, "-db")).toBe("/blastdb/landmark");
    expect(flagValue(args, "-outfmt")).toBe("16");
    expect(flagValue(args, "-num_threads")).toBe("4");
    expect(flagValue(args, "-evalue")).toBe("0.05");
    expect(flagValue(args, "-max_target_seqs")).toBe("100");
  });

  it.each(MAX_TARGET_SEQS)("passes max_target_seqs=%s through", (n) => {
    const args = buildBlastArgs(params("blastp", { maxTargetSeqs: n }), ctx);
    expect(flagValue(args, "-max_target_seqs")).toBe(String(n));
  });

  it.each(PROTEIN_MATRICES)("maps protein matrix %s to -matrix", (m) => {
    const args = buildBlastArgs(params("blastp", { matrix: m }), ctx);
    expect(flagValue(args, "-matrix")).toBe(m);
  });

  it.each(PROTEIN_GAP_COSTS)(
    "splits gapCosts %s into -gapopen/-gapextend",
    (gc) => {
      const [open, extend] = gc.split(",");
      const args = buildBlastArgs(params("blastp", { gapCosts: gc }), ctx);
      expect(flagValue(args, "-gapopen")).toBe(open);
      expect(flagValue(args, "-gapextend")).toBe(extend);
    }
  );

  it("defaults query_loc to 1-<query length> when no range is given", () => {
    const query = "M".repeat(40);
    const args = buildBlastArgs(
      params("blastp", { query, queryFrom: undefined, queryTo: undefined }),
      ctx
    );
    expect(flagValue(args, "-query_loc")).toBe("1-40");
  });

  it("uses an explicit query_loc range when from/to are set", () => {
    const args = buildBlastArgs(
      params("blastp", { queryFrom: 5, queryTo: 20 }),
      ctx
    );
    expect(flagValue(args, "-query_loc")).toBe("5-20");
  });

  it("includes a scoring matrix + word size for protein flavours", () => {
    const args = buildBlastArgs(
      params("blastp", { matrix: "BLOSUM62", wordSize: 6 }),
      ctx
    );
    expect(flagValue(args, "-matrix")).toBe("BLOSUM62");
    expect(flagValue(args, "-word_size")).toBe("6");
  });

  it("omits -matrix for nucleotide flavours (blastn), but keeps gap costs", () => {
    const args = buildBlastArgs(params("blastn"), ctx);
    expect(args).not.toContain("-matrix");
    expect(args).toContain("-gapopen");
  });

  it("keeps the scoring matrix for tblastn (protein scoring on a nucleotide DB)", () => {
    const args = buildBlastArgs(params("tblastn"), ctx);
    expect(args).toContain("-matrix");
    expect(args).toContain("-gapopen");
  });

  it("skips gap costs and matrix entirely for tblastx", () => {
    const args = buildBlastArgs(params("tblastx"), ctx);
    expect(args).not.toContain("-gapopen");
    expect(args).not.toContain("-gapextend");
    expect(args).not.toContain("-matrix");
  });

  it("adds -lcase_masking only when enabled", () => {
    expect(
      buildBlastArgs(params("blastp", { lcaseMasking: true }), ctx)
    ).toContain("-lcase_masking");
    expect(
      buildBlastArgs(params("blastp", { lcaseMasking: false }), ctx)
    ).not.toContain("-lcase_masking");
  });

  it("uses -taxidlist (+ no expansion) when a taxid filter is included", () => {
    const args = buildBlastArgs(params("blastp", { excludeTaxids: false }), {
      ...ctx,
      taxidListFile: "/tmp/t.txt",
    });
    expect(flagValue(args, "-taxidlist")).toBe("/tmp/t.txt");
    expect(args).toContain("-no_taxid_expansion");
    expect(args).not.toContain("-negative_taxidlist");
  });

  it("uses -negative_taxidlist when the taxid filter excludes", () => {
    const args = buildBlastArgs(params("blastp", { excludeTaxids: true }), {
      ...ctx,
      taxidListFile: "/tmp/t.txt",
    });
    expect(flagValue(args, "-negative_taxidlist")).toBe("/tmp/t.txt");
    expect(args).toContain("-no_taxid_expansion");
    expect(args).not.toContain("-taxidlist");
  });

  it("emits no taxid flags when no filter file is provided", () => {
    const args = buildBlastArgs(params("blastp"), ctx);
    expect(args).not.toContain("-taxidlist");
    expect(args).not.toContain("-negative_taxidlist");
    expect(args).not.toContain("-no_taxid_expansion");
  });
});
