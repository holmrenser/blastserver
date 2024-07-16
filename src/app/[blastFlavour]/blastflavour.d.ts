// export const ALLOWED_FLAVOURS = ['blastp','blastx','blastn','tblastx','tblastn'] as const;
export const ALLOWED_FLAVOURS = ['blastp', 'tblastn', 'blastn'] as const;
export type BlastFlavour = typeof ALLOWED_FLAVOURS[number];

interface BaseForm {
  program: string;
  query: string;
  queryFrom?: number;
  queryTo?: number;
  jobTitle?: string;
  email?: string;
  database: string;
  organism?: string;
  maxTargetSeqs: 10 | 50 | 100 | 250 | 500 | 1000 | 5000;
  shortQueries: boolean;
  expectThreshold: number;
  maxMatchesInQueryRange?: number;
  gapCosts: string;
  taxids?: string[];
  excludeTaxids?: boolean;
  filterLowComplexity?: boolean;
  lcaseMasking?: boolean;
  softMasking?: boolean;
}

interface BlastpForm extends BaseForm {
  flavour: 'blastp';
  wordSize: 2 | 3 | 5 | 6;
  matrix: string;
  compositionalAdjustment: string;
}

interface BlastnForm extends BaseForm {
  flavour: 'blastn';
  wordSize: 16 | 20 | 24 | 28 | 32 | 48 | 64 | 128 | 256;
  matchMismatchScore: string;
}

interface BlastxForm extends BaseForm {
  flavour: 'blastx';
}

interface TblastnForm extends BaseForm {
  flavour: 'tblastn';
}

interface TblastxForm extends BaseForm  {
  flavour: 'tblastx';
}

export type FormData<flavour extends BlastFlavour> = BlastpForm | BlastnForm | BlastxForm | TblastnForm | TblastxForm;
