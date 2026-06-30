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
