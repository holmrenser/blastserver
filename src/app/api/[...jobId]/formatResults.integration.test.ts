// Integration (real Postgres): exercises clustered_nr enrichment end to end —
// seed cluster_lca / cluster_member + taxonomy, feed a constructed outfmt-16 XML
// (no BLAST DB needed), and assert formatResults folds in the LCA + members.
//
// Uses synthetic taxids well above NCBI's range so it never reads/deletes real
// taxonomy rows, and a randomized representative so parallel/leftover rows can't
// collide.

import { randomBytes } from "crypto";
import { createPrismaClient } from "@/lib/prisma";
import formatResults from "./formatResults";

const prisma = createPrismaClient();

const REP = `ITEST_REP_${randomBytes(4).toString("hex")}.1`; // saccver form (versioned)
const REP_ACC = REP.replace(/\.\d+$/, ""); // version-stripped <accession>
const LCA_TAXID = 99_000_001;
const MEMBER_TAXID = 99_000_002;

const hsp =
  `<Hsp><num>1</num><bit-score>50</bit-score><score>120</score><evalue>1e-10</evalue>` +
  `<identity>18</identity><query-from>1</query-from><query-to>20</query-to>` +
  `<hit-from>1</hit-from><hit-to>20</hit-to><align-len>20</align-len>` +
  `<qseq>AAAA</qseq><hseq>AAAA</hseq><midline>AAAA</midline></Hsp>`;

// One Hit whose <id> carries the version (saccver = REP) but <accession> doesn't.
const xml =
  `<?xml version="1.0" encoding="UTF8"?>` +
  `<BlastXML2><BlastOutput2><report><Report>` +
  `<program>blastp</program><version>2.17.0+</version><params>x</params>` +
  `<results><Results><search><Search>` +
  `<query-id>Query_1</query-id><query-len>40</query-len><query-title>q</query-title>` +
  `<hits><Hit><num>1</num><description><HitDescr>` +
  `<id>ref|${REP}|</id><accession>${REP_ACC}</accession><title>rep protein</title><taxid>${MEMBER_TAXID}</taxid>` +
  `</HitDescr></description><len>200</len><hsps>${hsp}</hsps></Hit></hits>` +
  `<stat>ok</stat>` +
  `</Search></search></Results></results>` +
  `<search-target><Target><db>clustered_nr</db></Target></search-target>` +
  `</Report></report></BlastOutput2></BlastXML2>`;

beforeAll(async () => {
  await prisma.cluster_lca.create({
    data: { representative: REP, lcaTaxid: LCA_TAXID },
  });
  await prisma.cluster_member.createMany({
    data: [
      { representative: REP, accession: REP_ACC, taxid: MEMBER_TAXID, title: "rep" },
      { representative: REP, accession: "ITEST_MEMBER_2", taxid: MEMBER_TAXID, title: "m2" },
    ],
  });
  await prisma.taxonomy.createMany({
    data: [
      { id: LCA_TAXID, name: "ItestLcaTaxon", ancestors: [1, LCA_TAXID] },
      { id: MEMBER_TAXID, name: "ItestMemberTaxon", ancestors: [1, MEMBER_TAXID] },
    ],
    skipDuplicates: true,
  });
});

afterAll(async () => {
  await prisma.cluster_member.deleteMany({ where: { representative: REP } });
  await prisma.cluster_lca.deleteMany({ where: { representative: REP } });
  await prisma.taxonomy.deleteMany({
    where: { id: { in: [LCA_TAXID, MEMBER_TAXID] } },
  });
  await prisma.$disconnect();
});

describe("formatResults clustered_nr enrichment (integration, real Postgres)", () => {
  it("labels the hit by its LCA and lists cluster members from Postgres", async () => {
    const result = await formatResults(xml, "clustered_nr");
    const hits = result.hits!;
    expect(hits).toHaveLength(1);
    const [hit] = hits;

    // Representative accession stays the BLAST subject; taxid/name become the LCA.
    expect(hit.accession).toBe(REP_ACC);
    expect(hit.taxid).toBe(LCA_TAXID);
    expect(hit.name).toBe("ItestLcaTaxon");

    // Members come from Postgres (rep + one more), with names resolved.
    expect(hit.clusterSize).toBe(2);
    expect(hit.members.map((m) => m.accession).sort()).toEqual(
      ["ITEST_MEMBER_2", REP_ACC].sort()
    );
    expect(
      hit.members.find((m) => m.accession === "ITEST_MEMBER_2")?.name
    ).toBe("ItestMemberTaxon");
  });

  it("does NOT enrich when the database is not clustered", async () => {
    const result = await formatResults(xml, "nr");
    const [hit] = result.hits!;
    // Plain path: single member, taxid is the representative's own species.
    expect(hit.clusterSize).toBe(1);
    expect(hit.taxid).toBe(MEMBER_TAXID);
  });
});
