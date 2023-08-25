export const ALLOWED_FLAVOURS = ['blastp','blastx','blastn','tblastx','tblastn'] as const;
export type BlastFlavour = typeof ALLOWED_FLAVOURS[number];

type BaseForm = {
  program: string;
  query: string;
  queryFrom?: number;
  queryTo?: number;
  jobTitle?: string;
  email?: string;
  database: string;
  organism?: string;
  // program: BlastFlavour;
  maxTargetSeqs: 10 | 50 | 100 | 250 | 500 | 1000 | 5000;
  shortQueries: boolean;
  expectThreshold: number;
  // wordSize: 2 | 3 | 5 | 6;
  maxMatchesInQueryRange?: number;
  // matrix: string;
  gapCosts: string;
  // compositionalAdjustment: string;
  taxids?: string[];
  excludeTaxids?: boolean;
  filterLowComplexity?: boolean;
  lcaseMasking?: boolean;
  softMasking?: boolean;
}

type BlastpForm = BaseForm & {
  flavour: 'blastp';
  wordSize: 2 | 3 | 5 | 6;
  matrix: string;
  compositionalAdjustment: string;
}

type BlastnForm = BaseForm & {
  flavour: 'blastn';
  wordSize: 16 | 20 | 24 | 28 | 32 | 48 | 64 | 128 | 256;
  matchMismatchScore: string;
}

type BlastxForm = BaseForm & {
  flavour: 'blastx';
}

type TblastnForm = BaseForm & {
  flavour: 'tblastn';
}

type TblastxForm = BaseForm & {
  flavour: 'tblastx';
}

export type FormData<flavour extends BlastFlavour> = BlastpForm | BlastnForm | BlastxForm | TblastnForm | TblastxForm;
