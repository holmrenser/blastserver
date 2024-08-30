"use client";

import React, { useEffect, useRef } from "react";
import useSWR from "swr";
//@ts-ignore
import { saveAs } from "file-saver";
import type { blastjob } from "@prisma/client";

import ErrorComponent from "../error";

function Status({ message }: { message: string }) {
  return (
    <section className="hero is-fullheight">
      <h1 className="title">{message}</h1>
    </section>
  );
}

class DataFetchError extends Error {
  info: string | undefined = undefined;
  status: number | undefined = undefined;
}

async function fetcher(url: string) {
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    method: "GET",
  });

  if (!res.ok) {
    const error = new DataFetchError(
      "An error occured while fetching the data."
    );
    error.info = await res.json();
    error.status = res.status;
    throw error;
  }
  return res.json();
}

export default function DownloadPage({
  params,
}: {
  params: {
    downloadId: string;
  };
}): React.JSX.Element {
  const { downloadId } = params;
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

  const { data, isLoading, error } = useSWR<blastjob, Error>(
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
      const blob = new Blob([Buffer.from(data.results, "utf-8")], {
        type: "application/x-gzip-compressed",
      });
      save.current = () => {
        saveAs(blob, `blastresult.${downloadId}.fa.gz`);
      };
      save.current();
    }
  }, [data, downloadId]);

  if (error) return <ErrorComponent statusCode={500} />;
  if (isLoading) return <Status message="loading" />;
  if (!data) return <Status message={`Preparing download ${downloadId}`} />;

  return (
    <>
      <h1>Preparing download {downloadId} complete</h1>
      <p>
        If the download does not automatically start, click the button below:
      </p>
      <button
        className="button"
        type="button"
        onClick={() => {
          save.current();
        }}
      >
        Download
      </button>
    </>
  );
}
