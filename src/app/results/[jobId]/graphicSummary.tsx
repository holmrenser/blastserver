import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { scaleLinear, ScaleLinear, scaleThreshold } from 'd3';

import { BlastHit } from '../../api/[...jobId]/route';
import styles from './graphicSummary.module.scss';

function ColorScale(){

}

function XAxis({
  scale,
  numTicks
}: {
  scale: ScaleLinear<number, number>,
  numTicks: number
}) {
  const range = scale.range();
  const width = range[1];

  const domain = scale.domain();
  const queryLength = domain[1];

  // https://heyjavascript.com/how-to-round-numbers-to-arbitrary-values/
  const roundTo = 10;
  const stepSize = Math.floor(((queryLength / numTicks) / roundTo) + .5) * roundTo;
  const ticks = [];

  for (let i = 1; i < numTicks - 1; i += 1) {
    ticks.push(i * stepSize);
  }
  console.log({ ticks, queryLength, numTicks, stepSize })
  return (
    <g className="x-axis" transform="translate(0,0)">
      {/* backbone line */}
      <rect x={0} y={-16} width={width} height={16} style={{ fill: '#58c7c7' }}/>
      <line x1="0" x2={width} y1="0" y2="0" stroke="black" />
      <text x={width/2} y={-3} textAnchor='middle' fontSize='13' fontWeight='bold'>
        Query
      </text>
      {/* zero tick */}
      <line x1="0" x2="0" y1="0" y2="5" stroke="black" />
      <text x="0" y="15" dx="5" dy="5" textAnchor="middle">
        0
      </text>
      {/* middle ticks */}
      {ticks.map((tick) => {
        const pos = scale(tick);
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
  xScale
}: {
  hit: BlastHit,
  index: number,
  height: number,
  xScale: ScaleLinear<number, number>
}) {
  const pathname = usePathname();

  // Next doesn't properly handle basepath in usePathname, so we have to trim manually
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
  const linkPath = pathname.slice(basePath.length)

  const { hsps, accession, title } = hit;
  
  const colorMap = scaleThreshold<number, string>()
    .domain([40, 50, 80, 200])
    .range(['black', 'blue', 'green', 'magenta', 'red']);
  const hspMin = Math.min(...hsps.map(({ queryFrom }) => Number(queryFrom)));
  const hspMax = Math.max(...hsps.map(({ queryTo }) => Number(queryTo)));

  return (
    <g transform={`translate(0,${index * height})`}>
      <line
        x1={xScale(hspMin)}
        x2={xScale(hspMax)}
        y1={height/4}
        y2={height/4}
        style={{
          stroke: 'black'
        }}  
      />
      {hsps.map(({ queryFrom, queryTo, bitScore }) => {
        const width = Number(queryTo) - Number(queryFrom);
        return (
          <Link
            key={`${queryFrom}_${queryTo}_${bitScore}`}
            href={{
              pathname: linkPath,
              query: { panel: 'alignments' },
              hash: accession
            }}
          >
            <rect
              className={styles.blastHitRect}
              x={xScale(Number(queryFrom))}
              y={0}
              width={xScale(width)}
              height={height/2}
              style={{
                fill: colorMap(Number(bitScore)),
              }}
            >
              <title>
                {title}
              </title>
            </rect>
          </Link>
        )
      })}
    </g>
  );
}

export default function GraphicSummary({ 
  hits, 
  width=600,
  queryLength,
  lineHeight=6
}: {
  hits: Array<any>,
  width?: number,
  queryLength: number,
  lineHeight?: number
}): JSX.Element {
  const padding = {
    top: 20,
    bottom: 10,
    left: 20,
    right: 20
  };
  const titleHeight = 30;
  const axisHeight = 30;
  // Only show first 100 hits in this plot
  const subset = hits;//hits.length > 100 ? hits.slice(0, 100) : hits;
  // Take care of padding
  const paddedWidth = width - padding.left - padding.right;
  const paddedHeight = (lineHeight * subset.length) + padding.top + padding.bottom + axisHeight + titleHeight;
  // Scale to map between query coordinates and screen coordinates
  const xScale = scaleLinear()
    .domain([0, queryLength])
    .range([0, paddedWidth]);

  return (
    <div>
      <nav className='navbar has-background-info-light' role='navigation'>
        <div className='navbar-menu'>
          <div className='navbar-start'>
            <em className='navbar-item'>Hover to show title</em>
            <em className='navbar-item'>Click to show alignments</em>
          </div>
        </div>
      </nav>
      <div className='has-background-light'>
        <div className={`columns is-centered ${styles.figureBox}`}>
          <svg width={width} height={paddedHeight} style={{backgroundColor: 'white'}}>
            <g className="blast-hit-plot" transform={`translate(${padding.left},${padding.top})`}>
              <text x={0} y={4} fontSize='14' fontWeight='bold'>
                Distribution of BLAST hits on subject sequences
              </text>
              <g transform={`translate(0,${titleHeight})`}>
                <XAxis scale={xScale} numTicks={10} />
                <g className="hits" transform={`translate(0,${axisHeight})`}>
                  {
                    subset.map((hit, index) => (
                      <HitPlotLine
                        key={hit.accession}
                        hit={hit}
                        index={index}
                        xScale={xScale}
                        height={lineHeight}
                      />
                      )
                    )
                  }
                </g>
              </g>
            </g>
          </svg>
        </div>
      </div>
    </div>
  )
}