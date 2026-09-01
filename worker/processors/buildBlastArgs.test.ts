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
  MATCH_MISMATCH,
  MAX_TARGET_SEQS,
  COMPOSITIONAL_ADJUSTMENTS,
  COMP_BASED_STATS,
  BLASTN_TASK_PRESETS,
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

  it.each(MATCH_MISMATCH)(
    "splits blastn matchMismatch %s into -reward/-penalty",
    (mm) => {
      const [reward, penalty] = mm.split(",");
      const args = buildBlastArgs(params("blastn", { matchMismatch: mm }), ctx);
      expect(flagValue(args, "-reward")).toBe(reward);
      expect(flagValue(args, "-penalty")).toBe(penalty);
    }
  );

  it("omits -reward/-penalty for tblastx (translated, uses a protein matrix)", () => {
    const args = buildBlastArgs(params("tblastx"), ctx);
    expect(args).not.toContain("-reward");
    expect(args).not.toContain("-penalty");
  });

  it("omits -gapopen/-gapextend for blastn when gap costs are 'linear'", () => {
    const args = buildBlastArgs(params("blastn", { gapCosts: "linear" }), ctx);
    expect(args).not.toContain("-gapopen");
    expect(args).not.toContain("-gapextend");
  });

  it("still emits affine gap costs for blastn (e.g. 5,2)", () => {
    const args = buildBlastArgs(params("blastn", { gapCosts: "5,2" }), ctx);
    expect(flagValue(args, "-gapopen")).toBe("5");
    expect(flagValue(args, "-gapextend")).toBe("2");
  });

  it("adds -culling_limit only when maxMatchesInQueryRange is positive", () => {
    expect(
      flagValue(
        buildBlastArgs(params("blastp", { maxMatchesInQueryRange: 50 }), ctx),
        "-culling_limit"
      )
    ).toBe("50");
    expect(
      buildBlastArgs(params("blastp", { maxMatchesInQueryRange: 0 }), ctx)
    ).not.toContain("-culling_limit");
  });

  it.each(COMPOSITIONAL_ADJUSTMENTS)(
    "maps protein compositionalAdjustment %s to -comp_based_stats",
    (adj) => {
      const args = buildBlastArgs(
        params("blastp", { compositionalAdjustment: adj }),
        ctx
      );
      expect(flagValue(args, "-comp_based_stats")).toBe(COMP_BASED_STATS[adj]);
    }
  );

  it("omits -comp_based_stats for nucleotide flavours (blastn)", () => {
    expect(buildBlastArgs(params("blastn"), ctx)).not.toContain(
      "-comp_based_stats"
    );
  });

  it("uses -dust for blastn and -seg for protein/translated flavours", () => {
    expect(
      flagValue(
        buildBlastArgs(params("blastn", { filterLowComplexity: true }), ctx),
        "-dust"
      )
    ).toBe("yes");
    expect(
      flagValue(
        buildBlastArgs(params("blastn", { filterLowComplexity: false }), ctx),
        "-dust"
      )
    ).toBe("no");
    expect(
      flagValue(
        buildBlastArgs(params("blastp", { filterLowComplexity: true }), ctx),
        "-seg"
      )
    ).toBe("yes");
    expect(
      flagValue(
        buildBlastArgs(params("tblastx", { filterLowComplexity: false }), ctx),
        "-seg"
      )
    ).toBe("no");
  });

  it("emits -soft_masking with the explicit boolean", () => {
    expect(
      flagValue(buildBlastArgs(params("blastp", { softMasking: true }), ctx), "-soft_masking")
    ).toBe("true");
    expect(
      flagValue(buildBlastArgs(params("blastp", { softMasking: false }), ctx), "-soft_masking")
    ).toBe("false");
  });

  it("defaults -soft_masking to true for blastn only (matches each program's NCBI/BLAST+ default)", () => {
    // blastn (incl. megablast) is the one flavour whose engine default is `true`;
    // tblastx and the protein flavours default it off.
    expect(
      flagValue(buildBlastArgs(params("blastn"), ctx), "-soft_masking")
    ).toBe("true");
    expect(
      flagValue(buildBlastArgs(params("tblastx"), ctx), "-soft_masking")
    ).toBe("false");
    expect(
      flagValue(buildBlastArgs(params("blastp"), ctx), "-soft_masking")
    ).toBe("false");
  });

  // A query long enough that the short-query toggle never fires (> both thresholds).
  const LONG_QUERY = "A".repeat(60);
  // A query short enough to trigger the *-short tasks (< both thresholds).
  const SHORT_QUERY = "ACGTACGTAC";

  it.each(Object.entries(BLASTN_TASK_PRESETS))(
    "maps blastn program %s to its -task (long query)",
    (program, preset) => {
      const args = buildBlastArgs(
        params("blastn", { program, query: LONG_QUERY }),
        ctx
      );
      expect(flagValue(args, "-task")).toBe(preset.task);
    }
  );

  it("builds the full NCBI megablast arg set when the megablast preset is applied", () => {
    // Mirror the frontend program swap (page.tsx ProgramSelection): selecting
    // megablast applies its preset word size / match-mismatch / gap costs. The
    // resulting command line must match NCBI's web megablast defaults.
    const preset = BLASTN_TASK_PRESETS["Megablast (Highly similar sequences)"];
    const args = buildBlastArgs(
      params("blastn", {
        program: "Megablast (Highly similar sequences)",
        query: LONG_QUERY,
        wordSize: preset.wordSize,
        matchMismatch: preset.matchMismatch,
        gapCosts: preset.gapCosts,
      }),
      ctx
    );
    expect(flagValue(args, "-task")).toBe("megablast");
    expect(flagValue(args, "-word_size")).toBe("28");
    expect(flagValue(args, "-reward")).toBe("1");
    expect(flagValue(args, "-penalty")).toBe("-2");
    expect(flagValue(args, "-soft_masking")).toBe("true");
    expect(flagValue(args, "-dust")).toBe("yes");
    // Linear gaps -> greedy model, so no affine gap flags.
    expect(args).not.toContain("-gapopen");
    expect(args).not.toContain("-gapextend");
  });

  it("uses -task blastn-short for a short query (wins over the program preset)", () => {
    const args = buildBlastArgs(
      params("blastn", {
        program: "Megablast (Highly similar sequences)",
        shortQueries: true,
        query: SHORT_QUERY,
      }),
      ctx
    );
    expect(flagValue(args, "-task")).toBe("blastn-short");
  });

  it("uses -task blastp-short for a short blastp query", () => {
    expect(
      flagValue(
        buildBlastArgs(
          params("blastp", { shortQueries: true, query: SHORT_QUERY }),
          ctx
        ),
        "-task"
      )
    ).toBe("blastp-short");
  });

  it("does not switch to a *-short task for a long query even when the toggle is on", () => {
    // blastp: no short task -> no -task at all; blastn: falls back to its preset.
    expect(
      buildBlastArgs(
        params("blastp", { shortQueries: true, query: LONG_QUERY }),
        ctx
      )
    ).not.toContain("-task");
    expect(
      flagValue(
        buildBlastArgs(
          params("blastn", { shortQueries: true, query: LONG_QUERY }),
          ctx
        ),
        "-task"
      )
    ).toBe("blastn");
  });

  it.each(["blastp", "blastx", "tblastn", "tblastx"] as const)(
    "emits no -task for a normal (long-query) %s search",
    (flavour) => {
      expect(
        buildBlastArgs(params(flavour, { query: LONG_QUERY }), ctx)
      ).not.toContain("-task");
    }
  );

  it("emits -word_size for blastn but not for tblastx", () => {
    expect(
      flagValue(buildBlastArgs(params("blastn", { wordSize: 28 }), ctx), "-word_size")
    ).toBe("28");
    expect(buildBlastArgs(params("tblastx"), ctx)).not.toContain("-word_size");
  });
});
