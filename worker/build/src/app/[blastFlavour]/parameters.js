import * as Yup from "yup";
export const ALLOWED_FLAVOURS = ['blastp', 'blastx', 'blastn', 'tblastx', 'tblastn'];
export const NUCLEOTIDE_DBS = new Map([
    ["nt", "Nucleotide collection"],
    ["refseq_select_rna", "RefSeq Select RNA sequences"],
    ["refseq_rna", "Reference RNA sequences"],
    ["Representative_Genomes", "RefSeq representative genomes"],
    ["16S_ribosomal_RNA", "16S Ribosomal RNA"],
]);
export const PROTEIN_DBS = new Map([
    ["refseq_protein", "Reference proteins"],
    ["nr", "Non-redundant protein sequences"],
    ["landmark", "Model organisms"],
    ["refseq_select_prot", "RefSeq Select proteins"],
    ["swissprot", "UniProtKB/Swiss-Prot"],
]);
export const DB_NAMES = new Map([...PROTEIN_DBS, ...NUCLEOTIDE_DBS]);
export const BLAST_DBS = new Map([
    ["blastp", Array.from(PROTEIN_DBS.keys())],
    ["blastx", Array.from(PROTEIN_DBS.keys())],
    ["blastn", Array.from(NUCLEOTIDE_DBS.keys())],
    ["tblastx", Array.from(NUCLEOTIDE_DBS.keys())],
    ["tblastn", Array.from(NUCLEOTIDE_DBS.keys())],
]);
export const PROGRAMS = new Map([
    ["blastp", ["blastp"]],
    ["blastx", ["blastx"]],
    ["tblastn", ["tblastn"]],
    ["tblastx", ["tblastx"]],
    [
        "blastn",
        [
            "Megablast (Highly similar sequences)",
            "Discontiguous megablast (More dissimilar sequences)",
            "Blastn (Somewhat similar sequences)",
        ],
    ],
]);
function numberTransform(_unused, val) {
    return val !== "" ? Number(val) : null;
}
function getFlavourSpecifics(flavour) {
    return {
        flavour: Yup.string().oneOf([flavour]).default(flavour).defined(),
        program: Yup.string()
            .oneOf(PROGRAMS.get(flavour))
            .default(PROGRAMS.get(flavour)[0])
            .defined(),
        database: Yup.string()
            .oneOf(BLAST_DBS.get(flavour))
            .default(BLAST_DBS.get(flavour)[0])
            .defined(),
    };
}
const baseForm = Yup.object().shape({
    jobTitle: Yup.string().notRequired(),
    email: Yup.string().notRequired(),
    query: Yup.string()
        .max(10e4)
        .trim()
        .defined("Query is required")
        .test("is-not-multifasta", "Query contains multiple FASTA sequences", (value) => (value.match(/>/g) || []).length < 2)
        .test("is-not-short", "Query is shorter than 25 characters", (value) => value.length >= 25)
        .test("is-not-long", "Query is longer than 10,000 characters", (value) => value.length <= 10000),
    queryFrom: Yup.number()
        .notRequired()
        .moreThan(0, "Query FROM cannot be negative")
        .transform(numberTransform),
    queryTo: Yup.number()
        .notRequired()
        .moreThan(0, "Query TO cannot be negative")
        .transform(numberTransform),
    maxTargetSeqs: Yup.number()
        .required("Must specify maximum number of target sequences")
        .oneOf([10, 50, 100, 250, 500, 1000, 5000])
        .defined()
        .default(100)
        .transform(numberTransform),
    expectThreshold: Yup.number()
        .required("Must specify an expect threshold")
        .moreThan(0, "Expect threshold cannot be negative")
        .default(0.05)
        .defined()
        .transform(numberTransform),
    maxMatchesInQueryRange: Yup.number()
        .notRequired()
        .moreThan(-1, "Max. matches in query range cannot be negative")
        .default(0)
        .defined()
        .transform(numberTransform),
    taxids: Yup.array().of(Yup.string().required()).default([]).defined(),
    excludeTaxids: Yup.boolean().default(false).defined(),
    softMasking: Yup.boolean().default(false).defined(),
    lcaseMasking: Yup.boolean().default(false).defined(),
    filterLowComplexity: Yup.boolean().default(false).defined(),
    shortQueries: Yup.boolean().default(true).defined(),
});
const blastpForm = Yup.object()
    .concat(baseForm)
    .shape({
    flavour: Yup.string().oneOf(["blastp"]).default("blastp").defined(),
    database: Yup.string()
        .oneOf(BLAST_DBS.get("blastp"))
        .default(BLAST_DBS.get("blastp")[0])
        .defined(),
    matrix: Yup.string()
        .oneOf([
        "PAM30",
        "PAM70",
        "PAM250",
        "BLOSUM45",
        "BLOSUM50",
        "BLOSUM62",
        "BLOSUM80",
        "BLOSUM90",
    ])
        .default("BLOSUM62")
        .defined(),
    wordSize: Yup.number()
        .oneOf([2, 3, 5, 6])
        .default(5)
        .defined()
        .transform(numberTransform),
    program: Yup.string().oneOf(["blastp"]).default("blastp").defined(),
    gapCosts: Yup.string()
        .oneOf([
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
    ])
        .default("11,1")
        .defined(),
    compositionalAdjustment: Yup.string()
        .oneOf([
        "No adjustment",
        "Compositon-based statistics",
        "Conditional compositional score matrix adjustment",
        "Universal compositional score matrix adjustment",
    ])
        .default("Conditional compositional score matrix adjustment")
        .defined(),
});
const blastnForm = Yup.object()
    .concat(baseForm)
    .shape({
    flavour: Yup.string().oneOf(["blastn"]).default("blastn").defined(),
    program: Yup.string()
        .oneOf(PROGRAMS.get("blastn"))
        .default(PROGRAMS.get("blastn")[0])
        .defined(),
    database: Yup.string()
        .oneOf(BLAST_DBS.get("blastn"))
        .default(BLAST_DBS.get("blastn")[0])
        .defined(),
    wordSize: Yup.number()
        .oneOf([16, 20, 24, 28, 32, 48, 64, 128, 256])
        .default(28)
        .defined(),
    matchMismatch: Yup.string()
        .oneOf(["1,-2", "1,-3", "1,-4", "2,-3", "4,-5", "1,-1"])
        .default("1,-2")
        .defined(),
    gapCosts: Yup.string()
        .oneOf(["linear", "5,2", "2,2", "1,2", "0,2", "3,1", "2,1", "1,1"])
        .default("linear")
        .defined(),
});
const blastxForm = Yup.object()
    .concat(blastpForm)
    .shape(getFlavourSpecifics("blastx"));
const tblastnForm = Yup.object()
    .concat(blastpForm)
    .shape(getFlavourSpecifics("tblastn"));
const tblastxForm = Yup.object()
    .concat(blastnForm)
    .shape(getFlavourSpecifics("tblastx"));
export const BLASTFLAVOUR_FORMS = new Map([
    ["blastp", blastpForm],
    ["blastn", blastnForm],
    ["blastx", blastxForm],
    ["tblastn", tblastnForm],
    ["tblastx", tblastxForm],
]);