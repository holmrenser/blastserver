import React from "react";
import Link from "next/link";
import type { Route } from "next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

type Moltype = "nucleotide" | "protein";

function MoltypePair({ label, value }: { label: string; value: Moltype }) {
  return (
    <div className="flex items-center">
      <Badge variant="outline" className="rounded-r-none">
        {label}
      </Badge>
      <Badge
        variant={value === "nucleotide" ? "purple" : "green"}
        className="rounded-l-none"
      >
        {value}
      </Badge>
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

function FlavourCard({
  query,
  target,
  children,
}: {
  query: Moltype;
  target: Moltype;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <QueryTargetTags query={query} target={target} />
      </CardHeader>
      <CardContent className="flex flex-col gap-2">{children}</CardContent>
    </Card>
  );
}

function FlavourButton({
  href,
  title,
  children,
}: {
  href: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Button asChild size="lg" className="w-full" variant="default">
      <Link prefetch href={href as Route} title={title}>
        {children}
      </Link>
    </Button>
  );
}

export default function HomePage() {
  return (
    <section className="container mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">BLAST SERVER</h1>
      <p className="mt-1 text-muted-foreground">WUR Bioinformatics Group</p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <FlavourCard query="protein" target="protein">
          <FlavourButton
            href="/blastp"
            title="Search a protein database with a protein query"
          >
            blastp
          </FlavourButton>
        </FlavourCard>

        <FlavourCard query="nucleotide" target="nucleotide">
          <FlavourButton
            href="/blastn"
            title="Search a nucleotide database with a nucleotide query"
          >
            blastn
          </FlavourButton>
          <FlavourButton
            href="/tblastx"
            title="Search a translated nucleotide database with a translated nucleotide query"
          >
            tblastx
          </FlavourButton>
        </FlavourCard>

        <FlavourCard query="nucleotide" target="protein">
          <FlavourButton
            href="/blastx"
            title="Search a protein database with a translated nucleotide query"
          >
            blastx
          </FlavourButton>
        </FlavourCard>

        <FlavourCard query="protein" target="nucleotide">
          <FlavourButton
            href="/tblastn"
            title="Search a translated nucleotide database with a protein query"
          >
            tblastn
          </FlavourButton>
        </FlavourCard>
      </div>
    </section>
  );
}
