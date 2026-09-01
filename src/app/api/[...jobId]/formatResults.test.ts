// Layer 2 (parsing correctness). Exercises the pure XML2 -> struct core of the
// results formatter -- interval merging, per-hit summarization, and the document
// parse/normalization -- on fixture XML, with no Postgres. The taxonomy
// enrichment in `formatResults` (which needs the DB) is out of scope here, so we
// stub the database module that the source imports at module load.

import { vi } from "vitest";

vi.mock("../database", () => ({ default: {} }));

import {
  mergeIntervals,
  processRawHit,
  parseBlastXml,
  toSaccver,
  enrichClusters,
  type Hsp,
  type RawBlastHit,
} from "./formatResults";

/* ------------------------------------------------------------------ *
 * mergeIntervals — the trickiest pure logic (query-coverage merging)
 * ------------------------------------------------------------------ */
describe("mergeIntervals", () => {
  it("returns short inputs unchanged", () => {
    expect(mergeIntervals([])).toEqual([]);
    expect(mergeIntervals([[1, 5]])).toEqual([[1, 5]]);
  });

  it("keeps disjoint intervals separate", () => {
    expect(
      mergeIntervals([
        [1, 5],
        [10, 15],
      ])
    ).toEqual([
      [1, 5],
      [10, 15],
    ]);
  });

  it("merges overlapping intervals", () => {
    expect(
      mergeIntervals([
        [1, 10],
        [5, 15],
      ])
    ).toEqual([[1, 15]]);
  });

  it("sorts before merging (unsorted input)", () => {
    expect(
      mergeIntervals([
        [10, 15],
        [1, 5],
      ])
    ).toEqual([
      [1, 5],
      [10, 15],
    ]);
  });

  it("does NOT merge merely touching intervals (strict overlap)", () => {
    // current behaviour uses `currentStart < previousEnd`, so 5 < 5 is false
    expect(
      mergeIntervals([
        [1, 5],
        [5, 10],
      ])
    ).toEqual([
      [1, 5],
      [5, 10],
    ]);
  });
});

/* ------------------------------------------------------------------ *
 * processRawHit — single/array HSP normalization + cover/identity math
 * ------------------------------------------------------------------ */
const rawHit = (hsps: Partial<Hsp> | Partial<Hsp>[]): RawBlastHit =>
  ({
    description: {
      HitDescr: { accession: "P1", title: "a protein", taxid: "9606" },
    },
    hsps: { Hsp: hsps },
    len: "200",
    num: "1",
    accession: "P1",
    title: "a protein",
    queryLen: 40,
  }) as unknown as RawBlastHit;

describe("processRawHit", () => {
  it("normalizes a single HSP object into an array", () => {
    const hit = processRawHit(
      rawHit({ queryFrom: "1", queryTo: "20", alignLen: "20", identity: "18" })
    );
    expect(Array.isArray(hit.hsps)).toBe(true);
    expect(hit.hsps).toHaveLength(1);
    // taxid is parsed to a number at this boundary
    expect(hit.taxid).toBe(9606);
  });

  it("computes query coverage and percent identity from one HSP", () => {
    const hit = processRawHit(
      rawHit({ queryFrom: "1", queryTo: "20", alignLen: "20", identity: "18" })
    );
    // coverage = ceil((20 - 1) / 40 * 100) = ceil(47.5) = 48
    expect(hit.queryCover).toBe(48);
    // identity = 18 / 20 * 100 = 90
    expect(hit.percentIdentity).toBeCloseTo(90);
  });

  it("merges overlapping HSP intervals for coverage across multiple HSPs", () => {
    const hit = processRawHit(
      rawHit([
        { queryFrom: "1", queryTo: "20", alignLen: "20", identity: "18" },
        { queryFrom: "15", queryTo: "30", alignLen: "16", identity: "14" },
      ])
    );
    expect(hit.hsps).toHaveLength(2);
    // merged interval [1,30] -> ceil(29/40*100) = ceil(72.5) = 73
    expect(hit.queryCover).toBe(73);
    // identity = (18 + 14) / (20 + 16) * 100
    expect(hit.percentIdentity).toBeCloseTo((32 / 36) * 100);
  });
});

/* ------------------------------------------------------------------ *
 * processRawHit — cluster members (clustered_nr) vs plain databases
 * ------------------------------------------------------------------ */
// A clustered hit carries one <HitDescr> per cluster member (first = representative).
const clusteredRawHit = (
  members: { accession: string; title: string; taxid: string }[]
): RawBlastHit =>
  ({
    description: { HitDescr: members },
    hsps: {
      Hsp: { queryFrom: "1", queryTo: "20", alignLen: "20", identity: "18" },
    },
    len: "200",
    num: "1",
    accession: members[0].accession,
    title: members[0].title,
    queryLen: 40,
  }) as unknown as RawBlastHit;

describe("processRawHit cluster members", () => {
  it("treats a plain hit as a single-member cluster", () => {
    const hit = processRawHit(
      rawHit({ queryFrom: "1", queryTo: "20", alignLen: "20", identity: "18" })
    );
    expect(hit.clusterSize).toBe(1);
    expect(hit.members).toHaveLength(1);
    expect(hit.members[0]).toMatchObject({ accession: "P1", taxid: 9606 });
  });

  it("keeps every <HitDescr> as a member with numeric taxids", () => {
    const hit = processRawHit(
      clusteredRawHit([
        { accession: "P1", title: "representative", taxid: "9606" },
        { accession: "P2", title: "member two", taxid: "10090" },
        { accession: "P3", title: "member three", taxid: "9598" },
      ])
    );
    expect(hit.clusterSize).toBe(3);
    expect(hit.members.map((member) => member.taxid)).toEqual([
      9606, 10090, 9598,
    ]);
    // representative top-level fields mirror members[0]
    expect(hit.accession).toBe("P1");
    expect(hit.taxid).toBe(9606);
  });

  it("derives the saccver join key from <id>, preserving the version", () => {
    const raw = {
      description: {
        HitDescr: {
          id: "ref|XP_013375972.1|",
          accession: "XP_013375972",
          title: "t",
          taxid: "9606",
        },
      },
      hsps: {
        Hsp: { queryFrom: "1", queryTo: "20", alignLen: "20", identity: "18" },
      },
      len: "200",
      num: "1",
      accession: "XP_013375972",
      title: "t",
      queryLen: 40,
    } as unknown as RawBlastHit;
    // <accession> is version-stripped; saccver recovers the version from <id>.
    expect(processRawHit(raw).accession).toBe("XP_013375972");
    expect(processRawHit(raw).saccver).toBe("XP_013375972.1");
  });
});

/* ------------------------------------------------------------------ *
 * toSaccver — version-preserving join key derivation
 * ------------------------------------------------------------------ */
describe("toSaccver", () => {
  it("recovers the version for standard accessions from <id>", () => {
    expect(toSaccver("ref|XP_013375972.1|", "XP_013375972")).toBe(
      "XP_013375972.1"
    );
    expect(toSaccver("gb|MEF2594332.1|", "MEF2594332")).toBe("MEF2594332.1");
  });

  it("leaves version-less legacy / PRF IDs bare", () => {
    expect(toSaccver("0405229A", "0405229A")).toBe("0405229A");
    expect(toSaccver("prf||0804800D", "0804800D")).toBe("0804800D");
  });

  it("falls back to the accession when <id> is missing or unrelated", () => {
    expect(toSaccver(undefined, "P1")).toBe("P1");
    expect(toSaccver("", "P1")).toBe("P1");
    expect(toSaccver("gb|OTHER.2|", "P1")).toBe("P1");
  });
});

/* ------------------------------------------------------------------ *
 * enrichClusters — clustered_nr LCA override + member replacement
 * ------------------------------------------------------------------ */
describe("enrichClusters", () => {
  // saccver === "P1" (accession, since rawHit carries no <id>); taxid === 9606.
  const baseHit = () =>
    processRawHit(
      rawHit({ queryFrom: "1", queryTo: "20", alignLen: "20", identity: "18" })
    );

  it("overrides the hit taxid with the LCA and replaces members", () => {
    const [hit] = enrichClusters(
      [baseHit()],
      { P1: 7150 },
      {
        P1: [
          { accession: "P1", title: "rep", taxid: 9606 },
          { accession: "M2", title: "m2", taxid: 10090 },
        ],
      }
    );
    expect(hit.taxid).toBe(7150);
    expect(hit.clusterSize).toBe(2);
    expect(hit.members.map((m) => m.accession)).toEqual(["P1", "M2"]);
    // representative accession is untouched (still the BLAST-aligned subject)
    expect(hit.accession).toBe("P1");
  });

  it("keeps the representative taxid when the cluster LCA is null", () => {
    const [hit] = enrichClusters(
      [baseHit()],
      { P1: null },
      { P1: [{ accession: "P1", title: "rep", taxid: 9606 }] }
    );
    expect(hit.taxid).toBe(9606);
    expect(hit.clusterSize).toBe(1);
  });

  it("leaves a hit with no cluster metadata as a single-member cluster", () => {
    const [hit] = enrichClusters([baseHit()], {}, {});
    expect(hit.taxid).toBe(9606);
    expect(hit.members).toHaveLength(1);
    expect(hit.clusterSize).toBe(1);
  });
});

/* ------------------------------------------------------------------ *
 * parseBlastXml — document parse + single/array Hit normalization
 * ------------------------------------------------------------------ */
const hspXml = (h: {
  queryFrom: number;
  queryTo: number;
  alignLen: number;
  identity: number;
}): string =>
  `<Hsp><num>1</num><bit-score>50</bit-score><score>120</score><evalue>1e-10</evalue>` +
  `<identity>${h.identity}</identity><query-from>${h.queryFrom}</query-from><query-to>${h.queryTo}</query-to>` +
  `<hit-from>1</hit-from><hit-to>${h.alignLen}</hit-to><align-len>${h.alignLen}</align-len>` +
  `<qseq>AAAA</qseq><hseq>AAAA</hseq><midline>AAAA</midline></Hsp>`;

const hitXml = (taxid: string): string =>
  `<Hit><num>1</num><description><HitDescr><id>x</id>` +
  `<accession>P12345</accession><title>Some protein</title><taxid>${taxid}</taxid>` +
  `</HitDescr></description><len>200</len><hsps>` +
  hspXml({ queryFrom: 1, queryTo: 20, alignLen: 20, identity: 18 }) +
  `</hsps></Hit>`;

const doc = (searchBody: string): string =>
  `<?xml version="1.0" encoding="UTF8"?>` +
  `<BlastXML2><BlastOutput2><report><Report>` +
  `<program>blastp</program><version>2.17.0+</version><params>x</params>` +
  `<results><Results><search><Search>` +
  `<query-id>Query_1</query-id><query-len>40</query-len><query-title>test query</query-title>` +
  searchBody +
  `<stat>ok</stat>` +
  `</Search></search></Results></results>` +
  `<search-target><Target><db>landmark</db></Target></search-target>` +
  `</Report></report></BlastOutput2></BlastXML2>`;

describe("parseBlastXml", () => {
  it("extracts the report-level fields", () => {
    const parsed = parseBlastXml(doc(`<hits>${hitXml("9606")}</hits>`));
    expect(parsed.program).toBe("blastp");
    expect(parsed.version).toBe("2.17.0+");
    expect(parsed.db).toBe("landmark");
    expect(parsed.queryId).toBe("Query_1");
    expect(parsed.queryLen).toBe("40");
    expect(parsed.queryTitle).toBe("test query");
  });

  it("normalizes a single <Hit> into a one-element array", () => {
    const parsed = parseBlastXml(doc(`<hits>${hitXml("9606")}</hits>`));
    expect(parsed.rawHits).toHaveLength(1);
    expect(parsed.rawHits[0].description.HitDescr).toMatchObject({
      taxid: "9606",
    });
  });

  it("keeps multiple <Hit> elements as an array", () => {
    const parsed = parseBlastXml(
      doc(`<hits>${hitXml("9606")}${hitXml("10090")}</hits>`)
    );
    expect(parsed.rawHits).toHaveLength(2);
  });

  it("yields no hits and surfaces the message on an empty result", () => {
    const parsed = parseBlastXml(doc(`<message>No hits found</message>`));
    expect(parsed.message).toBe("No hits found");
    expect(parsed.rawHits).toHaveLength(0);
  });
});
