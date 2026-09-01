import { xml2js, ElementCompact } from 'xml-js';
import { camelCase, mapKeys, partition } from 'lodash';

import prisma from '../database';
import { isClusteredDatabase } from '@/lib/blast/constants';

// Raw <HitDescr> shape straight from the XML (taxid is the numeric string the
// document carries). `id` is the full seqid (e.g. "ref|XP_013375972.1|") and is the
// only field that preserves the accession version; `accession` is version-stripped.
type HitDescription = {
  id: string,
  accession: string,
  title: string,
  taxid: string
}

/** A cluster member after processing: taxid is numeric, name added on enrichment. */
export type HitMember = {
  accession: string,
  title: string,
  taxid: number,
  name: string,
}

type HitMemberNoName = Omit<HitMember, 'name'>;

export type Hsp = {
  queryFrom: string,
  queryTo: string,
  bitScore: string,
  evalue: string,
  score: string,
  hseq: string,
  qseq: string,
  midline: string,
  num: string,
  hitFrom: string,
  hitTo: string,
  identity: string,
  alignLen: string,
}

export type RawBlastHit = {
  description: {
    HitDescr: HitDescription | HitDescription[]
  },
  hsps: {
    Hsp: Hsp | Hsp[]
  },
  len: string,
  num: string,
  accession: string,
  title: string,
  queryLen: number
}

type BlastHitNoTaxInfo = Omit<RawBlastHit, 'description' | 'hsps' | 'queryLen'> & {
  hsps: Hsp[],
  // Representative (members[0]) taxid; drives scoring, alignments and download.
  // For clustered_nr this is overwritten with the cluster LCA during enrichment.
  taxid: number,
  // The representative's saccver (version-preserving) accession — the key used to
  // join cluster_lca / cluster_member. Never version-stripped.
  saccver: string,
  members: HitMemberNoName[],
  clusterSize: number,
  queryCover: number,
  percentIdentity: number,
}

export type BlastHit = Omit<BlastHitNoTaxInfo, 'members'> & {
  ancestors: number[],
  name: string,
  members: HitMember[],
}

type BlastResult = {
  BlastXML2: {
    BlastOutput2: {
      report: {
        Report: {
          params: any,
          program: string,
          version: string,
          results: {
            Results: {
              search: {
                Search: {
                  'query-id': string,
                  'query-len': string,
                  'query-title': string,
                  hits: {
                    Hit: RawBlastHit[]
                  },
                  stat: string,
                  message: string
                }
              }
            }
          },
          'search-target': {
            Target: {
              db: string
            }
          }
        }
      }
    }
  }
}

export type TaxonomyNode = {
  id: number,
  name: string,
  ancestors: number[],
  children?: TaxonomyNode[],
  depth?: number,
  count?: number
}

// Keyed by taxid. JS object keys are always strings, so a string index signature
// is kept even though the taxids themselves are numbers (indexing with a number
// coerces); the stored ids/ancestors are numeric.
type TaxidMap = {
  [k: string] : {
    id: number,
    name: string,
    ancestors: number[]
  }
}

type Interval = [number,number]

function replaceJsonTextAttribute(value: string, parentElement: ElementCompact) {
  const keyNo = Object.keys(parentElement._parent).length;
  const keyName = Object.keys(parentElement._parent)[keyNo-1];
  parentElement._parent[keyName] = value;
}

function add(total: number, element: number): number {
  /**
   * Helper function that solely exists because JS doesn't have a normal sum function
   * To be used with Array.reduce: total is the accumulator, element is the current number
   * https://stackoverflow.com/questions/1230233/how-to-find-the-sum-of-an-array-of-numbers
   */
  return total + element
}

export function mergeIntervals(intervals: Interval[]): Interval[] {
  if (intervals.length <= 1) return intervals;
  const sortedIntervals = [...intervals].sort((a,b) => (a[0] - b[0]))
  const mergedIntervals = [sortedIntervals.shift()!]; // create stack and insert first sorted element
  sortedIntervals.forEach(([currentStart,currentEnd]) => {
    const [previousStart, previousEnd] = mergedIntervals.pop()!;
    if (currentStart < previousEnd) {
      mergedIntervals.push([previousStart, Math.max(currentEnd, previousEnd)])
    } else {
      mergedIntervals.push([previousStart, previousEnd],[currentStart,currentEnd])
    }
  })
  return mergedIntervals
}

/**
 * Recovers the `saccver` (accession.version) form from a hit's `<id>`. The XML's
 * `<accession>` is version-stripped ("XP_013375972"), but cluster metadata is keyed on
 * the full saccver ("XP_013375972.1" for standard accessions, bare "0405229A" for
 * legacy IDs). We locate `accession` inside `id` and append any ".<version>" that
 * follows it — never stripping a version that's present. Falls back to `accession`
 * when `id` is absent or doesn't contain it.
 */
export function toSaccver(id: string | undefined, accession: string): string {
  if (!id) return accession;
  const escaped = accession.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = id.match(new RegExp(`${escaped}(\\.\\d+)?`));
  return match ? accession + (match[1] ?? '') : accession;
}

export function processRawHit({ description, hsps, len, num, queryLen }: RawBlastHit): BlastHitNoTaxInfo {
  // extract descriptions — for clustered databases (clustered_nr) every
  // <HitDescr> is a cluster member; the first is the representative. Plain
  // databases yield a single member. Taxids are parsed to numbers here, the one
  // boundary where the XML hands us numeric strings, so the rest of the pipeline
  // stays uniformly numeric.
  const hitDescriptions = Array.isArray(description.HitDescr)
    ? description.HitDescr
    : [description.HitDescr]
  const members: HitMemberNoName[] = hitDescriptions.map(
    ({ accession, title, taxid }) => ({ accession, title, taxid: Number(taxid) })
  );
  const clusterSize = members.length;
  const { accession, title, taxid } = members[0];
  const saccver = toSaccver(hitDescriptions[0].id, accession);

  // extract HSPs
  const rawHsps: Hsp[] = Array.isArray(hsps.Hsp) ? hsps.Hsp : [hsps.Hsp]
  const formattedHsps: Hsp[] = rawHsps.map(hsp => mapKeys(hsp, (_, key) => camelCase(key))) as any[];
  
  // calculate query coverage
  const coverIntervals: Interval[] = formattedHsps
    .map(({ queryFrom, queryTo }) => ([Number(queryFrom), Number(queryTo)]));
  const mergedIntervals = mergeIntervals(coverIntervals);
  const queryCoverTotal = mergedIntervals
    .map(([ queryFrom, queryTo ]) => (queryTo - queryFrom))
    .reduce(add, 0); 
  const queryCover = Math.ceil((queryCoverTotal / Number(queryLen)) * 100);

  // calculate percent identity
  const [alignLen, identity] = formattedHsps.map(({ alignLen, identity }) => {
    return [Number(alignLen), Number(identity)]
  }).reduce(([a_prev,i_prev],[a_curr,i_curr]) => {
    return [a_prev + a_curr, i_prev + i_curr]
  }, [0,0]);
  const percentIdentity = (identity / alignLen) * 100;

  return { accession, title, taxid, saccver, members, clusterSize, percentIdentity, queryCover, num, len, hsps: formattedHsps }
}

// Cluster metadata keyed by representative saccver. lcaTaxid may be null (no LCA in
// the source); members are the full cluster membership in source (seed) order.
export type ClusterLcaMap = { [representative: string]: number | null };
export type ClusterMemberMap = { [representative: string]: HitMemberNoName[] };

/**
 * Pure clustered_nr enrichment. For each hit whose representative saccver has cluster
 * metadata: overwrite the hit-level taxid with the cluster LCA (so the hit is labelled
 * by the cluster, not the representative's species), and replace `members` with the
 * full cluster membership from Postgres (the BLAST XML carries only the representative).
 * Hits with no metadata are left as single-member clusters. DB-free, so it's unit
 * tested directly against injected maps.
 */
export function enrichClusters(
  hits: BlastHitNoTaxInfo[],
  lcaMap: ClusterLcaMap,
  memberMap: ClusterMemberMap,
): BlastHitNoTaxInfo[] {
  return hits.map((hit) => {
    const lca = lcaMap[hit.saccver];
    const clusterMembers = memberMap[hit.saccver];
    const members = clusterMembers && clusterMembers.length ? clusterMembers : hit.members;
    return {
      ...hit,
      taxid: lca != null ? lca : hit.taxid,
      members,
      clusterSize: members.length,
    };
  });
}

async function getClusterMaps(
  representatives: string[],
): Promise<[ClusterLcaMap, ClusterMemberMap]> {
  let lcaRows: { representative: string; lcaTaxid: number | null }[];
  let memberRows: { representative: string; accession: string; taxid: number | null; title: string }[];
  try {
    [lcaRows, memberRows] = await Promise.all([
      prisma.cluster_lca.findMany({ where: { representative: { in: representatives } } }),
      prisma.cluster_member.findMany({
        where: { representative: { in: representatives } },
        // id is autoincrement seeded in source order, so this keeps the representative
        // first in each cluster's member list.
        orderBy: { id: 'asc' },
      }),
    ]);
  } catch (err) {
    console.error(`cluster metadata lookup failed: ${err}`);
    return [{}, {}];
  }

  const lcaMap: ClusterLcaMap = Object.fromEntries(
    lcaRows.map(({ representative, lcaTaxid }) => [representative, lcaTaxid]),
  );
  const memberMap: ClusterMemberMap = {};
  for (const { representative, accession, taxid, title } of memberRows) {
    (memberMap[representative] ??= []).push({ accession, title, taxid: taxid ?? 0 });
  }
  return [lcaMap, memberMap];
}

function addChildren(root: TaxonomyNode, childOptions: TaxonomyNode[]) {
  // recursively add children
  if (typeof root.children === 'undefined') {
    root.children = [];
  }
  childOptions.forEach(childOption => {
    const childParentId = childOption.ancestors.slice(-2, -1)[0];
    if (childParentId === root.id){
      if (typeof root.children === 'undefined') {
        root.children = [];
      }
      root.children.push(childOption)
      addChildren(childOption, childOptions)
    }
  })
}

async function getTaxIdMap(taxids: number[]): Promise<TaxidMap> {
  let taxInfo: {
    id: number;
    name: string;
    ancestors: number[];
  }[];
  try {
    taxInfo = await prisma.taxonomy.findMany({ where: { id: { in: taxids }}})
  } catch(err) {
    console.error(`prisma.taxonomy.findMany: ${err}`);
    taxInfo = []
  }
    const taxidMap = Object.fromEntries(taxInfo.map(
    ({id, name, ancestors}: {id: number, name: string, ancestors: number[]}) => {
      return [id, {id, name, ancestors}]
    }
  ))
  return taxidMap
}

function addTaxInfo({
  hit,
  hitTaxidMap,
}: {
  hit: BlastHitNoTaxInfo,
  hitTaxidMap: TaxidMap,
}): BlastHit {
  const { taxid, members } = hit;
  const taxonomyInfo = hitTaxidMap[taxid];
  const { name, ancestors } = taxonomyInfo ? taxonomyInfo : { name: 'NotFound', ancestors: [] };
  // Resolve a scientific name for each cluster member too, so clustered_nr hits
  // can show their member taxa.
  const enrichedMembers: HitMember[] = members.map((member) => ({
    ...member,
    name: hitTaxidMap[member.taxid]?.name ?? 'NotFound',
  }));
  return { name, ancestors, ...hit, members: enrichedMembers }
}

async function buildTaxTrees(hits: BlastHit[]) {
  // find taxonomy info for ancestors of all hits
  const ancestorIds: Set<number> = new Set(hits
    .map(({ ancestors }) => ancestors)
    .flat());

  const hitTaxids = hits.map(({ taxid }: { taxid: number }) => taxid);

  const allTaxIds = [...ancestorIds, ...hitTaxids];
  
  let taxonomy: TaxonomyNode[];
  try {
    taxonomy = await prisma.taxonomy.findMany({ where: { id: { in: allTaxIds }}});
  } catch (err) {
    console.error(`prisma.taxonomy.findMany: ${err}`);
    taxonomy = [];
  }
  const taxidMap: TaxidMap = Object.fromEntries(taxonomy.map(({id, name, ancestors}) => [id, {id, name, ancestors}]))

  // count all taxids and their ancestors, we only keep taxids that are not present in all hits
  const ancestorIdCounts: Record<string, number> = hits
    .map(({ ancestors }) => ancestors)
    .reduce((allTaxidCounts: Record<string, number>, taxids: Array<number>) => {
      return taxids.reduce((taxidCounts: Record<string, number>, taxid: number) => {
        const currCount = taxidCounts[taxid] ?? 0;
        return {
          ...taxidCounts,
          [taxid]: currCount + 1
        }
      }, allTaxidCounts)
    }, {});

  const filteredancestorIdCounts: Record<string, number> = Object.entries(ancestorIdCounts)
    .filter(([_key, value]) => value !== hits.length)
    .reduce((obj, [key,value]) => {
      return {
        ...obj,
        [key]: value
      }
    }, {});

    const filteredAncestors: TaxonomyNode[] = Object.entries(filteredancestorIdCounts)
    .map(([ancestorId, count]) => ({...taxidMap[ancestorId], count}))
    .sort((a,b) => (a.ancestors?.length || 0) - (b.ancestors?.length || 0))
  

  const baseLen = filteredAncestors[0].ancestors.length;
  const [taxonomyTrees, childElements] = partition(filteredAncestors, el => el.ancestors.length === baseLen);

  taxonomyTrees.forEach(taxonomyTree => addChildren(taxonomyTree, childElements))
  return taxonomyTrees
}

export type FormattedBlastResults = {
  params: any,
  program: string,
  queryId: string,
  queryLen: string,
  queryTitle: string,
  hits: BlastHit[] | undefined,
  stat: string,
  version: string,
  db: string,
  taxonomyTrees: TaxonomyNode[] | undefined,
  message: string,
}

/** The XML-derived fields of a BLAST report, before any taxonomy enrichment. */
export type ParsedBlastXml = {
  params: any,
  program: string,
  version: string,
  queryId: string,
  queryLen: string,
  queryTitle: string,
  stat: string,
  message: string,
  db: string,
  rawHits: RawBlastHit[],
}

/**
 * Pure XML2 -> struct step: parses the `-outfmt 16` document and normalizes the
 * single-vs-array shapes (xml-js collapses a lone <Hit> to an object). No DB
 * access, so it can be unit-tested directly on fixture XML (see
 * formatResults.test.ts). Taxonomy enrichment stays in `formatResults`.
 */
export function parseBlastXml(blastResults: string): ParsedBlastXml {
  // parse blast XML and use destructuring assignment to extract all useful parts
  const results = xml2js(blastResults, { compact: true, trim: true, textFn: replaceJsonTextAttribute })
  const {
    BlastXML2: {
      BlastOutput2: {
        report: { Report: {
          params,
          program,
          version,
          results: {
            Results: {
              search: {
                Search: {
                  'query-id': queryId,
                  'query-len': queryLen,
                  'query-title': queryTitle,
                   hits: {
                    Hit: _rawHits = []
                   } = { Hit: []},
                   stat,
                   message
                }
              }
            }
          },
          'search-target': {
            Target: {
              db
            }
          }
        } }
      }
    }
  } = results as any as BlastResult;

  const rawHits = Array.isArray(_rawHits) ? _rawHits : [_rawHits];
  return { params, program, version, queryId, queryLen, queryTitle, stat, message, db, rawHits }
}

export default async function formatResults(
  blastResults: string,
  database?: string,
): Promise<FormattedBlastResults> {
  const { params, program, version, queryId, queryLen, queryTitle, stat, message, db, rawHits } =
    parseBlastXml(blastResults);

  let hits: BlastHit[] | undefined;
  let taxonomyTrees: TaxonomyNode[] | undefined;
  if (!message) {
    // initial result parsing to summarize useful information per hit
    let intermediateHits: BlastHitNoTaxInfo[] = rawHits.map(rawHit => (
      processRawHit({ ...rawHit, queryLen: Number(queryLen) })
    ))

    // clustered_nr: the BLAST XML carries only the representative, so pull the cluster
    // LCA + member list from Postgres (keyed by representative saccver) and fold them in.
    if (database && isClusteredDatabase(database)) {
      const representatives = Array.from(new Set(intermediateHits.map(({ saccver }) => saccver)));
      const [lcaMap, memberMap] = await getClusterMaps(representatives);
      intermediateHits = enrichClusters(intermediateHits, lcaMap, memberMap);
    }

    // Resolve names for every cluster member taxid AND every hit-level taxid (the
    // latter is the cluster LCA after enrichment, which need not be a member taxid).
    const namedTaxids = Array.from(
      new Set(intermediateHits.flatMap(({ taxid, members }) => [taxid, ...members.map((m) => m.taxid)]))
    ).filter((taxid) => Number.isFinite(taxid));
    const hitTaxidMap = await getTaxIdMap(namedTaxids);
    hits = intermediateHits.map(hit => addTaxInfo({ hit, hitTaxidMap }))

    // Build the taxonomy tree from representative taxids so "Number of Hits"
    // stays "number of clusters".
    const hitTaxids = Array.from(new Set(intermediateHits.map(({ taxid }) => taxid)))
      .filter((taxid) => Number.isFinite(taxid));
    try {
      taxonomyTrees = hitTaxids.length === 1
        ? [hitTaxidMap[hitTaxids[0]]]
        : await buildTaxTrees(hits)
    } catch {
      console.warn('Building taxTrees failed')
      taxonomyTrees = [];
    }
  }
  
  return { params, program, queryId, queryLen, queryTitle, hits, stat, version, db, taxonomyTrees, message }
}
