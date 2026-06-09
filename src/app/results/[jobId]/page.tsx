"use client";

import useSWR from "swr";
import React, { use } from "react";
import type { ReactNode } from "react";

import ErrorComponent from "@/app/results/error";
import ResultsPage from "./resultspage";

import type {
  BlastParameters,
  BlastpParameters,
} from "@/app/[blastFlavour]/parameters";
import type { BlastJobResults } from "@/app/api/[...jobId]/route";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";

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

function InfoCard({
  header,
  children,
}: {
  header: ReactNode;
  children: ReactNode;
}): React.JSX.Element {
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b py-3">
        <CardTitle className="text-sm">{header}</CardTitle>
      </CardHeader>
      <CardContent className="p-2">{children}</CardContent>
    </Card>
  );
}

function UsedParameters({ data }: { data: BlastJobResults }) {
  let { parameters } = data;
  const {
    flavour,
    queryTo,
    queryFrom,
    taxids,
    gapCosts,
    excludeTaxids,
    maxTargetSeqs,
    expectThreshold,
    lcaseMasking,
  } = parameters as BlastParameters;

  let additionalParams: { [key: string]: string } = {};
  if (flavour === "blastp") {
    const { matrix, wordSize } = parameters as BlastpParameters;
    Object.assign(additionalParams, { matrix, wordSize });
  }

  if (queryFrom) {
    Object.assign(additionalParams, { queryFrom });
  }
  if (queryTo) {
    Object.assign(additionalParams, { queryTo });
  }
  if (lcaseMasking) {
    Object.assign(additionalParams, { lcaseMasking: "true" });
  }

  return (
    <InfoCard header="Used parameters">
      <Table className="text-xs">
        <TableBody>
          <TableRow>
            <TableCell>Gap costs</TableCell>
            <TableCell>{gapCosts}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Max. target seqs</TableCell>
            <TableCell>{maxTargetSeqs}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>E-value threshold</TableCell>
            <TableCell>{expectThreshold}</TableCell>
          </TableRow>
          {taxids && taxids.length > 0 && (
            <TableRow>
              <TableCell>
                {excludeTaxids ? "Excluded tax. IDs" : "Tax. IDs"}
              </TableCell>
              <TableCell>
                <ul>
                  {taxids.map((taxid) => (
                    <li key={taxid}>{taxid}</li>
                  ))}
                </ul>
              </TableCell>
            </TableRow>
          )}
          {Object.entries(additionalParams).map(([name, value]) => (
            <TableRow key={name}>
              <TableCell>{name}</TableCell>
              <TableCell>{value}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </InfoCard>
  );
}

function JobStatus({ jobId, data }: { jobId: string; data: BlastJobResults }) {
  const { parameters, submitted, finished, results, err } = data;
  const { jobTitle, program, database } = parameters as BlastParameters;
  return (
    <InfoCard
      header={
        <span className="flex items-center gap-2">
          Job ID
          <Badge variant="secondary">{jobId}</Badge>
        </span>
      }
    >
      <Table className="text-xs">
        <TableBody>
          <TableRow>
            <TableCell>Job Title</TableCell>
            <TableCell>{jobTitle || "Protein Sequence"}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Program</TableCell>
            <TableCell>{program.toUpperCase()}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Database</TableCell>
            <TableCell>{database}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Submitted</TableCell>
            <TableCell>
              {new Date(submitted)?.toLocaleString("en-GB")}
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Status</TableCell>
            <TableCell>
              {results || err
                ? `Finished at ${new Date(finished || "")?.toLocaleString(
                    "en-GB"
                  )}`
                : "In progress"}
            </TableCell>
          </TableRow>
          {results && (
            <>
              <TableRow>
                <TableCell>Query ID</TableCell>
                <TableCell>{results.queryId}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Description</TableCell>
                <TableCell>{results.queryTitle}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Query length</TableCell>
                <TableCell>{results.queryLen}</TableCell>
              </TableRow>
            </>
          )}
        </TableBody>
      </Table>
    </InfoCard>
  );
}

export default function ResultsWrapper({
  params,
}: {
  params: Promise<{
    jobId: string;
  }>;
}): React.JSX.Element {
  const { jobId } = use(params);
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

  const { data, isLoading, error } = useSWR<BlastJobResults, Error>(
    `${basePath}/api/${jobId}`,
    fetcher,
    {
      refreshInterval: (data) => {
        // check whether blast is finished every 4 seconds, stop checking when done
        return data?.results || data?.err ? 0 : 4_000;
      },
      revalidateOnMount: true,
    }
  );

  if (error) return <ErrorComponent statusCode={500} />;
  if (isLoading || !data) {
    return (
      <div className="container mx-auto px-4 py-6">
        <Skeleton className="h-8 w-32" />
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_3fr]">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <h2 className="mb-4 text-xl font-semibold">Results</h2>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_3fr]">
        <JobStatus jobId={jobId} data={data} />
        <UsedParameters data={data} />
      </div>
      <div className="mt-6">
        <ResultsPage data={data} />
      </div>
    </div>
  );
}
