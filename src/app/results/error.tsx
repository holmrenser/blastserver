"use client";

import { useEffect } from "react";
import { AlertCircleIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function ErrorComponent({
  statusCode,
  error,
  reset,
}: {
  // Optional: Next passes only { error, reset } when this file is used as the
  // route's automatic error boundary; statusCode is set only on manual renders.
  statusCode?: number | string;
  error?: Error;
  reset?: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
  }, [error]);

  return (
    <div className="container mx-auto max-w-xl px-4 py-10">
      <Alert variant="destructive">
        <AlertCircleIcon />
        <AlertTitle>
          Something went wrong!{statusCode ? ` (${statusCode})` : ""}
        </AlertTitle>
        <AlertDescription>
          An error occurred while processing your request.
          {reset && (
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => reset()}
            >
              Try again
            </Button>
          )}
        </AlertDescription>
      </Alert>
    </div>
  );
}
