//@ts-ignore
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
//import { xml2js, ElementCompact } from 'xml-js';
//import { camelCase, mapKeys, partition } from 'lodash';

import prisma from '../database';
import formatResults from './formatResults';

export const dynamic = 'force-dynamic';

export async function GET(_: NextRequest, context: { params: { jobId: string[]}}) {
  const { params: { jobId }} = context;
  console.log(`Requested BLAST job ${jobId}`);

  let job;
  try {
    job = await prisma.blastjob.findFirst({ where: { id: jobId[0] }});
  } catch (err) {
    console.error(err);
  }
  const formattedResults = job?.results ? await formatResults(job.results) : null;

  return NextResponse.json({...job, results: formattedResults })
}