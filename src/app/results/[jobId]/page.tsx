import { queue } from '../../api/queue';
import { Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import Error from '../error';

const prisma = new PrismaClient();

export default async function ResultsPage({
  params
}:{
  params:{
    jobId: string
  },
}) {
  const { jobId } = params;
  const job = await prisma.blastjob.findFirst({ where: { id: jobId }})
  if (!job) return <Error statusCode={404} />
  console.log({ job });
  const { parameters, results } =  job;
  // const job = await Job.fromId(queue, jobId);
  // const { data, progress, returnvalue, timestamp, id } = job;
  // console.log({ id })

  return (
    <>
      <h2 className='subtitle'>Results</h2>
      <p>Job ID: {jobId}</p>
      <p>Submitted: {new Date().toDateString()}</p>
      <p>Results: {results}</p>
    </>
  )
} 