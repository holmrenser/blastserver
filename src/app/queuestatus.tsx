'use client';

import useSWR from 'swr';

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

export function QueueStatus(){
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH;
  const { data, isLoading, error } = useSWR(
    `${basePath}/api/queue`,
    fetcher,
    {
      refreshInterval: 2_000,
      revalidateOnMount: true
    }
  );

  // console.log({ isLoading, data, error })

  if (error) return <p>Error</p>
  if (isLoading) return <p>Connecting</p>
  if (!data) return <p>Fetching</p>
  
  const { waiting, completed, active } = data;

  return <div className='tags'>
    <span className='tag is-warning is-light'>{waiting} waiting</span>
    <span className='tag is-info is-light'>{active} running</span>
    <span className='tag is-success is-light'>{completed} completed</span>
  </div> 
}