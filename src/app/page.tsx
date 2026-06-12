import React from "react";
import Link from "next/link";
import type { Route } from "next";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Moltype = "nucleotide" | "protein";
type Combo = "blue" | "amber" | "green";

/** Same molecule type on both axes uses that type's color; a mixed search
 *  bridges both worlds → green. */
const comboFor = (query: Moltype, target: Moltype): Combo =>
  query === target ? (query === "nucleotide" ? "blue" : "amber") : "green";

/** Static class strings (Tailwind-safe — no interpolation). */
const cellTint: Record<Combo, string> = {
  blue: "bg-accent-blue/5 ring-accent-blue/30",
  amber: "bg-accent-amber/5 ring-accent-amber/30",
  green: "bg-accent-green/5 ring-accent-green/30",
};

const cellButton: Record<Combo, string> = {
  blue: "border-accent-blue/40 text-accent-blue hover:bg-accent-blue/10 hover:text-accent-blue",
  amber:
    "border-accent-amber/40 text-accent-amber hover:bg-accent-amber/10 hover:text-accent-amber",
  green:
    "border-accent-green/40 text-accent-green hover:bg-accent-green/10 hover:text-accent-green",
};

/** Grid placement within the desktop matrix (rows = query, cols = target). */
const cellPosition: Record<`${Moltype}-${Moltype}`, string> = {
  "nucleotide-nucleotide": "md:col-start-3 md:row-start-3",
  "nucleotide-protein": "md:col-start-4 md:row-start-3",
  "protein-nucleotide": "md:col-start-3 md:row-start-4",
  "protein-protein": "md:col-start-4 md:row-start-4",
};

type Cell = {
  query: Moltype;
  target: Moltype;
  flavours: { slug: string; title: string }[];
};

const MATRIX: Cell[] = [
  {
    query: "nucleotide",
    target: "nucleotide",
    flavours: [
      {
        slug: "blastn",
        title: "Search a nucleotide database with a nucleotide query",
      },
      {
        slug: "tblastx",
        title:
          "Search a translated nucleotide database with a translated nucleotide query",
      },
    ],
  },
  {
    query: "nucleotide",
    target: "protein",
    flavours: [
      {
        slug: "blastx",
        title: "Search a protein database with a translated nucleotide query",
      },
    ],
  },
  {
    query: "protein",
    target: "nucleotide",
    flavours: [
      {
        slug: "tblastn",
        title: "Search a translated nucleotide database with a protein query",
      },
    ],
  },
  {
    query: "protein",
    target: "protein",
    flavours: [
      {
        slug: "blastp",
        title: "Search a protein database with a protein query",
      },
    ],
  },
];

function MoltypeBadge({
  value,
  className,
}: {
  value: Moltype;
  className?: string;
}) {
  return (
    <Badge
      variant={value === "nucleotide" ? "blue" : "amber"}
      className={className}
    >
      {value}
    </Badge>
  );
}

/** Label + colored moltype, shown inside each cell on mobile (where the
 *  desktop axis rails are hidden). */
function MoltypePair({ label, value }: { label: string; value: Moltype }) {
  return (
    <div className="flex items-center">
      <Badge variant="outline" className="rounded-r-none">
        {label}
      </Badge>
      <MoltypeBadge value={value} className="rounded-l-none" />
    </div>
  );
}

function QueryTargetTags({
  query,
  target,
}: {
  query: Moltype;
  target: Moltype;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <MoltypePair label="Query" value={query} />
      <MoltypePair label="Target" value={target} />
    </div>
  );
}

function FlavourButton({
  href,
  title,
  combo,
  children,
}: {
  href: string;
  title: string;
  combo: Combo;
  children: React.ReactNode;
}) {
  return (
    <Button
      asChild
      size="lg"
      variant="outline"
      className={cn("w-full font-semibold", cellButton[combo])}
    >
      <Link prefetch href={href as Route} title={title}>
        {children}
      </Link>
    </Button>
  );
}

function FlavourCell({ cell }: { cell: Cell }) {
  const combo = comboFor(cell.query, cell.target);
  return (
    <Card
      className={cn(
        "justify-center",
        cellTint[combo],
        cellPosition[`${cell.query}-${cell.target}`],
      )}
    >
      <CardContent className="flex flex-col gap-2">
        <div className="md:hidden">
          <QueryTargetTags query={cell.query} target={cell.target} />
        </div>
        {cell.flavours.map((f) => (
          <FlavourButton
            key={f.slug}
            href={`/${f.slug}`}
            title={f.title}
            combo={combo}
          >
            {f.slug}
          </FlavourButton>
        ))}
      </CardContent>
    </Card>
  );
}

const axisWord =
  "text-xs font-semibold uppercase tracking-widest text-muted-foreground";

export default function HomePage() {
  return (
    <section className="container mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">BLAST SERVER</h1>
      <p className="mt-1 text-muted-foreground">WUR Bioinformatics Group</p>
      <p className="mt-4 max-w-prose text-sm text-muted-foreground">
        Pick a search by the molecule type of your query and the target
        database.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>Color key:</span>
        <Badge variant="blue">nucleotide</Badge>
        <Badge variant="amber">protein</Badge>
        <Badge variant="green">combined</Badge>
      </div>

      <div className="mt-8 flex max-w-4xl flex-col gap-4 md:grid md:grid-cols-[auto_auto_1fr_1fr] md:grid-rows-[auto_auto_1fr_1fr] md:gap-3">
        {/* Axis rails — desktop only */}
        <div
          className={cn(
            "hidden items-end justify-center pb-1 md:flex",
            axisWord,
          )}
          style={{ gridColumn: "3 / span 2", gridRow: "1" }}
        >
          Target
        </div>
        <div className="hidden md:col-start-3 md:row-start-2 md:flex md:justify-center">
          <MoltypeBadge value="nucleotide" />
        </div>
        <div className="hidden md:col-start-4 md:row-start-2 md:flex md:justify-center">
          <MoltypeBadge value="protein" />
        </div>
        <div
          className="hidden items-center justify-center pr-1 md:col-start-1 md:flex"
          style={{ gridRow: "3 / span 2" }}
        >
          <span
            className={cn("rotate-180 [writing-mode:vertical-rl]", axisWord)}
          >
            Query
          </span>
        </div>
        <div className="hidden w-7 items-center justify-center md:col-start-2 md:row-start-3 md:flex">
          <MoltypeBadge value="nucleotide" className="-rotate-90" />
        </div>
        <div className="hidden w-7 items-center justify-center md:col-start-2 md:row-start-4 md:flex">
          <MoltypeBadge value="protein" className="-rotate-90" />
        </div>

        {/* Cells */}
        {MATRIX.map((cell) => (
          <FlavourCell key={`${cell.query}-${cell.target}`} cell={cell} />
        ))}
      </div>
    </section>
  );
}
