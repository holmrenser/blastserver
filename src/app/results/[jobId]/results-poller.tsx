"use client";

import React from "react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";

import { fetcher } from "@/lib/fetcher";

// Minimal client island: while the BLAST job is still running, poll its status
// and refresh the Server Component so the freshly rendered results/status show.
// SWR drives the cadence so polling pauses while the tab is hidden/offline and
// stops once the job is done (`refreshInterval` returns 0). It is only mounted
// in the in-progress branch of the results page, so once the job finishes and
// the server renders results this unmounts entirely.
export default function ResultsPoller({
  jobId,
}: {
  jobId: string;
}): React.JSX.Element {
  const router = useRouter();
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

  const { data } = useSWR(`${basePath}/api/${jobId}`, fetcher, {
    refreshInterval: (d) => (d?.results || d?.err ? 0 : 4_000),
    revalidateOnMount: true,
  });

  // Re-render the Server Component (which renders the full results / job status)
  // whenever the polled status changes; once finished this unmounts and the
  // SWR poll stops.
  useEffect(() => {
    if (data) router.refresh();
  }, [data, router]);

  return (
    <p className="text-muted-foreground">
      This page will automatically update once your job is ready
    </p>
  );
}
