import React from "react";
import Link from "next/link";
import type { Route } from "next";

import Descriptions from "./descriptions";
import GraphicSummary from "./graphicSummary";
import Alignments from "./alignments";
import Taxonomy from "./taxonomy";

import { cn } from "@/lib/utils";
import type { BlastJobResults } from "@/lib/blastJob";
import type { BlastHit } from "@/app/api/[...jobId]/formatResults";
import type { BlastParameters } from "@/app/[blastFlavour]/parameters";

type PANEL_COMPONENT = (_options: {
  hits: BlastHit[];
  queryLength: number;
  taxonomyTrees: any;
  database: string;
  jobId: string;
}) => React.JSX.Element;

const PANEL_COMPONENTS: Record<string, PANEL_COMPONENT> = {
  descriptions: Descriptions,
  graphic_summary: GraphicSummary,
  alignments: Alignments,
  taxonomy: Taxonomy,
};

function formatPanelName(panelName: string): string {
  return panelName
    .split("_")
    .map((namePart) => namePart[0].toUpperCase() + namePart.substring(1))
    .join(" ");
}

export default function ResultsPage({
  data,
  jobId,
  activePanel,
}: {
  data: BlastJobResults;
  jobId: string;
  activePanel: string;
}) {
  const { results, err, parameters } = data;
  const { database } = parameters as BlastParameters;

  if (err) return <p className="text-destructive">{err}</p>;
  if (!results)
    return (
      <p className="text-muted-foreground">
        This page will automatically update once your job is ready
      </p>
    );

  const PanelComponent = PANEL_COMPONENTS[activePanel] || PANEL_COMPONENTS.descriptions;
  const { queryLen, hits, taxonomyTrees, message } = results;

  if (message) return <>{message}</>;

  return (
    <div className="flex flex-col gap-4">
      {/* Server-rendered tab bar: each tab is a <Link> driving the ?panel= search
          param, so the active panel renders on the server (no client Tabs). */}
      <nav className="inline-flex h-8 w-fit items-center justify-center gap-0.5 rounded-lg bg-muted p-[3px] text-muted-foreground">
        {Object.keys(PANEL_COMPONENTS).map((panel) => {
          const isActive = panel === activePanel;
          return (
            <Link
              key={panel}
              href={`/results/${jobId}?panel=${panel}` as Route}
              data-active={isActive ? "" : undefined}
              className={cn(
                "inline-flex h-[calc(100%-1px)] items-center justify-center rounded-md border border-transparent px-2 py-0.5 text-sm font-medium whitespace-nowrap transition-all",
                isActive
                  ? "bg-background text-foreground shadow-sm dark:border-input dark:bg-input/30"
                  : "text-foreground/60 hover:text-foreground dark:text-muted-foreground dark:hover:text-foreground"
              )}
            >
              {formatPanelName(panel)}
            </Link>
          );
        })}
      </nav>
      <PanelComponent
        hits={hits || []}
        queryLength={Number(queryLen)}
        taxonomyTrees={taxonomyTrees}
        database={database}
        jobId={jobId}
      />
    </div>
  );
}
