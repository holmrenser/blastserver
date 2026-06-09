import {
  validateBlastParameters,
  BLASTFLAVOUR_DEFAULTS,
  getFieldOptions,
  ALLOWED_FLAVOURS,
  NUCLEOTIDE_WORD_SIZES,
  PROTEIN_WORD_SIZES,
} from "./schema";
import type { BlastFlavour } from "./schema";

const VALID_QUERY = "M".repeat(40);

/** A valid submission for a flavour: its defaults plus a long-enough query. */
function validSubmission(flavour: BlastFlavour) {
  return { ...BLASTFLAVOUR_DEFAULTS[flavour], query: VALID_QUERY };
}

describe("validateBlastParameters", () => {
  it.each(ALLOWED_FLAVOURS)("accepts a valid %s submission", (flavour) => {
    const result = validateBlastParameters(validSubmission(flavour));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.flavour).toBe(flavour);
    }
  });

  it("rejects an unknown flavour (no arbitrary binary names)", () => {
    const result = validateBlastParameters({
      ...validSubmission("blastp"),
      flavour: "rm -rf /",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a database that is not allowed for the flavour", () => {
    // core_nt is a nucleotide DB and not valid for protein blastp
    const result = validateBlastParameters({
      ...validSubmission("blastp"),
      database: "core_nt",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a query shorter than 25 characters", () => {
    const result = validateBlastParameters({
      ...validSubmission("blastp"),
      query: "MKTAYIAK",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(JSON.stringify(result.error.issues)).toContain(
        "shorter than 25"
      );
    }
  });

  it("rejects a multi-FASTA query", () => {
    const result = validateBlastParameters({
      ...validSubmission("blastp"),
      query: `>seq1\n${VALID_QUERY}\n>seq2\n${VALID_QUERY}`,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(JSON.stringify(result.error.issues)).toContain("multiple FASTA");
    }
  });

  it("coerces numeric string inputs to numbers", () => {
    const result = validateBlastParameters({
      ...validSubmission("blastp"),
      maxTargetSeqs: "100",
      wordSize: "5",
      expectThreshold: "0.05",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.maxTargetSeqs).toBe(100);
      expect(result.data.expectThreshold).toBeCloseTo(0.05);
    }
  });

  it("rejects an out-of-range maxTargetSeqs", () => {
    const result = validateBlastParameters({
      ...validSubmission("blastp"),
      maxTargetSeqs: 9999,
    });
    expect(result.success).toBe(false);
  });
});

describe("BLASTFLAVOUR_DEFAULTS", () => {
  it.each(ALLOWED_FLAVOURS)("has a self-consistent default for %s", (f) => {
    const defaults = BLASTFLAVOUR_DEFAULTS[f];
    expect(defaults.flavour).toBe(f);
  });

  it("defaults blastn to nucleotide low-complexity filtering on", () => {
    expect(BLASTFLAVOUR_DEFAULTS.blastn.filterLowComplexity).toBe(true);
    expect(BLASTFLAVOUR_DEFAULTS.blastp.filterLowComplexity).toBe(false);
  });
});

describe("getFieldOptions", () => {
  it("returns nucleotide word sizes for blastn", () => {
    expect(getFieldOptions("blastn").wordSize).toEqual(NUCLEOTIDE_WORD_SIZES);
  });
  it("returns protein word sizes for blastp", () => {
    expect(getFieldOptions("blastp").wordSize).toEqual(PROTEIN_WORD_SIZES);
  });
});
