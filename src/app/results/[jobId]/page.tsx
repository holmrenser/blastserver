'use client';

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
  
  if (error) return <ErrorComponent statusCode={500} />
  if (isLoading) return <p>Connecting</p>
  if (!data) return <p>Fetching</p>

  const { submitted, results, finished, parameters, err } = data;
  const { jobTitle, program, database } = parameters;

  return (
    <>
      <h2 className='subtitle'>Results</h2>
      <div className='columns'>
        <div className='column'>
          <div className='card'>
            <header className='card-header'>
              <p className='card-header-title'>
                Job ID&nbsp; <span className='tag is-info is-light'>{jobId}</span>
              </p>
            </header>
            <div className='card-content'>
              <table className='table is-small is-size-7'>
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
          <div className='card'>
            <header className='card-header'>
              <p className='card-header-title'>
                Filter results
              </p>
            </header>
            <div className='card-content has-background-light'>
              <form>
                <div className='field'>
                  <label className='label'>Organism</label>
                  <div className='control'>
                    <input className='input is-small' type='text' placeholder='Organism name or taxid' />
                  </div>
                  <p className='help'>+ Add organism</p>
                </div>
                <hr/>
                <div className='columns'>
                  <div className='field column'>
                    <label className='label'>Percent identity</label>
                    <div className='columns'>
                      <div className='control column'>
                        <input className='input is-small' type='text' />
                      </div>
                      <b className='column'>To</b>
                      <div className='control column'>
                        <input className='input is-small' type='text' />
                      </div>
                    </div>
                  </div>

                  <div className='field column'>
                    <label className='label'>E-value</label>
                    <div className='columns'>
                      <div className='control column'>
                        <input className='input is-small' type='text' />
                      </div>
                      <b className='column'>To</b>
                      <div className='control column'>
                        <input className='input is-small' type='text' />
                      </div>
                    </div>
                  </div>

                  <div className='field column'>
                    <label className='label'>Query coverage</label>
                    <div className='columns'>
                      <div className='control column'>
                        <input className='input is-small' type='text' />
                      </div>
                      <b className='column'>To</b>
                      <div className='control column'>
                        <input className='input is-small' type='text' />
                      </div>
                    </div>
                  </div>
                </div>
              </form>
            </div>
            <footer className='card-footer'>
              <a href='#' className='card-footer-item'>Filter</a>
              <a href='#' className='card-footer-item'>Reset</a>
            </footer>
          </div>
        </div>
      </div>
      <ResultsPage blastResults={results} err={err}/>
    </>
  )
} 