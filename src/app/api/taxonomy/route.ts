import { NextResponse, NextRequest } from 'next/server';

import prisma from '../database';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('query');
  console.log({ query })
  const taxonomyEntries = query
    ? await prisma.taxonomy.findMany({
      where: {
        OR: [
          { id: { contains: query, mode: 'insensitive' }},
          { name: { contains: query, mode: 'insensitive' }}
        ]
      },
      take: 20
    })
    : await prisma.taxonomy.findMany({
      take: 20
    })
  /*
  const jobId = hash(parameters);
  const existingJob = await prisma.blastjob.findFirst({ where: { id: jobId }});
  if (!existingJob) {
    prisma.blastjob.create({
      data: {
        id: jobId,
        parameters,
        submitted: new Date(),
      }
    }).then(() => queue.add('blast', parameters, { jobId }))
  } else {
    console.log(`Found existing job: ${existingJob.id}`)
  }
  */
  return NextResponse.json({ taxonomyEntries })
}


