//@ts-ignore
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { xml2js, ElementCompact } from 'xml-js';
import { camelCase, mapKeys, partition } from 'lodash';

import prisma from '../database';

export const dynamic = 'force-dynamic';

function replaceJsonTextAttribute(value: string, parentElement: ElementCompact) {
  const keyNo = Object.keys(parentElement._parent).length;
  const keyName = Object.keys(parentElement._parent)[keyNo-1];
  parentElement._parent[keyName] = value;
}

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
  title: string
}

type BlastHitNoTaxInfo = Omit<RawBlastHit, 'description' | 'hsps'> & {
  hsps: Hsp[],
  taxid: string,
  queryCover: number,
  percentIdentity: number,
}

export type BlastHit = BlastHitNoTaxInfo & {
  ancestors: string,
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
                  stat: string
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

function add(total: number, element: number): number {
  /**
   * Helper function that solely exists because JS doesn't have a normal sum function
   * To be used with Array.reduce: total is the accumulator, element is the current number
   * https://stackoverflow.com/questions/1230233/how-to-find-the-sum-of-an-array-of-numbers
   */
  return total + element
}

function mergeIntervals(intervals: [number, number][]) {
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

async function buildTaxTrees(hits: {
  len: string;
  num: string;
  accession: string;
  title: string;
  hsps: Hsp[];
  queryCover: number;
  percentIdentity: number;
  taxid: string;
  name: string;
  ancestors: string[];
}[]){
  // find taxonomy info for ancestors of all hits
  const ancestorIds: Set<string> = new Set(hits
    .map(({ ancestors }) => ancestors)
    .flat())
  
  const allTaxIds = [...ancestorIds, ...hits.map(({ taxid }: { taxid: string }) => taxid)]
  
  let taxonomy: TaxonomyNode[];
  try {
    taxonomy = await prisma.taxonomy.findMany({ where: { id: { in: allTaxIds }}});
  } catch (err) {
    console.error(`prisma.taxonomy.findMany: ${err}`);
    taxonomy = [];
  }
  const taxidMap = Object.fromEntries(taxonomy.map(({id, name, ancestors}) => [id, {id, name, ancestors}]))

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
    .filter(([_,value]) => value !== hits.length)
    .reduce((obj, [key,value]) => {
      return {
        ...obj,
        [key]: value
      }
    }, {});
  // console.log({ filteredancestorIdCounts, ancestorIdCounts })
  const filteredAncestors: TaxonomyNode[] = Object.entries(filteredancestorIdCounts)
    .map(([ancestorId, count]) => ({...taxidMap[ancestorId], count}))
    .sort((a,b) => a.ancestors.length - b.ancestors.length)
  
  // console.log({ filteredAncestors })

  const baseLen = filteredAncestors[0].ancestors.length;
  const [taxonomyTrees, childElements] = partition(filteredAncestors, el => el.ancestors.length === baseLen);
  
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

  taxonomyTrees.forEach(taxonomyTree => addChildren(taxonomyTree, childElements))
  return taxonomyTrees
}

async function formatResults(blastResults: any) {
  const results = xml2js(blastResults, { compact: true, trim: true, textFn: replaceJsonTextAttribute })
  // console.log({ results });
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
                    Hit: _hits
                   },
                   stat
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

  async function processHit({ description, hsps, len, num }: RawBlastHit): Promise<BlastHitNoTaxInfo>{
    // extract descriptions
    const hitDescription = Array.isArray(description.HitDescr)
      ? description.HitDescr 
      : [description.HitDescr]
    const { accession, title, taxid } = hitDescription[0];
    
    // extract HSPs
    const _hsps = Array.isArray(hsps.Hsp) ? hsps.Hsp : [hsps.Hsp]
    const formattedHsps: Hsp[] = _hsps.map(hsp => mapKeys(hsp, (_, key) => camelCase(key))) as any[];
    
    // calculate query coverage
    const coverIntervals: [number, number][] = formattedHsps
      .map(({ queryFrom, queryTo }) => ([Number(queryFrom), Number(queryTo)]));
    const mergedIntervals = mergeIntervals(coverIntervals);
    const queryCoverTotal = mergedIntervals
      .map(([ queryFrom, queryTo ]) => (queryTo - queryFrom))
      .reduce(add, 0); 
    const queryCover = Math.ceil((queryCoverTotal / Number(queryLen)) * 100);

    // calculate percent identity
    const alignLen = formattedHsps.map(({alignLen}) => Number(alignLen)).reduce(add, 0);
    const identity = formattedHsps.map(({ identity }) => Number(identity)).reduce(add, 0);
    const percentIdentity = (identity / alignLen) * 100;
    

    return { accession, title, taxid, percentIdentity, queryCover, num, len, hsps: formattedHsps }
  }

  const intermediateHits: BlastHitNoTaxInfo[] = await Promise.all(_hits.map(processHit))
  
  // add taxonomy info for all hits
  const hitTaxids = Array.from(new Set(intermediateHits.map(({ taxid }) => taxid)))
  const hitTaxInfo = await prisma.taxonomy.findMany({ where: { id: {in: hitTaxids }}})
  const hitTaxidMap = Object.fromEntries(hitTaxInfo.map(
    ({id, name, ancestors}: {id: string, name: string, ancestors: string[]}) => {
      return [id, {id, name, ancestors}]
    }
  ))
  const hits = intermediateHits.map(({ taxid, ...rest}) => {
    const taxonomyInfo = hitTaxidMap[taxid];
    const { name, ancestors } = taxonomyInfo ? taxonomyInfo : { name: 'NotFound', ancestors: ['NotFound'] };
    return { taxid, name, ancestors, ...rest}
  })

  const taxonomyTrees = hitTaxInfo.length === 1
    ? [hitTaxidMap[hitTaxInfo[0].id]]
    : await buildTaxTrees(hits)
  
  // console.log({ taxonomyTrees, hitTaxInfo, hitTaxidMap })

  return { params, program, queryId, queryLen, queryTitle, hits, stat, version, db, taxonomyTrees }
}

export async function GET(_: NextRequest, context: { params: { jobId: string[]}}) {
  const { params: { jobId }} = context;
  console.log(`Requested job ${jobId}`);

  let job;
  try {
    job = await prisma.blastjob.findFirst({ where: { id: jobId[0] }});
  } catch (err) {
    console.error(err);
  }
  const formattedResults = job?.results ? await formatResults(job.results) : null;

  return NextResponse.json({...job, results: formattedResults }) // res
}