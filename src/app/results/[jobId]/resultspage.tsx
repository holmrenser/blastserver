"use client";

import React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";

import Descriptions from "./descriptions";
import GraphicSummary from "./graphicSummary";
import Alignments from "./alignments";
import Taxonomy from "./taxonomy";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { BlastJobResults } from "@/app/api/[...jobId]/route";
import type { BlastHit } from "@/app/api/[...jobId]/formatResults";
import type { BlastParameters } from "@/app/[blastFlavour]/parameters";

type PANEL_COMPONENT = (_options: {
  hits: BlastHit[];
  queryLength: number;
  taxonomyTrees: any;
  database: string;
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

export default function ResultsPage({ data }: { data: BlastJobResults }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const { results, err, parameters } = data;
  const { database } = parameters as BlastParameters;

  if (err) return <p className="text-destructive">{err}</p>;
  if (!results)
    return (
      <p className="text-muted-foreground">
        This page will automatically update once your job is ready
      </p>
    );

  const activePanel = searchParams.get("panel") || "descriptions";
  const PanelComponent = PANEL_COMPONENTS[activePanel];
  const { queryLen, hits, taxonomyTrees, message } = results;

  if (message) return <>{message}</>;

  return (
    <div className="flex flex-col gap-4">
      <Tabs
        value={activePanel}
        onValueChange={(panel) =>
          router.push(`${pathname}?panel=${panel}` as Route)
        }
      >
        <TabsList>
          {Object.keys(PANEL_COMPONENTS).map((panel) => (
            <TabsTrigger key={panel} value={panel}>
              {formatPanelName(panel)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <PanelComponent
        hits={hits || []}
        queryLength={Number(queryLen)}
        taxonomyTrees={taxonomyTrees}
        database={database}
      />
    </div>
  );
}
