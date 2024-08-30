"use client";

import { useEffect } from "react";

export default function ErrorComponent({
  statusCode,
  error,
  reset,
}: {
  statusCode: number | string;
  error?: Error;
  reset?: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
  }, [error]);

  return (
    <div>
      <h1>{statusCode}</h1>
      <h2>Something went wrong!</h2>
      {reset && (
        <button
          onClick={
            // Attempt to recover by trying to re-render the segment
            () => reset()
          }
        >
          Try again
        </button>
      )}
    </div>
  );
}
