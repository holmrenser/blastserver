//@ts-ignore
import { NextResponse, NextRequest } from 'next/server';
import { xml2js, ElementCompact } from 'xml-js';
import { camelCase, mapKeys, partition } from 'lodash';

import prisma from '../database';


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
  // ancestors: string,
  // name: string
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
  ancestors: string,
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
    const hitDescription = Array.isArray(description.HitDescr)
      ? description.HitDescr 
      : [description.HitDescr]
    const { accession, title, taxid } = hitDescription[0];
    const _hsps = Array.isArray(hsps.Hsp) ? hsps.Hsp : [hsps.Hsp]
    const formattedHsps: Hsp[] = _hsps.map(hsp => mapKeys(hsp, (_, key) => camelCase(key))) as any[];
    const queryCoverTotal = formattedHsps
      .map(({ queryFrom, queryTo }) => (Number(queryTo) - Number(queryFrom)))
      .reduce(add, 0); 
    const alignLen = formattedHsps.map(({alignLen}) => Number(alignLen)).reduce(add, 0);
    const identity = formattedHsps.map(({ identity }) => Number(identity)).reduce(add, 0);
    const percentIdentity = (identity / alignLen) * 100;
    const queryCover = Math.floor((queryCoverTotal / Number(len)) * 100);

    return { accession, title, taxid, percentIdentity, queryCover, num, len, hsps: formattedHsps }
  }

  const intermediateHits: BlastHitNoTaxInfo[] = await Promise.all(_hits.map(processHit))
  const hitTaxids = Array.from(new Set(intermediateHits.map(({ taxid }) => taxid)))
  const hitTaxInfo = await prisma.taxonomy.findMany({ where: { id: {in: hitTaxids }}})
  const hitTaxidMap = Object.fromEntries(hitTaxInfo.map(
    ({id, name, ancestors}: {id: string, name: string, ancestors: string}) => {
      return [id, {id, name, ancestors}]
    }
  ))
  const hits = intermediateHits.map(({ taxid, ...rest}) => {
    const taxonomyInfo = hitTaxidMap[taxid];
    const { name, ancestors } = taxonomyInfo ? taxonomyInfo : { name: 'NotFound', ancestors: 'NotFound' };
    return { taxid, name, ancestors, ...rest}
  })
  
  const ancestorIds: Set<string> = new Set(hits
    .map(({ ancestors } : { ancestors: string }) => ancestors.split('.'))
    .flat())
  
  const allTaxIds = [...ancestorIds, ...hits.map(({ taxid }: { taxid: string }) => taxid)]
  
  // console.log('trying prisma.taxonomy.findMany')
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
    .map(({ ancestors } : { ancestors: string }) => ancestors.split('.'))
    .reduce((allTaxidCounts: Record<string, number>, taxids: Array<string>) => {
      return taxids.reduce((taxidCounts: Record<string, number>, taxid: string) => {
        const currCount = taxidCounts[taxid] ?? 0;
        return {
          ...taxidCounts,
          [taxid]: currCount + 1
        }
      }, allTaxidCounts)
    }, {});

  const mrcaTaxid: string = Object.entries(ancestorIdCounts)
    .filter(([_, counts]) => counts === hits.length)
    .map(([taxid,_]) => ({taxid, depth: taxidMap[taxid]?.ancestors.length }))
    .sort((a,b) => a.depth - b.depth || -1)
    .pop()?.taxid || '1'; // taxid can theoretically be undefined 

  const mrca = taxidMap[mrcaTaxid]; 
  
  const filteredancestorIdCounts: Record<string, number> = Object.entries(ancestorIdCounts)
    .filter(([_,value]) => value !== hits.length)
    .reduce((obj, [key,value]) => {
      return {
        ...obj,
        [key]: value
      }
    }, {});
  
  const filteredAncestors: TaxonomyNode[] = Object.entries(filteredancestorIdCounts)
    .map(([ancestorId, count]) => ({...taxidMap[ancestorId], count}))
    .sort((a,b) => a.ancestors.length - b.ancestors.length)

  const baseLen = filteredAncestors[0].ancestors.length;
  const [taxonomyTrees, childElements] = partition(filteredAncestors, el => el.ancestors.length === baseLen);
  
  function addChildren(root: TaxonomyNode, childOptions: TaxonomyNode[]) {
    // recursively add children
    if (typeof root.children === 'undefined') {
      root.children = [];
    }
    childOptions.forEach(childOption => {
      const childParentId = childOption.ancestors.split('.').slice(-2, -1)[0];
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

  return { params, program, queryId, queryLen, queryTitle, hits, stat, version, db, taxonomyTrees }
}

export async function GET(request: NextRequest, context: {params: { jobId: string[]}}) {
  // console.log({ request })
  const { params: { jobId }} = context;
  console.log(`Requested job ${jobId}`);

  let job;
  try {
    job = await prisma.blastjob.findFirst({ where: { id: jobId[0] }});
  } catch (err) {
    console.error(err);
  }
  // console.log(`Job finished: ${job?.finished}`);
  const formattedResults = job?.results ? await formatResults(job.results) : null;
  // console.log({ formattedResults });
  // const res = NextResponse.json({...job, results: formattedResults }, { status: 200 });
  const res = new Response(JSON.stringify({...job, results: formattedResults }));
  // console.log({ res });
  return res
}