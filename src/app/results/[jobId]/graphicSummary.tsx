import React from "react";
import Link from "next/link";
import type { Route } from "next";

import { BlastHit } from "../../api/[...jobId]/formatResults";

// Logical drawing width. The SVG is rendered at this fixed coordinate size and
// scaled responsively to its container via viewBox + width:100% (capped here),
// so no client-side window measurement is needed.
const LOGICAL_WIDTH = 600;

type Scale = (value: number) => number;

// scaleThreshold([40, 50, 80, 200]) over ["black","blue","green","magenta","red"].
function colorForScore(score: number): string {
  if (score < 40) return "black";
  if (score < 50) return "blue";
  if (score < 80) return "green";
  if (score < 200) return "magenta";
  return "red";
}

function XAxis({
  width,
  queryLength,
  xScale,
  numTicks,
}: {
  width: number;
  queryLength: number;
  xScale: Scale;
  numTicks: number;
}) {
  // https://heyjavascript.com/how-to-round-numbers-to-arbitrary-values/
  const roundTo = 10;
  const stepSize = Math.floor(queryLength / numTicks / roundTo + 0.5) * roundTo;
  const ticks = [];

  for (let i = 1; i < numTicks - 1; i += 1) {
    ticks.push(i * stepSize);
  }
  return (
    <g className="x-axis" transform="translate(0,0)">
      {/* backbone line */}
      <rect x={0} y={-16} width={width} height={16} style={{ fill: "#58c7c7" }} />
      <line x1="0" x2={width} y1="0" y2="0" stroke="black" />
      <text
        x={width / 2}
        y={-3}
        textAnchor="middle"
        fontSize="13"
        fontWeight="bold"
      >
        Query
      </text>
      {/* zero tick */}
      <line x1="0" x2="0" y1="0" y2="5" stroke="black" />
      <text x="0" y="15" dx="5" dy="5" textAnchor="middle">
        0
      </text>
      {/* middle ticks */}
      {ticks.map((tick) => {
        const pos = xScale(tick);
        return (
          <React.Fragment key={tick}>
            <line x1={pos} x2={pos} y1="0" y2="5" stroke="black" />
            <text x={pos} y="15" dx="5" dy="5" textAnchor="middle">
              {tick}
            </text>
          </React.Fragment>
        );
      })}
      {/* last tick */}
      <line x1={width} x2={width} y1="0" y2="5" stroke="black" />
      <text x={width} y="15" dx="5" dy="5" textAnchor="end">
        {queryLength}
      </text>
    </g>
  );
}

function HitPlotLine({
  hit,
  index,
  height,
  xScale,
  jobId,
}: {
  hit: BlastHit;
  index: number;
  height: number;
  xScale: Scale;
  jobId: string;
}) {
  const { hsps, accession, title } = hit;

  const alignmentsHref =
    `/results/${jobId}?panel=alignments#${accession}` as Route;

  const hspMin = Math.min(...hsps.map(({ queryFrom }) => Number(queryFrom)));
  const hspMax = Math.max(...hsps.map(({ queryTo }) => Number(queryTo)));

  return (
    <g transform={`translate(0,${index * height})`}>
      <line
        x1={xScale(hspMin)}
        x2={xScale(hspMax)}
        y1={height / 4}
        y2={height / 4}
        style={{ stroke: "black" }}
      />
      {hsps.map(({ queryFrom, queryTo, bitScore }) => {
        const width = Number(queryTo) - Number(queryFrom);
        return (
          <Link key={`${queryFrom}_${queryTo}_${bitScore}`} href={alignmentsHref}>
            <rect
              className="cursor-pointer stroke-transparent hover:stroke-foreground"
              strokeWidth={1}
              x={xScale(Number(queryFrom))}
              y={0}
              width={xScale(width)}
              height={height / 2}
              style={{ fill: colorForScore(Number(bitScore)) }}
            >
              <title>{title}</title>
            </rect>
          </Link>
        );
      })}
    </g>
  );
}

export default function GraphicSummary({
  hits,
  queryLength,
  jobId,
  lineHeight = 6,
}: {
  hits: Array<any>;
  queryLength: number;
  jobId: string;
  lineHeight?: number;
}): React.JSX.Element {
  const padding = {
    top: 20,
    bottom: 10,
    left: 20,
    right: 20,
  };
  const titleHeight = 30;
  const axisHeight = 30;
  const subset = hits;
  const paddedWidth = LOGICAL_WIDTH - padding.left - padding.right;
  const paddedHeight =
    lineHeight * subset.length +
    padding.top +
    padding.bottom +
    axisHeight +
    titleHeight;
  // Scale to map between query coordinates and screen coordinates
  const xScale: Scale = (value) => (value / queryLength) * paddedWidth;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-4 rounded-md border bg-muted/50 px-3 py-2 text-xs italic text-muted-foreground">
        <span>Hover to show title</span>
        <span>Click to show alignments</span>
      </div>
      <div className="flex justify-center rounded-md border bg-white p-2">
        <svg
          className="h-auto w-full"
          style={{ maxWidth: LOGICAL_WIDTH }}
          viewBox={`0 0 ${LOGICAL_WIDTH} ${paddedHeight}`}
        >
          <g
            className="blast-hit-plot"
            transform={`translate(${padding.left},${padding.top})`}
          >
            <text x={0} y={4} fontSize="14" fontWeight="bold">
              Distribution of BLAST hits on subject sequences
            </text>
            <g transform={`translate(0,${titleHeight})`}>
              <XAxis
                width={paddedWidth}
                queryLength={queryLength}
                xScale={xScale}
                numTicks={10}
              />
              <g className="hits" transform={`translate(0,${axisHeight})`}>
                {subset.map((hit, index) => (
                  <HitPlotLine
                    key={hit.accession}
                    hit={hit}
                    index={index}
                    xScale={xScale}
                    height={lineHeight}
                    jobId={jobId}
                  />
                ))}
              </g>
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
}
