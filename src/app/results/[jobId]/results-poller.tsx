"use client";

import React from "react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Minimal client island: while the BLAST job is still running, refresh the
// Server Component every few seconds. It is only mounted in the in-progress
// branch of the results page, so once the job finishes and the server renders
// results this unmounts and polling stops.
export default function ResultsPoller(): React.JSX.Element {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), 4_000);
    return () => clearInterval(id);
  }, [router]);

  return (
    <p className="text-muted-foreground">
      This page will automatically update once your job is ready
    </p>
  );
}
