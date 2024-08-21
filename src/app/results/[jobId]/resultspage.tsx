"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import Descriptions from "./descriptions";
import GraphicSummary from "./graphicSummary";
import Alignments from "./alignments";
import Taxonomy from "./taxonomy";

import styles from "./resultspage.module.scss";
import { ThemeContext } from "@/app/themecontext";
import React, { useContext } from "react";
import type { BlastJobResults } from "@/app/api/[...jobId]/route";
import type { BlastHit } from "@/app/api/[...jobId]/formatResults";
import type { BlastParameters } from "@/app/[blastFlavour]/parameters";

// eslint-disable-next-line no-unused-vars
type PANEL_COMPONENT = (arg0: {
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
  const searchParams = useSearchParams();
  const { theme } = useContext(ThemeContext);

  const { results, err, parameters } = data;
  const { database } = parameters as BlastParameters;

  // Next doesn't properly handle basepath in usePathname, so we have to trim manually
  // const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  // const linkPath = pathname.slice(basePath.length);

  if (err) return <p>{err}</p>;
  if (!results)
    return <p>This page will automatically update once your job is ready</p>;

  const activePanel = searchParams.get("panel") || "descriptions";
  const PanelComponent = PANEL_COMPONENTS[activePanel];
  const { queryLen, hits, taxonomyTrees, message } = results;

  return (
    <>
      {message}
      {!message && (
        <div
          className={`${
            theme === "dark" ? "has-background-grey" : "has-background-light"
          }`}
          style={{ marginLeft: -12, marginRight: -12 }}
        >
          <div
            className={`tabs is-boxed panel-nav ${
              theme === "dark" ? "has-background-dark" : "has-background-white"
            } ${styles.navPanel}`}
          >
            <ul>
              {Object.keys(PANEL_COMPONENTS).map((panel) => {
                return (
                  <li
                    key={panel}
                    className={`${panel === activePanel ? "is-active" : ""}`}
                  >
                    <Link
                      className={`${
                        theme === "dark"
                          ? styles.darkTabLink
                          : styles.lightTabLink
                      } ${panel === activePanel ? styles.isActive : ""}`}
                      href={{ pathname, query: { panel } }}
                    >
                      {formatPanelName(panel)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
          <PanelComponent
            hits={hits || []}
            queryLength={Number(queryLen)}
            taxonomyTrees={taxonomyTrees}
            database={database}
          />
        </div>
      )}
    </>
  );
}
