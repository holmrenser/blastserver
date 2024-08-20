import { xml2js, ElementCompact } from 'xml-js';
import { camelCase, mapKeys, partition } from 'lodash';

import prisma from '../database';

type HitDescription = {
  accession: string,
  title: string,
  taxid: string
}

type Hsp = {
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

type RawBlastHit = {
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
  taxid: string,
  queryCover: number,
  percentIdentity: number,
}

export type BlastHit = BlastHitNoTaxInfo & {
  ancestors: string[],
  name: string
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
  id: string,
  name: string,
  ancestors: string[],
  children?: TaxonomyNode[],
  depth?: number,
  count?: number
}

type TaxidMap = {
  [k: string] : {
    id: string,
    name: string,
    ancestors: string[]
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

function mergeIntervals(intervals: Interval[]): Interval[] {
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

function processRawHit({ description, hsps, len, num, queryLen }: RawBlastHit): BlastHitNoTaxInfo {
  // extract descriptions
  const hitDescription = Array.isArray(description.HitDescr)
    ? description.HitDescr 
    : [description.HitDescr]
  const { accession, title, taxid } = hitDescription[0];
  
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

  return { accession, title, taxid, percentIdentity, queryCover, num, len, hsps: formattedHsps }
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

async function getTaxIdMap(taxids: string[]): Promise<TaxidMap> {
  const taxInfo = await prisma.taxonomy.findMany({ where: { id: { in: taxids }}})
  const taxidMap = Object.fromEntries(taxInfo.map(
    ({id, name, ancestors}: {id: string, name: string, ancestors: string[]}) => {
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
  const { taxid } = hit;
  const taxonomyInfo = hitTaxidMap[taxid];
  const { name, ancestors } = taxonomyInfo ? taxonomyInfo : { name: 'NotFound', ancestors: ['NotFound'] };
  return { name, ancestors, ...hit }
}

async function buildTaxTrees(hits: BlastHit[]) {
  // find taxonomy info for ancestors of all hits
  const ancestorIds: Set<string> = new Set(hits
    .map(({ ancestors }) => ancestors)
    .flat());
  
  const hitTaxids = hits.map(({ taxid }: { taxid: string }) => taxid);
  
  const allTaxIds = [...ancestorIds, ...hitTaxids]
  
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
    .reduce((allTaxidCounts: Record<string, number>, taxids: Array<string>) => {
      return taxids.reduce((taxidCounts: Record<string, number>, taxid: string) => {
        const currCount = taxidCounts[taxid] ?? 0;
        return {
          ...taxidCounts,
          [taxid]: currCount + 1
        }
      }, allTaxidCounts)
    }, {});

  const filteredancestorIdCounts: Record<string, number> = Object.entries(ancestorIdCounts)
    // eslint-disable-next-line no-unused-vars
    .filter(([_,value]) => value !== hits.length)
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

export default async function formatResults(blastResults: string): Promise<FormattedBlastResults> {
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

  let hits: BlastHit[] | undefined;
  let taxonomyTrees: TaxonomyNode[] | undefined;
  const rawHits = Array.isArray(_rawHits) ? _rawHits : [_rawHits];
  if (!message) {
    // initial result parsing to summarize useful information per hit
    const intermediateHits: BlastHitNoTaxInfo[] = rawHits.map(rawHit => (
      processRawHit({ ...rawHit, queryLen: Number(queryLen) })
    ))
  
    // add taxonomy info for all hits
    const hitTaxids = Array.from(new Set(intermediateHits.map(({ taxid }) => taxid)))
    const hitTaxidMap = await getTaxIdMap(hitTaxids);
    hits = intermediateHits.map(hit => addTaxInfo({ hit, hitTaxidMap }))
    
    // get taxonomy trees for all hit taxids
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
