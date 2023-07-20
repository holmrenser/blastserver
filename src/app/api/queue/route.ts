import { NextResponse, NextRequest } from 'next/server';

import { queue } from '../queue';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { waiting, completed, failed, active } = await queue.getJobCounts();
  return NextResponse.json({ waiting, completed, failed, active })
}


