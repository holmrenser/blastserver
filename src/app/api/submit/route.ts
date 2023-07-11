import hash from 'object-hash';
import { NextResponse, NextRequest } from 'next/server';

import { queue } from '../queue';
import prisma from '../database';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const parameters = await request.json();
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
  return NextResponse.json({ jobId })
}


