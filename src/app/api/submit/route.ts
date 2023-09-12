import hash from 'object-hash';
import { NextResponse, NextRequest } from 'next/server';

import { blastQueue } from '../queue';
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
    }).then(() => blastQueue.add('blast', parameters, { jobId }))
  } else {
    console.log(`Found existing BLAST job: ${existingJob.id}`)
  }
  return NextResponse.json({ jobId })
}


