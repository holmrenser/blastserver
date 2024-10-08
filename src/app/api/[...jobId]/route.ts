import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { blastjob } from '@prisma/client';

import prisma from '@/app/api/database';
import formatResults from './formatResults';
import type { FormattedBlastResults } from './formatResults';

export const dynamic = 'force-dynamic';

export type BlastJobResults = Omit<blastjob, 'results'> & {
  results: FormattedBlastResults | null
}

/**
 * API endpoint to get results from a finished BLAST job
 * @param _ 
 * @param context 
 * @returns 
 */
export async function GET(
  _: NextRequest,
  context: { params: { jobId: string[]}}
): Promise<NextResponse<BlastJobResults>> {
  const { params: { jobId }} = context;
  console.log(`Requested BLAST job ${jobId}`);

  let job: blastjob | null;
  try {
    job = await prisma.blastjob.findFirst({ where: { id: jobId[0] }});
  } catch (err) {
    console.error((err as Error).message);
    return new NextResponse((err as Error).message, { status: 500 });
  }
  if (!job) {
    return new NextResponse('Job not found', { status: 404 });
  }
  const formattedResults = job?.results ? await formatResults(job.results) : null;
  return NextResponse.json({...job, results: formattedResults })
}