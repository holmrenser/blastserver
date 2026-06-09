import React from "react";

import { BlastHit, Hsp } from "../../api/[...jobId]/formatResults";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function padAligmentStrings(hsp: Hsp) {
  const { qseq, midline, hseq, queryFrom, queryTo, hitFrom, hitTo } = hsp;
  const maxFrom = Math.max(queryFrom.length, hitFrom.length);
  const paddedQueryFrom =
    " ".repeat(maxFrom - queryFrom.length) + ` ${queryFrom}`;
  const paddedHitFrom = " ".repeat(maxFrom - hitFrom.length) + ` ${hitFrom}`;
  const paddedQseq = `Query ${paddedQueryFrom} ${qseq} ${queryTo}`;
  const paddedMidline = `${" ".repeat(maxFrom + 7)} ${midline}`;
  const paddedHseq = `Sbjct ${paddedHitFrom} ${hseq} ${hitTo}`;
  return [paddedQseq, paddedMidline, paddedHseq];
}

function HspBlock({ hsp }: { hsp: Hsp }): React.JSX.Element {
  const { score, evalue: _evalue, midline, bitScore } = hsp;
  const evalue = Number(_evalue);
  const formattedEvalue = evalue === 0 ? evalue : evalue.toExponential(0);
  const alignLen = Number(hsp.alignLen);
  const positives = midline.split("+").length - 1;
  const gaps = midline.split(" ").length - 1;
  const identities = alignLen - positives - gaps;
  const [paddedQseq, paddedMidline, paddedHseq] = padAligmentStrings(hsp);
  return (
    <div className="flex flex-col gap-2">
      <Table className="w-auto text-xs">
        <TableHeader>
          <TableRow>
            <TableHead>Score</TableHead>
            <TableHead>Expect</TableHead>
            <TableHead>Identities</TableHead>
            <TableHead>Positives</TableHead>
            <TableHead>Gaps</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>
              {Math.floor(Number(bitScore))} bits ({score})
            </TableCell>
            <TableCell>{formattedEvalue}</TableCell>
            <TableCell>
              {identities}/{alignLen}(
              {Math.floor((identities / alignLen) * 100)}%)
            </TableCell>
            <TableCell>
              {positives}/{alignLen}(
              {Math.floor((positives / alignLen) * 100)}%)
            </TableCell>
            <TableCell>
              {gaps}/{alignLen}({Math.floor((gaps / alignLen) * 100)}%)
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
      <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs">
        {paddedQseq}
        <br />
        {paddedMidline}
        <br />
        {paddedHseq}
      </pre>
    </div>
  );
}

function HitPanel({ hit }: { hit: BlastHit }): React.JSX.Element {
  const { accession, title, len, hsps } = hit;
  return (
    <Card id={accession} className="scroll-mt-20">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <p>
          Sequence ID:{" "}
          <a
            className="text-primary hover:underline"
            href={`https://www.ncbi.nlm.nih.gov/protein/${accession}`}
            target="_blank"
            rel="noreferrer"
          >
            {accession}
          </a>{" "}
          Length: <b>{len}</b> Number of hits: <b>{hsps.length}</b>
        </p>
        <ul className="flex flex-col gap-6">
          {hsps.map((hsp) => (
            <li key={hsp.num}>
              <HspBlock hsp={hsp} />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export default function Alignments({
  hits,
}: {
  hits: BlastHit[];
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3 rounded-md border bg-muted/50 px-3 py-2">
        <span className="font-semibold">Alignment view</span>
        <Badge variant="outline">Pairwise</Badge>
      </div>
      <ul className="flex flex-col gap-3">
        {hits.map((hit) => (
          <li key={hit.accession}>
            <HitPanel hit={hit} />
          </li>
        ))}
      </ul>
    </div>
  );
}
