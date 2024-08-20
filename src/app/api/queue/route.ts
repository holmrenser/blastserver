import { NextResponse } from 'next/server';

import { blastQueue, downloadQueue } from '../queue';

export const dynamic = 'force-dynamic';

/**
 * API endpoint to query how the job queue is doing
 * @returns 
 */
export async function GET() {
  const {
    waiting: blastWaiting,
    completed: blastCompleted,
    failed: blastFailed,
    active: blastActive
  } = await blastQueue.getJobCounts();
  const {
    waiting: downloadWaiting,
    completed: downloadCompleted,
    failed: downloadFailed,
    active: downloadActive
  } = await downloadQueue.getJobCounts();
  return NextResponse.json({
    waiting: downloadWaiting + blastWaiting,
    completed: downloadCompleted + blastCompleted,
    failed: downloadFailed + blastFailed,
    active: downloadActive + blastActive
  })
}


