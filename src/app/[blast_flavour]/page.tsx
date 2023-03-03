import React from 'react';

const ALLOWED_FLAVOURS = ['blastp','blastx','blastn','tblastx'];
const BLAST_DBS = [
  'Nucleotide collection (nr/nt)',
  'Refseq representative genomes',
  'Refseq genome database',
  '...'
]
const PROGRAMS = new Map<string, Array<string>>([
  [
  'blastp', [
    'Quick BLASTP (Accelerated protein-protein BLAST)',
    'blastp (protein-protein BLAST)'
  ]],
  ['blastn', [
    'Megablast (Highly similar sequences)',
    'Discontiguous megablast (More dissimilar sequences)',
    'Blastn (Somewhat similar sequences)'
  ]]])

export function getStaticPaths(){
  return {
    paths: ALLOWED_FLAVOURS.map(blast_flavour => ({params:{blast_flavour}})),
    fallback: false
  }
}

function EnterQuery(){
  return (
    <fieldset className='box'>
      <legend className='label has-text-centered'>Enter Query Sequence</legend>
      
      <div className="field">
        <div className='field-body'>
          <div className='field'>
            <label className="label">Enter accession number(s), gi(s), or FASTA sequence(s)</label>
            <div className="control">
              <textarea className="textarea is-small" placeholder="QUERY SEQUENCE/IDENTIFIER"></textarea>
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
                    <input className="input is-small" placeholder="FROM" />
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
                    <input className="input is-small" placeholder="TO" />
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
              <input className="input is-small" type="text" placeholder="JOBTITLE" />
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
              <input className="input is-small" type="text" placeholder="JOHN@DOE.COM" />
            </div>
          </div>
        </div>
      </div>
    </fieldset>
  )
}

function ChooseSearchSet() {
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
            <div className="select is-small">
              <select>
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
              <input className="input is-small" type="text" placeholder="JOHN@DOE.COM" />
            </div>
          </div>
        </div>
      </div>
    </fieldset>
  )
}

function ProgramSelection({flavour}: {flavour: string}){
  if (!PROGRAMS.has(flavour)) return null
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
                PROGRAMS.get(flavour).map((program:string) => (
                  <React.Fragment key={program}>
                  <label className="radio is-small">
                    <input type="radio" name="program" />
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

function Submit() {
  return (
    <div className='container box'>
      <div className='tile is-ancestor'>
        <div className='tile is-parent'>
          <div className='tile is-child is-2'>
            <div className="field">
              <div className="control">
                <button className="button is-info">BLAST</button>
              </div>
            </div>
          </div>
          <div className='tile is-child'>
            <p>Search database <em>DB</em> using <em>PROGRAM</em></p>
          </div>
        </div>
      </div>
    </div>
  )
}

function AlgorithmParameters() {
  return (
    <div className='panel is-info'>
      <p className='panel-heading'>Algorithm parameters</p>
      <div className='panel-block'>
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
                  <select>
                    {
                      [10, 20, 100, 1000].map(n_targets => (
                        <option key={n_targets}>{n_targets}</option>
                      ))
                    }
                  </select>
                </div>
                </div>
              </div>
            </div>
          </div>

        </fieldset>
      </div>
      <div className='panel-block'>
        <fieldset className='box'>
          <legend className='label has-text-centered'>Scoring Parameters</legend>
        </fieldset>
        <fieldset className='box'>
          <legend className='label has-text-centered'>Filters and masking</legend>
        </fieldset>
      </div>
    </div>
  )
}

export default function BlastFlavourPage({params}:{params:{blast_flavour:string}}) {
  const {blast_flavour} = params;
  return (
    <>
      <h1 className='title'>{blast_flavour}</h1>
      <EnterQuery />
      <ChooseSearchSet />
      <ProgramSelection flavour={blast_flavour}/>
      <Submit />
      <AlgorithmParameters />
    </>
  )
}