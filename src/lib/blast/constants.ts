// Zod-free BLAST domain constants. Kept separate from schema.ts so the workers
// (compiled with tsconfig.worker.json, which maps "@/" to ./worker) can import
// the allowlists without pulling in zod or the "@/" alias.

export const ALLOWED_FLAVOURS = [
  "blastp",
  "blastx",
  "blastn",
  "tblastx",
  "tblastn",
] as const;

export type BlastFlavour = (typeof ALLOWED_FLAVOURS)[number];

export const NUCLEOTIDE_DBS = new Map<string, string>([
  ["core_nt", "Core nucleotide database"],
  ["nt", "Nucleotide collection"],
  ["refseq_select_rna", "RefSeq Select RNA sequences"],
  ["refseq_rna", "Reference RNA sequences"],
  ["Representative_Genomes", "RefSeq representative genomes"],
  ["16S_ribosomal_RNA", "16S Ribosomal RNA"],
]);

export const PROTEIN_DBS = new Map<string, string>([
  ["nr", "Non-redundant protein sequences"],
  ["clustered_nr", "Clustered non-redundant protein sequences"],
  ["refseq_select_prot", "RefSeq Select proteins"],
  ["refseq_protein", "Reference proteins"],
  ["landmark", "Model organisms"],
  ["swissprot", "UniProtKB/Swiss-Prot"],
  ["pataa", "Patented protein sequences"],
  ["pdbaa", "Protein Data Bank proteins"],
  ["env_nr", "Metagenomic proteins"],
  ["tsa_nr", "Transcriptome Shotgun Assembly proteins"],
]);

export const DB_NAMES = new Map<string, string>([
  ...PROTEIN_DBS,
  ...NUCLEOTIDE_DBS,
]);

// Databases whose hits are sequence clusters (one hit = one cluster). For these,
// member lists + the per-cluster LCA come from Postgres (cluster_lca/cluster_member),
// joined by the representative accession — the BLAST XML doesn't carry them.
export const CLUSTERED_DBS = new Set<string>(["clustered_nr"]);

/** True when `database` returns cluster hits needing member/LCA enrichment. */
export function isClusteredDatabase(database: string): boolean {
  return CLUSTERED_DBS.has(database);
}

export const BLAST_DBS = new Map<BlastFlavour, string[]>([
  ["blastp", Array.from(PROTEIN_DBS.keys())],
  ["blastx", Array.from(PROTEIN_DBS.keys())],
  ["blastn", Array.from(NUCLEOTIDE_DBS.keys())],
  [
    "tblastx",
    Array.from(NUCLEOTIDE_DBS.keys()).filter((db) => db !== "16S_ribosomal_RNA"),
  ],
  [
    "tblastn",
    Array.from(NUCLEOTIDE_DBS.keys()).filter((db) => db !== "16S_ribosomal_RNA"),
  ],
]);

export const PROGRAMS = new Map<BlastFlavour, string[]>([
  ["blastp", ["blastp"]],
  ["blastx", ["blastx"]],
  ["tblastn", ["tblastn"]],
  ["tblastx", ["tblastx"]],
  [
    "blastn",
    [
      "Blastn (Somewhat similar sequences)",
      "Megablast (Highly similar sequences)",
      "Discontiguous megablast (More dissimilar sequences)",
    ],
  ],
]);

/** True when `flavour` is an allowed BLAST executable name. */
export function isAllowedFlavour(flavour: unknown): flavour is BlastFlavour {
  return (
    typeof flavour === "string" &&
    (ALLOWED_FLAVOURS as readonly string[]).includes(flavour)
  );
}

/** True when `database` is a known BLAST database for the given flavour. */
export function isAllowedDatabase(
  flavour: BlastFlavour,
  database: unknown
): database is string {
  return (
    typeof database === "string" &&
    (BLAST_DBS.get(flavour) ?? []).includes(database)
  );
}

/* ------------------------------------------------------------------ *
 * Compositional adjustment (protein comp-based statistics)
 * ------------------------------------------------------------------ */

// Lives here (zod-free) rather than in schema.ts so the worker can map the UI
// string to a BLAST+ flag without importing zod. schema.ts re-exports it.
export const COMPOSITIONAL_ADJUSTMENTS = [
  "No adjustment",
  "Compositon-based statistics",
  "Conditional compositional score matrix adjustment",
  "Universal compositional score matrix adjustment",
] as const;

// UI compositional-adjustment label -> BLAST+ `-comp_based_stats` integer code.
// Keyed by `string` (not the literal union) because the validated schema value is
// typed `string`; every COMPOSITIONAL_ADJUSTMENTS entry is present.
export const COMP_BASED_STATS: Record<string, "0" | "1" | "2" | "3"> = {
  "No adjustment": "0",
  "Compositon-based statistics": "1",
  "Conditional compositional score matrix adjustment": "2",
  "Universal compositional score matrix adjustment": "3",
};

/* ------------------------------------------------------------------ *
 * Blastn program presets (map to BLAST+ -task)
 * ------------------------------------------------------------------ */

// The blastn "Optimize for" program selector chooses a search preset. NCBI's form
// ties each preset to a set of scoring defaults (word size / match-mismatch / gap
// costs) and their option lists; selecting a program updates those fields. The
// `task` is the BLAST+ `-task` value the worker passes.
export const BLASTN_WORD_SIZES = [7, 11, 15] as const;
export const MEGABLAST_WORD_SIZES = [16, 20, 24, 28, 32, 48, 64] as const;
export const DC_MEGABLAST_WORD_SIZES = [11, 12] as const;

// Discontiguous megablast uses a spaced seed ("discontiguous word") whose shape is
// set by two extra options that only apply to the dc-megablast task. `-template_type`
// picks the match pattern (coding = 110-repeat that ignores every third/wobble base;
// optimal = pattern tuned to minimise word correlation; coding_and_optimal seeds from
// both). `-template_length` is the pattern length. The two BLAST+ flags require each
// other. Values/defaults follow NCBI's blastn form (default coding / 18).
export const TEMPLATE_TYPES = ["coding", "optimal", "coding_and_optimal"] as const;
export const TEMPLATE_LENGTHS = [16, 18, 21] as const;
export const DEFAULT_TEMPLATE_TYPE: (typeof TEMPLATE_TYPES)[number] = "coding";
export const DEFAULT_TEMPLATE_LENGTH = 18;

// UI labels for the `-template_type` values (keyed by `string`, matching the
// validated schema value's type). The stored/emitted value is the BLAST+ token.
export const TEMPLATE_TYPE_LABELS: Record<string, string> = {
  coding: "Coding",
  optimal: "Optimal",
  coding_and_optimal: "Coding and optimal",
};

export interface BlastnPreset {
  /** BLAST+ `-task` value for this preset. */
  task: "megablast" | "dc-megablast" | "blastn";
  /** Word-size dropdown options shown for this preset. */
  wordSizes: readonly number[];
  /** Default word size when this preset is selected. */
  wordSize: number;
  /** Default match/mismatch ("reward,penalty") for this preset. */
  matchMismatch: string;
  /** Default gap costs for this preset. */
  gapCosts: string;
  /** Default discontiguous-word template type — only the dc-megablast preset has one. */
  templateType?: (typeof TEMPLATE_TYPES)[number];
  /** Default discontiguous-word template length — only the dc-megablast preset has one. */
  templateLength?: number;
}

// Keyed by the exact `program` strings in PROGRAMS.get("blastn").
export const BLASTN_TASK_PRESETS: Record<string, BlastnPreset> = {
  "Megablast (Highly similar sequences)": {
    task: "megablast",
    wordSizes: MEGABLAST_WORD_SIZES,
    wordSize: 28,
    matchMismatch: "1,-2",
    gapCosts: "linear",
  },
  "Discontiguous megablast (More dissimilar sequences)": {
    task: "dc-megablast",
    wordSizes: DC_MEGABLAST_WORD_SIZES,
    wordSize: 11,
    matchMismatch: "2,-3",
    gapCosts: "5,2",
    templateType: DEFAULT_TEMPLATE_TYPE,
    templateLength: DEFAULT_TEMPLATE_LENGTH,
  },
  "Blastn (Somewhat similar sequences)": {
    task: "blastn",
    wordSizes: BLASTN_WORD_SIZES,
    wordSize: 11,
    matchMismatch: "2,-3",
    gapCosts: "5,2",
  },
};

/** Blastn `program` string -> BLAST+ `-task` value. Derived from the presets. */
export const BLASTN_TASKS: Record<string, BlastnPreset["task"]> =
  Object.fromEntries(
    Object.entries(BLASTN_TASK_PRESETS).map(([program, p]) => [program, p.task])
  );
