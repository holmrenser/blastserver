'use client';

import useSWR from 'swr';

import ErrorComponent  from '../error';
import ResultsPage from './resultspage';

class DataFetchError extends Error {
  info: string | undefined = undefined
  status: number | undefined = undefined
}


async function fetcher(url: string){
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

export default function ResultsWrapper({
  params
}:{
  params:{
    jobId: string
  }
}) {
  const { jobId } = params;
  const url = `/api/${jobId}`;
  const { data, isLoading, error } = useSWR(url, fetcher);
  
  if (error) return <ErrorComponent statusCode={500} />
  if (isLoading) return <p>Loading</p>
  const { submitted, results, finished, parameters, program, err } = data;

  return (
    <>
      <h2 className='subtitle'>Results</h2>
      <p>Job ID: {jobId}</p>
      <p>Submitted: {new Date(submitted)?.toLocaleString('en-GB')}</p>
      <p>Status: {results || err ? `Finished at ${new Date(finished)?.toLocaleString('en-GB')}` : 'In progress'}</p>
      <ResultsPage blastResults={results} err={err}/>
    </>
  )
} 