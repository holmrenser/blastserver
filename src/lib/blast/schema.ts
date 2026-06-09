import { z } from "zod";

import { BLAST_DBS, PROGRAMS } from "./constants";
import type { BlastFlavour } from "./constants";

// Re-export the zod-free domain constants so existing `@/lib/blast/schema`
// importers keep working.
export * from "./constants";

/* Allowed values for the algorithm-parameter dropdowns. Single source of truth
 * for both the zod schemas below and the form's <option> lists. */
export const MAX_TARGET_SEQS = [10, 50, 100, 250, 500, 1000, 5000] as const;
export const PROTEIN_MATRICES = [
  "PAM30",
  "PAM70",
  "PAM250",
  "BLOSUM45",
  "BLOSUM50",
  "BLOSUM62",
  "BLOSUM80",
  "BLOSUM90",
] as const;
export const PROTEIN_WORD_SIZES = [2, 3, 5, 6] as const;
export const PROTEIN_GAP_COSTS = [
  "11,2",
  "10,2",
  "9,2",
  "8,2",
  "7,2",
  "6,2",
  "13,1",
  "12,1",
  "11,1",
  "10,1",
  "9,1",
] as const;
export const COMPOSITIONAL_ADJUSTMENTS = [
  "No adjustment",
  "Compositon-based statistics",
  "Conditional compositional score matrix adjustment",
  "Universal compositional score matrix adjustment",
] as const;
export const NUCLEOTIDE_WORD_SIZES = [7, 11, 15] as const;
export const MATCH_MISMATCH = [
  "1,-2",
  "1,-3",
  "1,-4",
  "2,-3",
  "4,-5",
  "1,-1",
] as const;
export const NUCLEOTIDE_GAP_COSTS = [
  "linear",
  "5,2",
  "2,2",
  "1,2",
  "0,2",
  "3,1",
  "2,1",
  "1,1",
] as const;

/* ------------------------------------------------------------------ *
 * zod schema helpers
 * ------------------------------------------------------------------ */

const tuple = (values: readonly string[]) =>
  z.enum(values as unknown as [string, ...string[]]);

/** Optional positive number coming from a text input ("" -> undefined). */
const optionalPositive = (message: string) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : v),
    z.coerce.number().positive(message).optional()
  );

const numericOneOf = (values: readonly number[], fallback: number) =>
  z.coerce
    .number()
    .refine((v) => (values as readonly number[]).includes(v), {
      message: `Must be one of: ${values.join(", ")}`,
    })
    .default(fallback);

const query = z
  .string()
  .trim()
  .refine((v) => (v.match(/>/g) || []).length < 2, {
    message: "Query contains multiple FASTA sequences",
  })
  .refine((v) => v.length >= 25, {
    message: "Query is shorter than 25 characters",
  })
  .refine((v) => v.length <= 10_000, {
    message: "Query is longer than 10,000 characters",
  });

const baseShape = {
  jobTitle: z.string().optional(),
  email: z.string().optional(),
  query,
  queryFrom: optionalPositive("Query FROM cannot be negative"),
  queryTo: optionalPositive("Query TO cannot be negative"),
  maxTargetSeqs: numericOneOf(MAX_TARGET_SEQS, 100),
  expectThreshold: z.coerce
    .number()
    .positive("Expect threshold cannot be negative")
    .default(0.05),
  maxMatchesInQueryRange: z.coerce
    .number()
    .min(0, "Max. matches in query range cannot be negative")
    .default(0),
  taxids: z.array(z.string()).default([]),
  excludeTaxids: z.boolean().default(false),
  softMasking: z.boolean().default(false),
  lcaseMasking: z.boolean().default(false),
  filterLowComplexity: z.boolean().default(false),
  shortQueries: z.boolean().default(true),
};

const proteinScoringShape = {
  matrix: tuple(PROTEIN_MATRICES).default("BLOSUM62"),
  wordSize: numericOneOf(PROTEIN_WORD_SIZES, 5),
  gapCosts: tuple(PROTEIN_GAP_COSTS).default("11,1"),
  compositionalAdjustment: tuple(COMPOSITIONAL_ADJUSTMENTS).default(
    "Conditional compositional score matrix adjustment"
  ),
};

const nucleotideScoringShape = {
  wordSize: numericOneOf(NUCLEOTIDE_WORD_SIZES, 11),
  matchMismatch: tuple(MATCH_MISMATCH).default("2,-3"),
  gapCosts: tuple(NUCLEOTIDE_GAP_COSTS).default("5,2"),
};

const flavourSpecifics = (flavour: BlastFlavour) => ({
  flavour: z.literal(flavour),
  program: tuple(PROGRAMS.get(flavour)!).default(PROGRAMS.get(flavour)![0]),
  database: tuple(BLAST_DBS.get(flavour)!).default(BLAST_DBS.get(flavour)![0]),
});

/* ------------------------------------------------------------------ *
 * Per-flavour schemas
 * ------------------------------------------------------------------ */

export const blastpForm = z.object({
  ...baseShape,
  ...proteinScoringShape,
  ...flavourSpecifics("blastp"),
});

export const blastxForm = z.object({
  ...baseShape,
  ...proteinScoringShape,
  ...flavourSpecifics("blastx"),
});

export const tblastnForm = z.object({
  ...baseShape,
  ...proteinScoringShape,
  ...flavourSpecifics("tblastn"),
});

export const blastnForm = z.object({
  ...baseShape,
  ...nucleotideScoringShape,
  ...flavourSpecifics("blastn"),
  filterLowComplexity: z.boolean().default(true),
});

export const tblastxForm = z.object({
  ...baseShape,
  ...nucleotideScoringShape,
  ...flavourSpecifics("tblastx"),
  filterLowComplexity: z.boolean().default(true),
});

export type BlastpParameters = z.infer<typeof blastpForm>;
export type BlastxParameters = z.infer<typeof blastxForm>;
export type TblastnParameters = z.infer<typeof tblastnForm>;
export type BlastnParameters = z.infer<typeof blastnForm>;
export type TblastxParameters = z.infer<typeof tblastxForm>;

/** Discriminated union over `flavour` — used for server-side validation. */
export const blastParametersSchema = z.discriminatedUnion("flavour", [
  blastpForm,
  blastxForm,
  tblastnForm,
  blastnForm,
  tblastxForm,
]);

export type BlastParameters = z.infer<typeof blastParametersSchema>;
export type BlastForm =
  | typeof blastpForm
  | typeof blastxForm
  | typeof tblastnForm
  | typeof blastnForm
  | typeof tblastxForm;

export const BLASTFLAVOUR_FORMS = new Map<BlastFlavour, BlastForm>([
  ["blastp", blastpForm],
  ["blastn", blastnForm],
  ["blastx", blastxForm],
  ["tblastn", tblastnForm],
  ["tblastx", tblastxForm],
]);

/* ------------------------------------------------------------------ *
 * Form defaults & dropdown options
 * ------------------------------------------------------------------ */

const baseDefaults = {
  jobTitle: "",
  email: "",
  query: "",
  queryFrom: undefined,
  queryTo: undefined,
  maxTargetSeqs: 100,
  expectThreshold: 0.05,
  maxMatchesInQueryRange: 0,
  taxids: [] as string[],
  excludeTaxids: false,
  softMasking: false,
  lcaseMasking: false,
  filterLowComplexity: false,
  shortQueries: true,
};

const proteinScoringDefaults = {
  matrix: "BLOSUM62",
  wordSize: 5,
  gapCosts: "11,1",
  compositionalAdjustment: "Conditional compositional score matrix adjustment",
};

const nucleotideScoringDefaults = {
  wordSize: 11,
  matchMismatch: "2,-3",
  gapCosts: "5,2",
  filterLowComplexity: true,
};

function flavourDefaults(flavour: BlastFlavour) {
  return {
    flavour,
    program: PROGRAMS.get(flavour)![0],
    database: BLAST_DBS.get(flavour)![0],
  };
}

export const BLASTFLAVOUR_DEFAULTS: Record<BlastFlavour, BlastParameters> = {
  blastp: {
    ...baseDefaults,
    ...proteinScoringDefaults,
    ...flavourDefaults("blastp"),
  },
  blastx: {
    ...baseDefaults,
    ...proteinScoringDefaults,
    ...flavourDefaults("blastx"),
  },
  tblastn: {
    ...baseDefaults,
    ...proteinScoringDefaults,
    ...flavourDefaults("tblastn"),
  },
  blastn: {
    ...baseDefaults,
    ...nucleotideScoringDefaults,
    ...flavourDefaults("blastn"),
  },
  tblastx: {
    ...baseDefaults,
    ...nucleotideScoringDefaults,
    ...flavourDefaults("tblastx"),
  },
} as Record<BlastFlavour, BlastParameters>;

export type FieldOptions = {
  maxTargetSeqs: readonly number[];
  wordSize: readonly number[];
  gapCosts: readonly string[];
  matrix: readonly string[];
  matchMismatch: readonly string[];
  compositionalAdjustment: readonly string[];
};

const PROTEIN_OPTIONS: FieldOptions = {
  maxTargetSeqs: MAX_TARGET_SEQS,
  wordSize: PROTEIN_WORD_SIZES,
  gapCosts: PROTEIN_GAP_COSTS,
  matrix: PROTEIN_MATRICES,
  matchMismatch: MATCH_MISMATCH,
  compositionalAdjustment: COMPOSITIONAL_ADJUSTMENTS,
};

const NUCLEOTIDE_OPTIONS: FieldOptions = {
  maxTargetSeqs: MAX_TARGET_SEQS,
  wordSize: NUCLEOTIDE_WORD_SIZES,
  gapCosts: NUCLEOTIDE_GAP_COSTS,
  matrix: PROTEIN_MATRICES,
  matchMismatch: MATCH_MISMATCH,
  compositionalAdjustment: COMPOSITIONAL_ADJUSTMENTS,
};

/** Dropdown option lists for the algorithm-parameter selects, per flavour. */
export function getFieldOptions(flavour: BlastFlavour): FieldOptions {
  return flavour === "blastn" || flavour === "tblastx"
    ? NUCLEOTIDE_OPTIONS
    : PROTEIN_OPTIONS;
}

/* ------------------------------------------------------------------ *
 * Server-side validation
 * ------------------------------------------------------------------ */

export type ValidationResult =
  | { success: true; data: BlastParameters }
  | { success: false; error: z.ZodError };

/** Validates an untrusted parameter payload against the per-flavour schema. */
export function validateBlastParameters(input: unknown): ValidationResult {
  return blastParametersSchema.safeParse(input);
}
