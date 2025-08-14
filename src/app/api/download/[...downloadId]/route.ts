import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { download } from "@prisma/client";

import prisma from "@/app/api/database";

export const dynamic = "force-dynamic";

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ downloadId: string[] }> }
): Promise<NextResponse<download>> {
  const { downloadId } = await params;
  console.log(`Checking download status ${downloadId}`);

  let download: download | null;
  try {
    download = await prisma.download.findFirst({
      where: { id: downloadId[0] },
    });
  } catch (err) {
    console.error((err as Error).message);
    return new NextResponse((err as Error).message, { status: 500 });
  }
  if (!download) {
    return new NextResponse("Download not found", { status: 404 });
  }

  return NextResponse.json({ ...download });
}
