'use client';

import { usePathname } from 'next/navigation';
import useSWR from 'swr';

import ErrorComponent  from '../error';
import ResultsPage from './resultspage';

class DataFetchError extends Error {
  info: string | undefined = undefined
  status: number | undefined = undefined
}


async function fetcher(url: string){
  console.log(`Fetching ${url}`)
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

export default function ResultsWrapper({
  params
}:{
  params:{
    jobId: string
  }
}) {
  const { jobId } = params;
  const pathName = usePathname();
  const basePath = pathName.split('results')[0].slice(0, -1);
  console.log(`Resultswrapper pathName is: ${pathName}`)
  console.log(`Resultswrapper basepath is: ${basePath}`)
  
  const { data, isLoading, error, mutate } = useSWR(
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
  
  console.log({ data, isLoading, error })
  
  if (error) return <ErrorComponent statusCode={500} />
  if (isLoading) return <p>Connecting</p>
  if (!data) return <p>Fetching</p>
  const { submitted, results, finished, parameters, err } = data;
  const { jobTitle, program, database } = parameters;

  // console.log({ parameters, results })
  

  return (
    <>
      <h2 className='subtitle'>Results</h2>
      <table className='table is-small is-size-7'>
        <tbody>
          <tr>
            <td>Job ID</td>
            <td>{jobId}</td>
          </tr>
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
      <ResultsPage blastResults={results} mutate={mutate} err={err}/>
    </>
  )
} 