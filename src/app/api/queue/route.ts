import { NextResponse, NextRequest } from 'next/server';

import { queue } from '../queue';

export async function GET(request: NextRequest) {
  const { waiting, completed, failed, active } = await queue.getJobCounts();
  // console.log({ other })
  return NextResponse.json({ waiting, completed, failed, active })
}


