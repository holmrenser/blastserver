"use client";

import useSWR from "swr";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { fetcher } from "@/lib/fetcher";

export function QueueStatus() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const { data, isLoading, error } = useSWR(`${basePath}/api/queue`, fetcher, {
    refreshInterval: 2_000,
    revalidateOnMount: true,
  });

  if (error) {
    return <span className="text-sm text-destructive">Error</span>;
  }
  if (isLoading || !data) {
    return <Skeleton className="h-6 w-56" />;
  }

  const { waiting, completed, active } = data;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge variant="secondary" className="gap-1.5">
        <span className="size-2 rounded-full bg-accent-amber" />
        {waiting} waiting
      </Badge>
      <Badge variant="secondary" className="gap-1.5">
        <span className="size-2 rounded-full bg-accent-blue" />
        {active} running
      </Badge>
      <Badge variant="secondary" className="gap-1.5">
        <span className="size-2 rounded-full bg-accent-green" />
        {completed} completed
      </Badge>
    </div>
  );
}
