// import { queue } from '../../api/queue';
// import { Job } from 'bullmq';
// 'use client';
// import { useRouter } from 'next/navigation';

//import { PrismaClient } from '@prisma/client';
import { xml2js, ElementCompact } from 'xml-js';

import Error from '../error';
import ResultsPage from './resultspage';
import prisma from '../../api/database';

// const prisma = new PrismaClient();

function replaceJsonTextAttribute(value: string, parentElement: ElementCompact) {
  const keyNo = Object.keys(parentElement._parent).length;
  const keyName = Object.keys(parentElement._parent)[keyNo-1];
  parentElement._parent[keyName] = value;
}

export default async function ResultsWrapper({
  params
}:{
  params:{
    jobId: string
  }
}) {
  // const router = useRouter();
  const { jobId } = params;
  const job = await prisma.blastjob.findFirst({ where: { id: jobId }})
  if (!job) return <Error statusCode={404} />
  // console.log({ job });

  const results = job.results 
    ? xml2js(job.results, {compact: true, trim: true, textFn: replaceJsonTextAttribute}) 
   : null;
  
  // if (!results) setTimeout(router.refresh, 1000);

  return (
    <>
      <h2 className='subtitle'>Results</h2>
      <p>Job ID: {jobId}</p>
      <p>Submitted: {new Date().toDateString()}</p>
      <p>Status: {results ? 'Finished' : 'In progress'}</p>
      <ResultsPage results={results} />
    </>
  )
} 