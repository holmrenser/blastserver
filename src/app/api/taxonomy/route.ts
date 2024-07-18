import { NextResponse, NextRequest } from 'next/server';

import prisma from '../database';

export const dynamic = 'force-dynamic';

/**
 * API endpoint that is used in the submission form to suggest taxonomy entries
 * @param request 
 * @returns 
 */
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('query');
  const taxonomyEntries = query
    ? await prisma.taxonomy.findMany({
      where: {
        OR: [
          { id: { contains: query, mode: 'insensitive' }},
          { name: { contains: query, mode: 'insensitive' }}
        ]
      },
      take: 20,
      orderBy: { name: 'asc' }
    })
    : await prisma.taxonomy.findMany({
      take: 20
    })
  return NextResponse.json({ taxonomyEntries })
}


