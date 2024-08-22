import hash from 'object-hash';
import { NextResponse, NextRequest } from 'next/server';

import { downloadQueue } from '../queue';
import prisma from '../database';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const params = await request.json();
  const { sequenceIds, database }: { sequenceIds: string[], database: string } = params;
  if (!Array.isArray(sequenceIds)) {
    return NextResponse.json({ error: 'Must provide an array of sequence identifiers'}, { status: 500})
  }

  if (sequenceIds.length > 500) {
    return NextResponse.json({ error: 'Cannot download more than 500 sequences'}, { status: 500 })
  }

  sequenceIds.sort();
  const jobId = hash(sequenceIds).slice(0,10);
  console.log(`Download request ${jobId}`)
  const existingJob = await prisma.download.findFirst({ where: { id: jobId }});
  if (!existingJob) {
    prisma.download.create({
      data: {
        id: jobId,
        sequenceIds,
        submitted: new Date(),
      }
    }).then(() => downloadQueue.add('download', { sequenceIds, database }, { jobId }))
  } else {
    console.log(`Found existing download job: ${existingJob.id}`)
  }
  return NextResponse.json({ jobId })
}
