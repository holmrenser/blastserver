"use client";

import React, { useState } from "react";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { Route } from "next";
import { ChevronDown, ChevronRight } from "lucide-react";

import { BlastHit } from "../../api/[...jobId]/formatResults";
import { isClusteredDatabase } from "@/lib/blast/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function truncate(string: string, limit = 20) {
  if (string.length <= limit) return string;
  return string.slice(0, limit) + "...";
}

function useSelectionSet<T>(): [Set<T>, Function, Function, Function] {
  const [selectionSet, setSelectionSet] = useState((): Set<T> => new Set());
  function addItem(item: T): void {
    setSelectionSet((prev) => new Set(prev).add(item));
  }

  function clearSelection(): void {
    setSelectionSet(() => new Set());
  }

  function removeItem(item: T): void {
    setSelectionSet((prev) => {
      const next = new Set(prev);
      next.delete(item);
      return next;
    });
  }

  function toggleItemSelection(item: T): void {
    if (selectionSet.has(item)) {
      removeItem(item);
    } else {
      addItem(item);
    }
  }
  return [selectionSet, toggleItemSelection, clearSelection, addItem];
}

const COLUMNS = [
  "Description",
  "Scientific Name",
  "Cluster",
  "Max Score",
  "Total Score",
  "Query Cover",
  "E value",
  "Per. Ident.",
  "Acc. Len.",
  "Accession",
];

export default function Descriptions({
  hits,
  database,
}: {
  hits: BlastHit[];
  database: string;
}): React.JSX.Element {
  const pathname = usePathname();
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const router = useRouter();

  const [selectionSet, toggleSelection, clearSelection, addItem] =
    useSelectionSet<string>();
  // Rows whose cluster member list is expanded (keyed by hit `num`).
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  function toggleExpanded(key: string): void {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }
  // "Select all" is fully derived from the selection: checked iff every hit is
  // currently selected (vacuously true when there are no hits, matching the
  // previous effect-synced behavior).
  const allSelected = hits.every(({ accession }) =>
    selectionSet.has(accession)
  );

  function toggleSelectAll(): void {
    if (!allSelected) {
      hits.forEach(({ accession }) => addItem(accession));
    } else {
      clearSelection();
    }
  }

  function submitSelection() {
    // clustered_nr holds only representative sequences, so cluster members (and the
    // reps) are fetched from nr instead — both are retrievable there.
    const downloadDatabase = isClusteredDatabase(database) ? "nr" : database;
    fetch(`${basePath}/api/download`, {
      body: JSON.stringify({
        sequenceIds: Array.from(selectionSet),
        database: downloadDatabase,
      }),
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      method: "POST",
    })
      .then((res) => res.json())
      .then((data) => {
        const { jobId }: { jobId: string } = data;
        router.push(`/download/${jobId}` as Route);
      });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/50 px-3 py-2">
        <span className="flex items-center gap-2 font-semibold">
          <Badge variant="secondary">{hits.length}</Badge>
          Significant alignments
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={submitSelection}
          disabled={selectionSet.size === 0}
        >
          Download
        </Button>
      </div>

      <Label className="flex w-fit items-center gap-2 font-normal">
        <Checkbox
          checked={allSelected}
          onCheckedChange={() => toggleSelectAll()}
        />
        Select all
      </Label>

      <Table className="text-xs">
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            {COLUMNS.map((header) => (
              <TableHead key={header}>{header}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {hits.map(
            ({
              accession,
              title,
              taxid,
              name,
              queryCover,
              num,
              len,
              hsps,
              percentIdentity,
              members,
              clusterSize,
            }) => {
              const scores = hsps.map(({ bitScore }) => Number(bitScore));
              const maxScore = Math.floor(Math.max(...scores));
              const totalScore = Math.floor(
                scores.reduce((total, score) => total + score, 0)
              );
              const evalues = hsps.map(({ evalue }) => Number(evalue));
              const evalue = Math.min(...evalues);
              const formattedEvalue =
                evalue === 0 ? evalue : evalue.toExponential(0);
              // Distinct taxa across the cluster (representative + members).
              const extraTaxa =
                new Set(members.map((member) => member.taxid)).size - 1;
              const isExpanded = expanded.has(num);
              const isCluster = clusterSize > 1;
              return (
                <React.Fragment key={num}>
                  <TableRow>
                    <TableCell>
                      <Checkbox
                        checked={selectionSet.has(accession)}
                        onCheckedChange={() => toggleSelection(accession)}
                      />
                    </TableCell>
                    <TableCell>
                      <Link
                        className="text-primary hover:underline"
                        href={{
                          pathname,
                          query: { panel: "alignments" },
                          hash: accession,
                        }}
                      >
                        {title.slice(0, 100)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <a
                        className="text-primary hover:underline"
                        href={`https://www.ncbi.nlm.nih.gov/Taxonomy/Browser/wwwtax.cgi?id=${taxid}`}
                        target="_blank"
                        rel="noreferrer"
                        title={name}
                      >
                        {truncate(name)}
                      </a>
                      {extraTaxa > 0 && (
                        <span className="ml-1 text-muted-foreground">
                          (+{extraTaxa} taxa)
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {isCluster ? (
                        <button
                          type="button"
                          className="flex items-center gap-1 text-primary hover:underline"
                          onClick={() => toggleExpanded(num)}
                          aria-expanded={isExpanded}
                          title={`${clusterSize} sequences in this cluster`}
                        >
                          {isExpanded ? (
                            <ChevronDown className="size-3" />
                          ) : (
                            <ChevronRight className="size-3" />
                          )}
                          {clusterSize}
                        </button>
                      ) : (
                        <span className="text-muted-foreground">1</span>
                      )}
                    </TableCell>
                    <TableCell>{maxScore}</TableCell>
                    <TableCell>{totalScore}</TableCell>
                    <TableCell>{queryCover}%</TableCell>
                    <TableCell>{formattedEvalue}</TableCell>
                    <TableCell>{percentIdentity.toFixed(2)}%</TableCell>
                    <TableCell>{len}</TableCell>
                    <TableCell>
                      <a
                        className="text-primary hover:underline"
                        href={`https://www.ncbi.nlm.nih.gov/protein/${accession}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {accession}
                      </a>
                    </TableCell>
                  </TableRow>
                  {isCluster && isExpanded && (
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableCell />
                      <TableCell colSpan={COLUMNS.length}>
                        <div className="flex flex-col gap-1">
                          <span className="font-semibold">
                            Cluster members ({clusterSize})
                          </span>
                          <Table className="text-xs">
                            <TableBody>
                              {members.map((member) => (
                                <TableRow key={member.accession}>
                                  <TableCell className="w-8">
                                    <Checkbox
                                      checked={selectionSet.has(
                                        member.accession
                                      )}
                                      onCheckedChange={() =>
                                        toggleSelection(member.accession)
                                      }
                                    />
                                  </TableCell>
                                  <TableCell className="w-32">
                                    <a
                                      className="text-primary hover:underline"
                                      href={`https://www.ncbi.nlm.nih.gov/protein/${member.accession}`}
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      {member.accession}
                                    </a>
                                  </TableCell>
                                  <TableCell className="w-48">
                                    <a
                                      className="text-primary hover:underline"
                                      href={`https://www.ncbi.nlm.nih.gov/Taxonomy/Browser/wwwtax.cgi?id=${member.taxid}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      title={member.name}
                                    >
                                      {truncate(member.name)}
                                    </a>
                                  </TableCell>
                                  <TableCell>
                                    {member.title.slice(0, 100)}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            }
          )}
        </TableBody>
      </Table>
    </div>
  );
}
