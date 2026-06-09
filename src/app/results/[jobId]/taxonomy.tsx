import React from "react";
import { flattenDeep } from "lodash";

import { TaxonomyNode, BlastHit } from "../../api/[...jobId]/formatResults";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type FormattedTaxonomyNode = TaxonomyNode & {
  isLast: boolean;
  hasSiblings: boolean;
  siblingLevels: number[];
};

function* depthFirst(
  tree: TaxonomyNode,
  depth = 0,
  siblingLevels: number[] = [],
  isLast: boolean = false,
  hasSiblings: boolean = false
): Generator<FormattedTaxonomyNode> {
  if (isLast) {
    siblingLevels = siblingLevels.filter((l) => l !== depth - 1);
  }
  yield { depth, isLast, hasSiblings, siblingLevels, ...tree };
  const { children } = tree;
  if (typeof children !== "undefined" && children.length) {
    for (const [index, childTree] of children.entries()) {
      const isLast = index === children.length - 1;
      const hasSiblings = children.length > 1;
      if (hasSiblings && !isLast) {
        siblingLevels.push(depth);
      }
      yield* depthFirst(childTree, depth + 1, siblingLevels, isLast, hasSiblings);
    }
  }
}

function getTreePrefix({
  depth,
  isLast,
  siblingLevels,
}: {
  depth: number;
  isLast: boolean;
  siblingLevels: number[];
  name: string;
}): string {
  const prefix = Array(depth).fill(" "); //
  if (isLast) {
    prefix[prefix.length - 1] = "└─";
  } else {
    prefix[prefix.length - 1] = "├─";
  }
  siblingLevels.forEach((level) => {
    if (level < depth - 1) {
      prefix[level] = "│";
    }
  });
  return prefix.join("");
}

export default function Taxonomy({
  taxonomyTrees,
}: {
  hits: BlastHit[];
  taxonomyTrees: TaxonomyNode[];
}): React.JSX.Element {
  if (!taxonomyTrees.length) {
    return <h2 className="text-muted-foreground">No taxonomy info found</h2>;
  }
  const flatTrees = taxonomyTrees.map((taxonomyTree) =>
    Array.from(depthFirst(taxonomyTree))
  );
  const flatTree = flattenDeep(flatTrees);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3 rounded-md border bg-muted/50 px-3 py-2">
        <span className="font-semibold">Reports</span>
        <Tabs value="organism">
          <TabsList>
            <TabsTrigger value="lineage" disabled>
              Lineage
            </TabsTrigger>
            <TabsTrigger value="organism">Organism</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <Table className="text-sm">
        <TableHeader>
          <TableRow>
            <TableHead>Taxonomy</TableHead>
            <TableHead>Number of Hits</TableHead>
            <TableHead>Description</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {flatTree.map(
            ({
              name,
              count,
              id,
              depth = 0,
              isLast,
              children,
              siblingLevels = [],
            }) => (
              <TableRow key={id}>
                <TableCell>
                  <span className="font-mono">
                    {getTreePrefix({ depth, isLast, siblingLevels, name })}
                  </span>
                  <a
                    className="ml-1 text-primary hover:underline"
                    href={`https://www.ncbi.nlm.nih.gov/Taxonomy/Browser/wwwtax.cgi?id=${id}`}
                    target="_blank"
                    rel="noreferrer"
                    title={`Show taxonomy information for ${name} (taxid ${id})`}
                  >
                    {name}
                  </a>
                </TableCell>
                <TableCell>{count}</TableCell>
                <TableCell>{!children?.length && name}</TableCell>
              </TableRow>
            )
          )}
        </TableBody>
      </Table>
    </div>
  );
}
