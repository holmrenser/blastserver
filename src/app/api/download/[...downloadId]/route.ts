import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { download as downloadschema } from "@/generated/prisma/client";

import prisma from "@/app/api/database";

export const dynamic = "force-dynamic";

export type download = Omit<downloadschema, "results"> & {
  results: string | null;
};

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ downloadId: string[] }> }
): Promise<NextResponse<download>> {
  const { downloadId } = await params;
  console.log(`Checking download status ${downloadId}`);

  const id = downloadId?.[0];
  if (!id) {
    return new NextResponse("Missing download id", { status: 400 });
  }

  let rawDownload: downloadschema | null;
  try {
    rawDownload = await prisma.download.findFirst({
      where: { id },
    });
  } catch (err) {
    console.error((err as Error).message);
    return new NextResponse((err as Error).message, { status: 500 });
  }
  if (!rawDownload) {
    return new NextResponse("Download not found", { status: 404 });
  }
  const download = {
    ...rawDownload,
    results: rawDownload.results
      ? Buffer.from(rawDownload.results!).toString("base64")
      : rawDownload.results,
  };
  return NextResponse.json({ ...download });
}
