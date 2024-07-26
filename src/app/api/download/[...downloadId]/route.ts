import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import prisma from '@/app/api/database';

export async function GET(_: NextRequest, context: { params: { downloadId: string[]}}) {
  const { params: { downloadId }} = context;
  console.log(`Requested download job ${downloadId}`);

  let job;
  try {
    job = await prisma.blastjob.findFirst({ where: { id: downloadId[0] }});
  } catch (err) {
    console.error(err);
  }
  // const formattedResults = job?.results ? await formatResults(job.results) : null;

  return NextResponse.json({...job })
}