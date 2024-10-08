"use client";

import useSWR from "swr";
import React from "react";
import type { ReactNode } from "react";

import ErrorComponent from "@/app/results/error";
import ResultsPage from "./resultspage";

import type {
  BlastParameters,
  BlastpParameters,
} from "@/app/[blastFlavour]/parameters";
import type { BlastJobResults } from "@/app/api/[...jobId]/route";
import { useContext } from "react";
import { ThemeContext } from "@/app/themecontext";
// import { FormattedBlastResults } from "@/app/api/[...jobId]/formatResults";

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
  const { theme } = useContext(ThemeContext);
  return (
    <div
      className={`card ${theme === "dark" ? "has-background-grey-dark" : ""}`}
    >
      <header className="card-header">
        <p className="card-header-title">{header}</p>
      </header>
      <div className="card-content" style={{ padding: "8px" }}>
        {children}
      </div>
    </div>
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

  const { theme } = useContext(ThemeContext);

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
      <table
        className={`table is-small is-size-7 ${
          theme === "dark" ? "has-background-grey-dark has-text-light" : ""
        }`}
      >
        <tbody>
          <tr>
            <td>Gap costs</td>
            <td>{gapCosts}</td>
          </tr>
          <tr>
            <td>Max. target seqs</td>
            <td>{maxTargetSeqs}</td>
          </tr>
          <tr>
            <td>E-value threshold</td>
            <td>{expectThreshold}</td>
          </tr>
          {taxids && (
            <tr>
              <td>{excludeTaxids ? "Excluded tax. IDs" : "Tax. IDs"}</td>
              <td>
                <ul>
                  {taxids.map((taxid) => (
                    <li key={taxid}>{taxid}</li>
                  ))}
                </ul>
              </td>
            </tr>
          )}
          {Object.entries(additionalParams).map(([name, value]) => (
            <tr key={name}>
              <td>{name}</td>
              <td>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </InfoCard>
  );
}

function JobStatus({ jobId, data }: { jobId: string; data: BlastJobResults }) {
  const { theme } = useContext(ThemeContext);
  const { parameters, submitted, finished, results, err } = data;
  const { jobTitle, program, database } = parameters as BlastParameters;
  // Job&nbsp;ID <span style={{marginLeft: '8px'}} className='tag is-info is-light'>{jobId}</span>
  return (
    <InfoCard
      header={
        <>
          Job&nbsp;ID{" "}
          <span style={{ marginLeft: "8px" }} className="tag is-info is-light">
            {jobId}
          </span>
        </>
      }
    >
      <table
        className={`table is-small is-size-7 ${
          theme === "dark" ? "has-background-grey-dark has-text-light" : ""
        }`}
      >
        <tbody>
          <tr>
            <td>Job Title</td>
            <td>{jobTitle || "Protein Sequence"}</td>
          </tr>
          <tr>
            <td>Program</td>
            <td>{program.toUpperCase()}</td>
          </tr>
          <tr>
            <td>Database</td>
            <td>{database}</td>
          </tr>
          <tr>
            <td>Submitted</td>
            <td>{new Date(submitted)?.toLocaleString("en-GB")}</td>
          </tr>
          <tr>
            <td>Status</td>
            <td>
              {results || err
                ? `Finished at ${new Date(finished || "")?.toLocaleString(
                    "en-GB"
                  )}`
                : "In progress"}
            </td>
          </tr>
          {results && (
            <>
              <tr>
                <td>Query ID</td>
                <td>{results.queryId}</td>
              </tr>
              <tr>
                <td>Description</td>
                <td>{results.queryTitle}</td>
              </tr>
              <tr>
                <td>Query length</td>
                <td>{results.queryLen}</td>
              </tr>
            </>
          )}
        </tbody>
      </table>
    </InfoCard>
  );
}

function Status({ message }: { message: string }) {
  return (
    <section className="hero is-fullheight">
      <h1 className="title">{message}</h1>
    </section>
  );
}

export default function ResultsWrapper({
  params,
}: {
  params: {
    jobId: string;
  };
}): React.JSX.Element {
  const { jobId } = params;
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
  if (isLoading) return <Status message="loading" />;
  if (!data) return <Status message="fetching" />;

  return (
    <div className="container is-fullhd">
      <h2 className="subtitle">Results</h2>
      <div className="grid">
        <div
          className="cell"
          style={{ flexBasis: "25%", flexGrow: 0, paddingBottom: "4px" }}
        >
          <JobStatus jobId={jobId} data={data} />
        </div>
        <div className="cell" style={{ paddingBottom: "4px" }}>
          <UsedParameters data={data} />
        </div>
      </div>
      <ResultsPage data={data} />
    </div>
  );
}
