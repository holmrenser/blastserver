import { NextResponse, NextRequest } from "next/server";

import prisma from "../database";

// Taxonomy is static reference data (seeded once), so identical autocomplete
// queries are safe to cache. The per-keystroke debounce + client-side cache
// live in the form component; this header lets the browser/CDN reuse responses.
const CACHE_HEADER = "public, max-age=3600";

// Matches the frontend's minimum query length. Also the point below which a
// pg_trgm index can't be used, so shorter queries would force a full scan.
const MIN_QUERY_LENGTH = 3;

/**
 * Suggests taxonomy entries for the submission form's organism filter.
 *
 * A numeric query is treated as a taxid and matched by prefix on the primary
 * key; anything else is matched against `name` with a case-insensitive
 * `contains`, which is backed by the pg_trgm GIN index (taxonomy_name_trgm).
 */
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("query")?.trim() ?? "";

  if (query.length < MIN_QUERY_LENGTH) {
    return NextResponse.json({ taxonomyEntries: [] });
  }

  const where = /^\d+$/.test(query)
    ? { id: { startsWith: query } }
    : { name: { contains: query, mode: "insensitive" as const } };

  const taxonomyEntries = await prisma.taxonomy.findMany({
    where,
    take: 20,
    orderBy: { name: "asc" },
  });

  return NextResponse.json(
    { taxonomyEntries },
    { headers: { "Cache-Control": CACHE_HEADER } }
  );
}
