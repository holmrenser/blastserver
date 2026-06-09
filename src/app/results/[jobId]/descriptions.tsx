import React, { useState, useEffect, useCallback } from "react";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { Route } from "next";

import { BlastHit } from "../../api/[...jobId]/formatResults";
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
  const [selectAll, setSelectAll] = useState(false);

  function toggleSelectAll(): void {
    setSelectAll(!selectAll);
    if (!selectAll) {
      hits.forEach(({ accession }) => addItem(accession));
    } else {
      clearSelection();
    }
  }

  function checkSelectAll(): void {
    const allSelected =
      hits.filter(({ accession }) => selectionSet.has(accession)).length ===
      hits.length;
    setSelectAll(allSelected);
  }

  const cachedCheckSelectAll = useCallback(checkSelectAll, [
    selectionSet,
    hits,
  ]);

  useEffect(() => {
    cachedCheckSelectAll();
  }, [cachedCheckSelectAll]);

  function submitSelection() {
    fetch(`${basePath}/api/download`, {
      body: JSON.stringify({
        sequenceIds: Array.from(selectionSet),
        database,
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
          checked={selectAll}
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
              return (
                <TableRow key={num}>
                  <TableCell>
                    <Checkbox
                      checked={selectionSet.has(accession)}
                      onCheckedChange={() => {
                        toggleSelection(accession);
                        checkSelectAll();
                      }}
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
              );
            }
          )}
        </TableBody>
      </Table>
    </div>
  );
}
