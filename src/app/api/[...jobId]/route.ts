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
  hitTo: string
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

export type BlastHit = Omit<RawBlastHit, 'description' | 'hsps'> & {
  hsps: Hsp[],
  taxid: string,
  queryCover: number,
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

async function formatResults(blastResults: any) {
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

  const hits: BlastHit[] = await Promise.all(_hits.map(async ({ description, hsps, len, num }) => {
    const hitDescription = Array.isArray(description.HitDescr)
      ? description.HitDescr 
      : [description.HitDescr]
    const { accession, title, taxid } = hitDescription[0];
    const _hsps = Array.isArray(hsps.Hsp) ? hsps.Hsp : [hsps.Hsp]
    const formattedHsps: Hsp[] = _hsps.map(hsp => mapKeys(hsp, (_, key) => camelCase(key))) as any[];
    console.log({ _hsps, formattedHsps })
    const queryCoverTotal = formattedHsps
      .map(({ queryFrom, queryTo }) => ((queryTo as any) - (queryFrom as any)))
      .reduce((a: number, b: number) =>  a + b, 0); // https://stackoverflow.com/questions/1230233/how-to-find-the-sum-of-an-array-of-numbers
    const queryCover = Math.floor((queryCoverTotal / (len as any)) * 100);
    
    
    const taxonomyInfo = await prisma.taxonomy.findFirst({ where: { id: taxid }});
    const { name, ancestors } = taxonomyInfo ? taxonomyInfo : { name: 'NotFound', ancestors: 'NotFound' };
    
    return { accession, title, taxid, name, queryCover, num, len, hsps: formattedHsps, ancestors }
  }))

  const ancestorIds: Set<string> = new Set(hits
    .map(({ ancestors } : { ancestors: string }) => ancestors.split('.'))
    .flat())
  
  const allTaxIds = [...ancestorIds, ...hits.map(({ taxid }: { taxid: string }) => taxid)]

  const taxonomy: TaxonomyNode[] = await prisma.taxonomy.findMany({ where: { id: { in: allTaxIds }}})
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
  const { params: { jobId }} = context;
  const job = await prisma.blastjob.findFirst({ where: { id: jobId[0] }});
  const formattedResults = job?.results ? await formatResults(job.results) : null;
  return NextResponse.json({...job, results: formattedResults });
}