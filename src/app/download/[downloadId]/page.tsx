"use client";

import React, { use, useEffect, useRef } from "react";
import useSWR from "swr";
//@ts-ignore
import { saveAs } from "file-saver";
import type { download } from "@/app/api/download/[...downloadId]/route"; //"@prisma/client";

import ErrorComponent from "../error";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fetcher } from "@/lib/fetcher";

function PreparingDownload({ message }: { message: string }) {
  return (
    <div className="container mx-auto flex max-w-xl flex-col gap-3 px-4 py-10">
      <h1 className="text-xl font-semibold">{message}</h1>
      <Skeleton className="h-10 w-full" />
    </div>
  );
}

export default function DownloadPage({
  params,
}: {
  params: Promise<{
    downloadId: string;
  }>;
}): React.JSX.Element {
  const { downloadId } = use(params);
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

  const { data, isLoading, error } = useSWR<download, Error>(
    `${basePath}/api/download/${downloadId}`,
    fetcher,
    {
      refreshInterval: (data) => {
        // check whether download is finished every second, stop checking when done
        return data?.results || data?.err ? 0 : 1_000;
      },
      revalidateOnMount: true,
    }
  );

  let save = useRef(() => {});

  useEffect(() => {
    if (data && data.results) {
      const blob = new Blob(
        [Uint8Array.from(atob(data.results), (c) => c.charCodeAt(0))], // change base64 encoded gzipped data into uint8array for download blob
        {
          type: "application/x-gzip-compressed",
        }
      );
      save.current = () => {
        saveAs(blob, `blastresult.${downloadId}.fa.gz`);
      };
      save.current();
    }
  }, [data, downloadId]);

  if (error) return <ErrorComponent statusCode={500} />;
  if (isLoading) return <PreparingDownload message="Loading" />;
  if (!data) return <PreparingDownload message={`Preparing download ${downloadId}`} />;

  return (
    <div className="container mx-auto flex max-w-xl flex-col gap-3 px-4 py-10">
      <h1 className="text-xl font-semibold">
        Download {downloadId} complete
      </h1>
      <p className="text-muted-foreground">
        If the download does not automatically start, click the button below:
      </p>
      <Button
        type="button"
        className="w-fit"
        onClick={() => {
          save.current();
        }}
      >
        Download
      </Button>
    </div>
  );
}
