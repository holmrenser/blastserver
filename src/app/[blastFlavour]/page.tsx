'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as Yup from 'yup';
// import { redirect } from 'next/navigation';

import './blastFlavour.scss';


const ALLOWED_FLAVOURS = ['blastp','blastx','blastn','tblastx','tblastn'] as const;
type BlastFlavour = typeof ALLOWED_FLAVOURS[number];

const BLAST_DBS = [
  'Nucleotide collection (nr/nt)',
  'Refseq representative genomes',
  'Refseq genome database',
  '...'
]
const PROGRAMS = new Map<string, Array<string>>([
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

type FormData<F> = {
  query: string;
  queryFrom?: number;
  queryTo?: number;
  jobTitle?: string;
  email?: string;
  database: string;
  organism?: string;
  program: string;
  maxTargetSeqs: 10 | 50 | 100 | 250 | 500 | 1000 | 5000;
  shortQueries: boolean;
  expectThreshold: number;
  wordSize: 2 | 3 | 5 | 6;
  maxMatchesInQueryRange?: number;
  matrix: string;
  gapCosts: string;
  compositionalAdjustment: string;
}

function numberTransform(_,val){
  return val !== '' ? Number(val): null
}

const formSchema = Yup.object().shape({
  query: Yup.string()
    .required('Query is required')
    .max(10e4)
    .trim()
    .test(
      'is-fasta',
      'Query is not FASTA formatted',
      (value, context) => value[0] === '>'),
  queryFrom: Yup.number()
    .notRequired()
    .moreThan(0, 'Query FROM cannot be negative')
    .transform(numberTransform),
  queryTo: Yup.number()
    .notRequired()
    .moreThan(0, 'Query TO cannot be negative')
    .transform(numberTransform),
  jobTitle: Yup.string()
    .notRequired()
    .trim(),
  email: Yup.string()
    .notRequired()
    .email()
    .trim(),
  database: Yup.string()
    .oneOf(BLAST_DBS)
    .required('Must choose a database')
    .trim(),
  organism: Yup.string()
    .notRequired()
    .trim(),
  program: Yup.string()
    .required('Must choose BLAST program')
    .trim(),
  maxTargetSeqs: Yup.number()
    .required('Must specify maximum number of target sequences')
    .moreThan(0, 'Max. target sequences cannot be negative')
    .transform(numberTransform),
  shortQueries: Yup.boolean()
    .required('Must specify whether to adjust for short input sequences'),
  wordSize: Yup.number()
    .required('Must specify a word size')
    .moreThan(0, 'Word size cannot be negative')
    .transform(numberTransform),
  expectThreshold: Yup.number()
    .required('Must specify an expect threshold')
    .moreThan(0, 'Expect threshold cannot be negative')
    .transform(numberTransform),
  maxMatchesInQueryRange: Yup.number()
    .notRequired()
    .moreThan(0, 'Max. matches in query range cannot be negative')
    .transform(numberTransform),
  matrix: Yup.string()
    .required()
    .trim(),
  gapCosts: Yup.string()
    .required()
    .trim(),
  compositionalAdjustment: Yup.string()
    .required()
    .trim(),
})

export function getStaticPaths(){
  return {
    paths: ALLOWED_FLAVOURS.map(blast_flavour => ({params:{blast_flavour}})),
    fallback: false
  }
}

function EnterQuery({ register, errors }){
  return (
    <fieldset className='box'>
      <legend className='label has-text-centered'>Enter Query Sequence</legend>
      
      <div className="field">
        <div className='field-body'>
          <div className='field'>
            <label className="label">Enter accession number(s), gi(s), or FASTA sequence(s)</label>
            <div className="control">
              <textarea
                className={`textarea is-small ${errors.query?.message ? 'is-danger' : ''}`}
                placeholder="QUERY SEQUENCE/IDENTIFIER"
                {...register('query')} />
            </div>
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
                      {...register('queryFrom')} />
                  </div>
                </div>
              </div>
            </div>

            <div className='field is-horizontal'>
              <div className='field-label is-small'>
                <label className="label">To</label>
              </div>
              <div className='field-body'>
                <div className='field'>
                  <div className="control">
                    <input
                      className={`input is-small ${errors.queryTo?.message ? 'is-danger' : ''}`}
                      placeholder="TO"
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
              <input className="input is-small" type="text" placeholder="JOBTITLE" {...register('jobTitle')}/>
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
              <input className="input is-small" type="text" placeholder="JOHN@DOE.COM" {...register('email')} />
            </div>
          </div>
        </div>
      </div>
    </fieldset>
  )
}

function ChooseSearchSet({ register, errors }) {
  return (
    <fieldset className='box'>
      <legend className='label has-text-centered'>Choose Search Set</legend>
      
      <div className='field is-horizontal'>
        <div className="field-label is-small">
          <label className="label">Database</label>
        </div>
        <div className="field-body">
          <div className="field">
            <div className="control">
            <div className={`select is-small ${errors.database?.message ? 'is-danger' : ''}`}>
              <select {...register('database')}>
                {
                  BLAST_DBS.map(db => (
                    <option key={db}>{db}</option>
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
              <input
                className={`input is-small ${errors.organism?.message ? 'is-danger' : ''}`}
                type="text"
                placeholder="ORGANISM NAME"
                {...register('organism')} />
            </div>
          </div>
        </div>
      </div>
    </fieldset>
  )
}

function ProgramSelection({blastFlavour, register, errors, getValues}){
  if (!PROGRAMS.has(blastFlavour)) return null
  const selectedProgram = getValues('program');
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
                PROGRAMS.get(blastFlavour ).map((program:string) => (
                  <React.Fragment key={program}>
                  <label className="radio is-small">
                    <input
                      type="radio"
                      name="program"
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

function SubmitButton({ register, errors, getValues }) {
  const db = getValues('database');
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

function AlgorithmParameters({ register, errors, getValues }) {
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
                  <select {...register('maxTargetSeqs')}>
                    {
                      [10, 50, 100, 250, 500, 1000, 5000].map(n_targets => (
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
                  <input className='input is-small' type='text' {...register('expectThreshold')} />
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
                  <select {...register('wordSize')}>
                    {
                      [2, 3, 5, 6].map(wordSize => (
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
                  <input className='input is-small' type='text' {...register('maxMatchesInQueryRange')} />
                </div>
              </div>
            </div>
          </div>


        </fieldset>
      
        <fieldset className='box'>
          <legend className='label has-text-centered'>Scoring Parameters</legend>

          <div className='field is-horizontal'>
            <div className="field-label is-small">
              <label className="label">Matrix</label>
            </div>
            <div className="field-body">
              <div className="field">
                <div className="control">
                <div className="select is-small">
                  <select {...register('matrix')}>
                    {
                      ['PAM30','PAM70','PAM250','BLOSUM80',
                      'BLOSUM62','BLOSUM45','BLOSUM50','BLOSUM90'].map(wordSize => (
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
              <label className="label">Gap costs</label>
            </div>
            <div className="field-body">
              <div className="field">
                <div className="control">
                <div className="select is-small">
                  <select {...register('gapCosts')}>
                    {
                      [
                        '11,2','10,2','9,2','8,2','7,2','6,2',
                        '13,1','12,1','11,1','10,1','9,1'
                      ].map(gapCost => {
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

          <div className='field is-horizontal'>
            <div className="field-label is-small">
              <label className="label">Compositional adjustment</label>
            </div>
            <div className="field-body">
              <div className="field">
                <div className="control">
                <div className="select is-small">
                  <select {...register('compositionalAdjustment')}>
                    {
                      ['No adjustment','Compositon-based statistics',
                      'Conditional compositional score matrix adjustment',
                    'Universal compositional score matrix adjustment'].map(adjustment => (
                        <option key={adjustment}>{adjustment}</option>
                      ))
                    }
                  </select>
                </div>
                </div>
              </div>
            </div>
          </div>
        </fieldset>
        <fieldset className='box'>
          <legend className='label has-text-centered'>Filters and masking</legend>
        </fieldset>
      </div>
    </div>
  )
}

export default function BlastFlavourPage({params}:{params:{blastFlavour:BlastFlavour}}) {
  const {blastFlavour} = params;
  const defaultProgram = (PROGRAMS.get(blastFlavour) || [blastFlavour])[0];
  
  const { register, handleSubmit, getValues, formState: {errors} } = useForm<FormData<typeof blastFlavour>>({
    resolver: yupResolver(formSchema),
    defaultValues: {
      program: defaultProgram,
      database: BLAST_DBS[0],
      maxTargetSeqs: 100,
      shortQueries: true,
      expectThreshold: 0.05,
      wordSize: 5,
      matrix: 'BLOSUM62',
      gapCosts: '11,1',
      compositionalAdjustment: 'Conditional compositional score matrix adjustment'
    }
  });

  async function onSubmit(formData: FormData<typeof blastFlavour>){
    // console.log({ formData })
    fetch('/api', {
      body: JSON.stringify(formData),
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      method: 'POST'
    })
    .then(res => res.json())
    .then(data => {
      // console.log({ data });
      const { jobId } = data;
      window.location.replace(`/results/${jobId}`) // HACK
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <h1 className='title'>{blastFlavour}</h1>
      <EnterQuery register={register} errors={errors} />
      <ChooseSearchSet register={register} errors={errors} />
      <ProgramSelection register={register} errors={errors} getValues={getValues} blastFlavour={blastFlavour} />
      <SubmitButton register={register} errors={errors} getValues={getValues} />
      <AlgorithmParameters register={register} errors={errors} getValues={getValues}/>
    </form>
  )
}