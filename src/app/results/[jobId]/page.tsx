'use client';

import useSWR from 'swr';

import ErrorComponent  from '@/app/results/error';
import ResultsPage from './resultspage';

import type { FormData, BlastFlavour } from '@/app/[blastFlavour]/blastflavour';
import { useContext } from 'react';
import { ThemeContext } from '@/app/themecontext';

class DataFetchError extends Error {
  info: string | undefined = undefined
  status: number | undefined = undefined
}

async function fetcher(url: string){
  // console.log(`Fetching ${url}`)
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    method: 'GET'
  })

  if (!res.ok) {
    const error = new DataFetchError('An error occured while fetching the data.');
    error.info = await res.json();
    error.status = res.status;
    throw error
  }
  return res.json()
}

function ResultsTable({ results }: {results: any}){
  const { queryId, queryLen, queryTitle } = results;
  return <>
    <tr>
      <td>Query ID</td>
      <td>{queryId}</td>
    </tr>
    <tr>
      <td>Description</td>
      <td>{queryTitle}</td>
    </tr>
    <tr>
      <td>Query length</td>
      <td>{queryLen}</td>
    </tr>
  </>
}

function UsedParameters({ parameters }: { parameters: FormData<BlastFlavour> }) {
  // console.log({ parameters })
  const { flavour, queryTo, queryFrom, taxids, gapCosts, excludeTaxids,
  maxTargetSeqs, expectThreshold, lcaseMasking } = parameters;
  
  const { theme } = useContext(ThemeContext);

  let additionalParams: {[key: string]: string} = {};
  if (flavour === 'blastp') {
    Object.assign(additionalParams, { matrix: parameters.matrix, wordSize: parameters.wordSize })
  }

  if (queryFrom) { Object.assign(additionalParams, { queryFrom }) }
  if (queryTo) { Object.assign(additionalParams, { queryTo }) }
  if (lcaseMasking) { Object.assign(additionalParams, { lcaseMasking: 'true' })}

  return (
    <div className={`card ${theme === 'dark' ? 'has-background-grey-dark' : ''}`}>
      <header className='card-header'>
        <p className={`card-header-title ${theme === 'dark' ? 'has-text-light' : ''}`}>
          Used parameters
        </p>
      </header>
      <div className='card-content'>
        <table className={`table is-small is-size-7 ${theme === 'dark' ? 'has-background-grey-dark has-text-light' : ''}`}>
          <tbody>
            <tr>
              <td>Gap costs</td>
              <td>{gapCosts}</td>
            </tr>
            <tr>
              <td>Max. target seqs</td>
              <td>{maxTargetSeqs}</td>
            </tr>
            <tr>
              <td>E-value threshold</td>
              <td>{expectThreshold}</td>
            </tr>
            { taxids && (
              <tr>
                <td>{excludeTaxids ? 'Excluded tax. IDs' : 'Tax. IDs'}</td>
                <td><ul>{taxids.map(taxid => (<li key={taxid}>{taxid}</li>))}</ul></td>
              </tr>
            )}
            {
              Object.entries(additionalParams).map(([name, value]) => (
                <tr key={name}>
                  <td>{name}</td>
                  <td>{value}</td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Status({ message }: { message: string }) {
  const { theme } = useContext(ThemeContext);
  return <section className='hero is-fullheight'>
    <h1 className={`title ${theme === 'dark' ? 'has-text-light':''}`}>
     { message }
    </h1>
  </section>
}

export default function ResultsWrapper({
  params
}:{
  params:{
    jobId: string
  }
}) {
  const { jobId } = params;
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH;

  const { data, isLoading, error } = useSWR(
    `${basePath}/api/${jobId}`,
    fetcher,
    {
      refreshInterval: (data) => {
        // check whether blast is finished every 4 seconds, stop checking when done
        return data?.results || data?.err ? 0 : 4_000
      },
      revalidateOnMount: true
    }
  );

  const { theme } = useContext(ThemeContext);
  
  if (error) return <ErrorComponent statusCode={500} />
  if (isLoading) return <Status message='loading' />
  if (!data) return <Status message='fetching' />

  const { submitted, results, finished, parameters, err } = data;
  const { jobTitle, program, database } = parameters;

  return (
    <div className='container is-fullhd'>
      <h2 className={`subtitle ${theme === 'dark' ? 'has-text-light' : ''}`}>Results</h2>
      <div className='columns'>
        <div className='column'>
          <div className={`card ${theme === 'dark' ? 'has-background-grey-dark' : ''}`}>
            <header className='card-header'>
              <p className={`card-header-title ${theme === 'dark' ? 'has-text-light' : ''}`}>
                Job&nbsp;ID <span style={{marginLeft: '8px'}} className='tag is-info is-light'>{jobId}</span>
              </p>
            </header>
            <div className='card-content'>
              <table className={`table is-small is-size-7 ${theme === 'dark' ? 'has-background-grey-dark has-text-light' : ''}`}>
                <tbody>
                  <tr>
                    <td>Job Title</td>
                    <td>{jobTitle || 'Protein Sequence'}</td>
                  </tr>
                  <tr>
                    <td>Program</td>
                    <td>{program.toUpperCase()}</td>
                  </tr>
                  <tr>
                    <td>Database</td>
                    <td>{database}</td>
                  </tr>
                  <tr>
                    <td>Submitted</td>
                    <td>{new Date(submitted)?.toLocaleString('en-GB')}</td>
                  </tr>
                  <tr>
                    <td>Status</td>
                    <td>{results || err ? `Finished at ${new Date(finished)?.toLocaleString('en-GB')}` : 'In progress'}</td>
                  </tr>
                  { results && <ResultsTable results={results} />}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div className='column'>
          <UsedParameters parameters={parameters} />
        </div>
      </div>
      <ResultsPage blastResults={results} database={database} err={err} />
    </div>
  )
} 