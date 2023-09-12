'use client';

import React from 'react';
import { notFound } from 'next/navigation';
import { useForm } from 'react-hook-form';
import type { FieldErrors, Control, UseFormRegister } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup';
import * as Yup from 'yup';

import { TaxonomySelect } from './taxonomyselect';
import './blastFlavour.scss';
import type { BlastFlavour, FormData } from './blastflavour';
//@ts-ignore
import { ALLOWED_FLAVOURS } from './blastflavour.d.ts';

const NUCLEOTIDE_DBS = new Map<string, string>([
  ['nt','Nucleotide collection'],
  ['refseq_select_rna', 'RefSeq Select RNA sequences'],
  ['refseq_rna', 'Reference RNA sequences'],
  ['Representative_Genomes', 'RefSeq representative genomes'],
  ['16S_ribosomal_RNA', '16S Ribosomal RNA'],
])
const PROTEIN_DBS = new Map<string, string>([
  ['refseq_protein', 'Reference proteins'],
  ['nr', 'Non-redundant protein sequences'],
  ['landmark', 'Model organisms'],
  ['refseq_select_prot', 'RefSeq Select proteins'],
  ['swissprot', 'UniProtKB/Swiss-Prot'],
])

const DB_NAMES = new Map<string, string>([...PROTEIN_DBS, ...NUCLEOTIDE_DBS])

const BLAST_DBS = new Map<BlastFlavour, string[]>([
  ['blastp', Array.from(PROTEIN_DBS.keys())],
  ['blastx', Array.from(PROTEIN_DBS.keys())],
  ['blastn', Array.from(NUCLEOTIDE_DBS.keys())],
  ['tblastx', Array.from(NUCLEOTIDE_DBS.keys())],
  ['tblastn', Array.from(NUCLEOTIDE_DBS.keys())]
])

const PROGRAMS = new Map<BlastFlavour, string[]>([
  //[
  //'blastp', [
  //  'Quick BLASTP (Accelerated protein-protein BLAST)',
  //  'blastp (protein-protein BLAST)'
  //]],
  ['blastn', [
    'Megablast (Highly similar sequences)',
    'Discontiguous megablast (More dissimilar sequences)',
    'Blastn (Somewhat similar sequences)'
  ]]])

function numberTransform(_unused: any, val: string){
  return val !== '' ? Number(val): null
}

const baseForm = Yup.object().shape({
  jobTitle: Yup.string().notRequired(),
  email: Yup.string().notRequired(),
  query: Yup.string()
    .required('Query is required')
    .max(10e4)
    .trim()
    .test(
      'is-not-multifasta',
      'Query contains multiple FASTA sequences',
      (value, context) => (value.match(/>/g) || []).length < 2
    )
    .test(
      'is-not-short',
      'Query is shorter than 25 characters',
      (value, context) => value.length >= 25
    )
    .test(
      'is-not-long',
      'Query is longer than 10,000 characters',
      (value, context) => value.length <= 10_000
    ),
  queryFrom: Yup.number()
    .notRequired()
    .moreThan(0, 'Query FROM cannot be negative')
    .transform(numberTransform),
  queryTo: Yup.number()
    .notRequired()
    .moreThan(0, 'Query TO cannot be negative')
    .transform(numberTransform),
  maxTargetSeqs: Yup.number()
    .required('Must specify maximum number of target sequences')
    .oneOf([10, 50, 100, 250, 500, 1000, 5000])
    .required()
    .default(100)
    .transform(numberTransform),
  expectThreshold: Yup.number()
    .required('Must specify an expect threshold')
    .moreThan(0, 'Expect threshold cannot be negative')
    .default(0.05)
    .required()
    .transform(numberTransform),
  maxMatchesInQueryRange: Yup.number()
    .notRequired()
    .moreThan(-1, 'Max. matches in query range cannot be negative')
    .default(0)
    .required()
    .transform(numberTransform),
  taxids: Yup.array()
    .of(Yup.string())
    .default([])
    .required(),
  excludeTaxids: Yup.boolean()
    .default(false)
    .required(),
  softMasking: Yup.boolean()
    .default(false)
    .required(),
  lcaseMasking: Yup.boolean()
    .default(false)
    .required(),
  filterLowComplexity: Yup.boolean()
    .default(false)
    .required(),
  shortQueries: Yup.boolean()
    .default(true)
    .required(),
  compositionalAdjustment: Yup.string()
    .oneOf( ['No adjustment','Compositon-based statistics',
    'Conditional compositional score matrix adjustment',
  'Universal compositional score matrix adjustment'])
    .default('Conditional compositional score matrix adjustment')
    .notRequired()
})

const blastpForm = Yup.object().shape({
  flavour: Yup.string()
    .oneOf(['blastp'])
    .default('blastp')
    .required(),
  database: Yup.string()
    .oneOf(BLAST_DBS.get('blastp')!)
    .default(BLAST_DBS.get('blastp')![0])
    .required(),
  matrix: Yup.string()
    .oneOf(['PAM30', 'PAM70', 'PAM250', 'BLOSUM45', 'BLOSUM50', 'BLOSUM62', 'BLOSUM80', 'BLOSUM90'])
    .default('BLOSUM62')
    .required(),
  wordSize: Yup.number()
    .oneOf([2, 3, 5, 6])
    .default(5)
    .required()
    .transform(numberTransform),
  program: Yup.string()
    .oneOf(['blastp'])
    .default('blastp')
    .required(),
  gapCosts: Yup.string()
    .oneOf(['11,2','10,2','9,2','8,2','7,2','6,2','13,1','12,1','11,1','10,1','9,1'])
    .default('11,1')
    .required()
}).concat(baseForm)

interface BlastpParameters extends Yup.InferType<typeof blastpForm>{}

const blastnForm = Yup.object().shape({
  flavour: Yup.string()
    .oneOf(['blastn'])
    .default('blastn')
    .required(),
  database: Yup.string()
    .oneOf(BLAST_DBS.get('blastn')!)
    .default(BLAST_DBS.get('blastn')![0])
    .required(),
  wordSize: Yup.number()
    .oneOf([16, 20, 24, 28, 32, 48, 64, 128, 256])
    .default(28)
    .defined(),
  matchMismatch: Yup.string()
    .oneOf(['1,-2','1,-3','1,-4','2,-3','4,-5','1,-1'])
    .default('1,-2')
    .defined(),
  gapCosts: Yup.string()
    .oneOf(['linear', '5,2','2,2','1,2','0,2','3,1','2,1','1,1'])
    .default('linear')
    .required()
}).concat(baseForm);

interface BlastnParameters extends Yup.InferType<typeof blastnForm>{};

const tblastnForm = Yup.object().shape({
  flavour: Yup.string()
    .oneOf(['tblastn'])
    .default('tblastn')
    .required(),
  database: Yup.string()
    .oneOf(BLAST_DBS.get('tblastn')!)
    .default(BLAST_DBS.get('tblastn')![0])
    .required(),
    matrix: Yup.string()
    .oneOf(['PAM30', 'PAM70', 'PAM250', 'BLOSUM45', 'BLOSUM50', 'BLOSUM62', 'BLOSUM80', 'BLOSUM90'])
    .default('BLOSUM62')
    .required(),
  wordSize: Yup.number()
    .oneOf([2, 3, 5, 6])
    .default(5)
    .required()
    .transform(numberTransform),
  program: Yup.string()
    .oneOf(['tblastn'])
    .default('tblastn')
    .required(),
  gapCosts: Yup.string()
    .oneOf(['11,2','10,2','9,2','8,2','7,2','6,2','13,1','12,1','11,1','10,1','9,1'])
    .default('11,1')
    .required()
}).concat(baseForm);

interface TblastnParameters extends Yup.InferType<typeof tblastnForm>{};

export type BlastParameters = BlastpParameters | BlastnParameters | TblastnParameters;

type BlastForm = typeof blastpForm | typeof blastnForm | typeof tblastnForm;

const BLASTFLAVOUR_FORMS = new Map<BlastFlavour, BlastForm>([
  ['blastp', blastpForm],
  ['blastn', blastnForm],
  ['tblastn', tblastnForm]
])

function EnterQuery({
  register,
  errors,
  formDescription,
}: {
  register: UseFormRegister<BlastParameters>,
  errors: FieldErrors,
  formDescription: Yup.SchemaObjectDescription,
}){
  return (
    <fieldset className='box'>
      <legend className='label has-text-centered'>Enter Query Sequence</legend>
      
      <div className="field">
        <div className='field-body'>
          <div className='field'>
            <label className="label">Enter (single) FASTA sequence</label>
            <div className="control">
              <textarea
                className={`textarea is-small ${errors.query?.message ? 'is-danger' : ''}`}
                placeholder="QUERY SEQUENCE"
                {...register('query')} />
            </div>
            {
              errors.query && (
                <p className='help is-danger'>
                  {String(errors.query?.message)}
                </p>
              )
            }
          </div>

          <div className='field'>
            <label className='label'>Query subrange</label>
            <div className='field is-horizontal'>
              <div className='field-label is-small'>
                <label className="label">From</label>
              </div>
              <div className='field-body'>
                <div className='field'>
                  <div className="control">
                    <input
                      className={`input is-small ${errors.queryFrom?.message ? 'is-danger' : ''}`}
                      placeholder="FROM"
                      style={{ maxWidth: 120 }}
                      {...register('queryFrom')} />
                  </div>
                </div>
              </div>
            </div>

            <div className='field is-horizontal' style={{ paddingTop: '.75em' }}>
              <div className='field-label is-small'>
                <label className="label">To</label>
              </div>
              <div className='field-body'>
                <div className='field'>
                  <div className="control">
                    <input
                      className={`input is-small ${errors.queryTo?.message ? 'is-danger' : ''}`}
                      placeholder="TO"
                      type='text'
                      style={{ maxWidth: 120 }}
                      {...register('queryTo')} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className='field is-horizontal'>
        <div className="field-label is-small">
          <label className="label">Job Title</label>
        </div>
        <div className="field-body">
          <div className="field">
            <div className="control">
              <input 
                className="input is-small"
                type="text"
                placeholder="JOBTITLE"
                style={{ maxWidth: 240 }}
                disabled 
                {...register('jobTitle')}
              />
            </div>
          </div>
        </div>
      </div>

      <div className='field is-horizontal'>
        <div className="field-label is-small">
          <label className="label">E-mail address</label>
        </div>
        <div className="field-body">
          <div className="field">
            <div className="control">
              <input
                className="input is-small"
                type="text"
                placeholder="JOHN@DOE.COM"
                style={{ maxWidth: 240 }}
                disabled
                {...register('email')}
              />
            </div>
          </div>
        </div>
      </div>
    </fieldset>
  )
}

function ChooseSearchSet({
  register,
  errors,
  blastFlavour,
  control,
  formDescription,
}: {
  register: UseFormRegister<BlastParameters>,
  errors: FieldErrors,
  blastFlavour: BlastFlavour,
  control: Control<BlastParameters>,
  formDescription: Yup.SchemaObjectDescription,
}) {
  const dbOptions = BLAST_DBS.get(blastFlavour);
  return (
    <fieldset className='box'>
      <legend className='label has-text-centered'>Choose Search Set</legend>
      
      <div className='field is-horizontal'>
        <div className="field-label is-small">
          <label className="label">Database</label>
        </div>
        <div className="field-body">
          <div className="field">
            <div className="control" >
              <div className={`select is-small ${errors.database?.message ? 'is-danger' : ''}`}>
                <select {...register('database')} style={{ minWidth: 400}}>
                  {
                    dbOptions && dbOptions.map(db => (
                      <option key={db} value={db}>
                        {`${DB_NAMES.get(db)} (${db})`}
                      </option>
                    ))
                  }
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className='field is-horizontal'>
        <div className="field-label is-small">
          <label className="label">Organism</label>
        </div>
        <div className="field-body">
          <div className="field">
            <div className="control">
              <TaxonomySelect control={control} register={register}/>
            </div>
            <p className='help'>Select one or more taxonomy levels to limit or exclude</p>
          </div>
        </div>
        
      </div>
    </fieldset>
  )
}

function ProgramSelection({
  blastFlavour,
  register,
  errors,
  getValues,
  formDescription,
}: {
  blastFlavour: BlastFlavour,
  register: UseFormRegister<BlastParameters>,
  errors: FieldErrors,
  getValues: Function,
  formDescription: Yup.SchemaObjectDescription,
}){
  if (!PROGRAMS.has(blastFlavour)) return null
  const selectedProgram = 'Blastn (Somewhat similar sequences)' //getValues('program');
  return (
    <fieldset className='box'>
      <legend className='label has-text-centered'>Program Selection</legend>

      <div className='field is-horizontal'>
        <div className="field-label is-small">
          <label className="label">Optimize for</label>
        </div>
        <div className="field-body">
          <div className="field">
            <div className="control">
              {
                PROGRAMS.get(blastFlavour)?.map((program:string) => (
                  <React.Fragment key={program}>
                  {/*@ts-ignore*/}
                  <label disabled className="radio is-small">
                    <input
                      disabled
                      type="radio"
                      checked={program === selectedProgram}
                      {...register('program')} />
                    &nbsp;
                    {program}
                  </label>
                  <br/>
                  </React.Fragment>
                ))
              }
              
            </div>
          </div>
        </div>
      </div>
    </fieldset>
  )
}

function SubmitButton({
  register,
  errors,
  getValues,
  watch,
  formDescription,
}: {
  register: UseFormRegister<BlastParameters>,
  errors: FieldErrors,
  getValues: Function,
  watch: Function,
  formDescription: Yup.SchemaObjectDescription,
}) {
  const db = watch('database');
  const program = getValues('program');
  return (
    <div className='container box'>
      <div className='tile is-ancestor'>
        <div className='tile is-parent'>
          <div className='tile is-child is-2'>
            <div className="field">
              <div className="control">
                <button type='submit' className="button is-info">BLAST</button>
              </div>
            </div>
          </div>
          <div className='tile is-child'>
            <p>Search database <em>{db}</em> using <em>{program}</em></p>
          </div>
        </div>
      </div>
    </div>
  )
}

function AlgorithmParameters({
  register,
  errors,
  getValues,
  formDescription,
  blastFlavour
}: {
  register: UseFormRegister<BlastParameters>,
  errors: FieldErrors,
  getValues: Function,
  formDescription: Yup.SchemaObjectDescription,
  blastFlavour: BlastFlavour
}) {
  const { fields } = formDescription;

  return (
    <div className='panel is-info'>
      <p className='panel-heading'>Algorithm parameters</p>
      <div className='panel-block algorithm-parameters'>
        <fieldset className='box'>
          <legend className='label has-text-centered'>General Parameters</legend>

          <div className='field is-horizontal'>
            <div className="field-label is-small">
              <label className="label">Max target sequences</label>
            </div>
            <div className="field-body">
              <div className="field">
                <div className="control">
                <div className="select is-small">
                  <select style={{ width: 80 }} {...register('maxTargetSeqs')}>
                    { 
                      //@ts-ignore
                      fields.maxTargetSeqs.oneOf.map(n_targets => (
                        <option key={n_targets}>{n_targets}</option>
                      ))
                    }
                  </select>
                </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className='field is-horizontal'>
            <div className="field-label is-small">
              <label className="label">Short queries</label>
            </div>
            <div className="field-body">
              <div className="field">
                <div className="control">
                  <label className='checkbox'>
                    <input type='checkbox' {...register('shortQueries')} />
                    Automatically adjust parameters for short input sequences
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className='field is-horizontal'>
            <div className="field-label is-small">
              <label className="label">Expect threshold</label>
            </div>
            <div className="field-body">
              <div className="field">
                <div className="control">
                  <input
                    className='input is-small'
                    type='text'
                    style={{ width: 80 }}
                    {...register('expectThreshold')}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className='field is-horizontal'>
            <div className="field-label is-small">
              <label className="label">Word size</label>
            </div>
            <div className="field-body">
              <div className="field">
                <div className="control">
                <div className="select is-small">
                  <select {...register('wordSize')} style={{ width: 80 }}>
                    {
                      //@ts-ignore
                      fields.wordSize.oneOf.map(wordSize => (
                        <option key={wordSize}>{wordSize}</option>
                      ))
                    }
                  </select>
                </div>
                </div>
              </div>
            </div>
          </div>

          <div className='field is-horizontal'>
            <div className="field-label is-small">
              <label className="label">Max. matches in a query range</label>
            </div>
            <div className="field-body">
              <div className="field">
                <div className="control">
                  <input
                    className='input is-small'
                    type='text'
                    style={{ width: 80 }}
                    {...register('maxMatchesInQueryRange')}
                    disabled
                    defaultValue={0}
                  />
                </div>
              </div>
            </div>
          </div>


        </fieldset>
      
        <fieldset className='box'>
          <legend className='label has-text-centered'>Scoring Parameters</legend>
          
          {
            ['blastp','tblastn'].indexOf(blastFlavour) >= 0 &&
              <div className='field is-horizontal'>
                <div className="field-label is-small">
                  <label className="label">Matrix</label>
                </div>
                <div className="field-body">
                  <div className="field">
                    <div className="control">
                    <div className="select is-small">
                      <select style={{ width: 140 }} {...register('matrix')}>
                        {
                          //@ts-ignore
                          fields.matrix.oneOf.map(wordSize => (
                            <option key={wordSize}>{wordSize}</option>
                          ))
                        }
                      </select>
                    </div>
                    </div>
                  </div>
                </div>
              </div>
          }
          {
            ['blastn'].indexOf(blastFlavour) >= 0 &&
            <div className='field is-horizontal'>
                <div className="field-label is-small">
                  <label className="label">Match/Mismatch Scores</label>
                </div>
                <div className="field-body">
                  <div className="field">
                    <div className="control">
                    <div className="select is-small">
                      <select style={{ width: 140 }} {...register('matchMismatch')}>
                        {
                          //@ts-ignore
                          fields.matchMismatch.oneOf.map(match => (
                            <option key={match}>{match}</option>
                          ))
                        }
                      </select>
                    </div>
                    </div>
                  </div>
                </div>
              </div>
          }
          <div className='field is-horizontal'>
            <div className="field-label is-small">
              <label className="label">Gap costs</label>
            </div>
            <div className="field-body">
              <div className="field">
                <div className="control">
                <div className="select is-small">
                  <select style={{ width: 140 }} {...register('gapCosts')}>
                    { 
                      //@ts-ignore
                      fields['gapCosts'].oneOf.map(gapCost => {
                        const [gapOpen,gapExtend] = gapCost.split(',');
                        return (
                          <option key={gapCost}>
                            {gapCost}
                          </option>
                        )
                      })
                    }
                  </select>
                </div>
                </div>
              </div>
            </div>
          </div>
          
          { 
            ['blastp','tblastn'].indexOf(blastFlavour) >= 0 &&
            <div className='field is-horizontal'>
              <div className="field-label is-small">
                <label className="label">Compositional adjustment</label>
              </div>
              <div className="field-body">
                <div className="field">
                  <div className="control">
                  <div className="select is-small">
                    <select
                      disabled
                      {...register('compositionalAdjustment')}
                    >
                      {
                        //@ts-ignore
                        fields['compositionalAdjustment'].oneOf.map(adjustment => (
                          <option key={adjustment}>{adjustment}</option>
                        ))
                      }
                    </select>
                  </div>
                  </div>
                </div>
              </div>
            </div>
          }
        </fieldset>
        <fieldset className='box'>
          <legend className='label has-text-centered'>Filters and masking</legend>

          <div className='field is-horizontal'>
            <div className="field-label is-small">
              <label className="label">Filter</label>
            </div>
            <div className="field-body">
              <div className="field">
                <div className="control">
                  {/*@ts-ignore*/}
                  <label disabled className='checkbox'>
                    <input
                      disabled
                      type='checkbox'
                      {...register('filterLowComplexity')}
                    />
                    Low complexity regions
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className='field is-horizontal'>
            <div className="field-label is-small">
              <label className="label">Mask</label>
            </div>
            <div className="field-body">
              <div className="field">
                <div className="control">
                  {/*//@ts-ignore*/}
                  <label className='checkbox' disabled>
                    <input type='checkbox' disabled />
                    Mask for lookup table only
                  </label>
                </div>
              </div>
            </div>
          </div>
        
        <div className='field is-horizontal'>
          <div className="field-label is-small">
              <label className="label"></label>
            </div>
          <div className="field-body">
              <div className="field">
                <div className="control">
                  <label className='checkbox'>
                    <input type='checkbox' {...register('lcaseMasking')} />
                    Mask lower case letters
                  </label>
                </div>
              </div>
            </div>
          </div>

        </fieldset>
      </div>
    </div>
  )
}

export default function BlastFlavourPage({ params }:{ params:{ blastFlavour: BlastFlavour }}) {
  const { blastFlavour } = params;
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH;
  if (ALLOWED_FLAVOURS.indexOf(blastFlavour) < 0) {
    notFound()
  }
  const defaultProgram = (PROGRAMS.get(blastFlavour) || [blastFlavour])[0];

  const blastForm = BLASTFLAVOUR_FORMS.get(blastFlavour)!

  const formDescription = blastForm.describe();

  
  const { register, handleSubmit, getValues, formState: {errors}, control, watch } = useForm<BlastParameters>({
    //@ts-ignore
    resolver: yupResolver(blastForm),
    //@ts-ignore
    defaultValues: blastForm.default()
  });

  console.log({ errors })

  async function onSubmit(formData: BlastParameters){
    console.log({ formData })
    fetch(`${basePath}/api/submit`, {
      body: JSON.stringify(formData),
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      method: 'POST'
    })
    .then(res => res.json())
    .then(data => {
      const { jobId } = data;
      window.location.replace(`${basePath}/results/${jobId}`) // HACK
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <h1 className='title'>{blastFlavour}</h1>
      <EnterQuery register={register} errors={errors} formDescription={formDescription} />
      <ChooseSearchSet register={register} errors={errors} blastFlavour={blastFlavour} control={control} formDescription={formDescription} />
      <ProgramSelection register={register} errors={errors} getValues={getValues} blastFlavour={blastFlavour} formDescription={formDescription} />
      <SubmitButton register={register} errors={errors} getValues={getValues} watch={watch} formDescription={formDescription} />
      <AlgorithmParameters register={register} errors={errors} getValues={getValues} formDescription={formDescription} blastFlavour={blastFlavour}/>
    </form>
  )
}