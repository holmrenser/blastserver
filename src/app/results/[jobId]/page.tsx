'use server';

import { xml2js, ElementCompact } from 'xml-js';
import { camelCase, mapKeys, partition } from 'lodash';

import Error from '../error';
import ResultsPage from './resultspage';
import prisma from '../../api/database';


function replaceJsonTextAttribute(value: string, parentElement: ElementCompact) {
  const keyNo = Object.keys(parentElement._parent).length;
  const keyName = Object.keys(parentElement._parent)[keyNo-1];
  parentElement._parent[keyName] = value;
}

async function formatResults(blastResults) {
  const results = xml2js(blastResults, { compact: true, trim: true, textFn: replaceJsonTextAttribute })
  const { 
    BlastXML2: { 
      BlastOutput2: {
        report: { Report: {
          params,
          program,
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
          version,
          'search-target': {
            Target: {
              db
            }
          }
        } }
      }
    } 
  } = results;

  const hits = await Promise.all(_hits.map(async ({ description, hsps, len, num }) => {
    const hitDescription = Array.isArray(description.HitDescr)
      ? description.HitDescr 
      : [description.HitDescr]
    const { accession, title, taxid } = hitDescription[0];
    const _hsps = Array.isArray(hsps.Hsp) ? hsps.Hsp : [hsps.Hsp]
    const formattedHsps = _hsps.map(hsp => mapKeys(hsp, (_, key) => camelCase(key)));
    const queryCoverTotal = formattedHsps
      .map(({ queryFrom, queryTo }) => (queryTo - queryFrom))
      .reduce((a: number, b: number) =>  a + b, 0); // https://stackoverflow.com/questions/1230233/how-to-find-the-sum-of-an-array-of-numbers
    const queryCover = Math.floor((queryCoverTotal / len) * 100);
    const { name, ancestors } = await prisma.taxonomy.findFirst({ where: { id: taxid }})
    return { accession, title, taxid, name, queryCover, num, len, hsps: formattedHsps, ancestors }
  }))

  const ancestorIds: Set<string> = new Set(hits
    .map(({ ancestors } : { ancestors: string }) => ancestors.split('.'))
    .flat())
  
  const allTaxIds = [...ancestorIds, ...hits.map(({ taxid }: { taxid: string }) => taxid)]

  const taxonomy = await prisma.taxonomy.findMany({ where: { id: { in: allTaxIds }}})
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
  
  const filteredancestorIdCounts = Object.entries(ancestorIdCounts)
    .filter(([_,value]) => value !== hits.length)
    .reduce((obj, [key,value]) => {
      return {
        ...obj,
        [key]: value
      }
    }, {});
  
  const filteredAncestors = Object.entries(filteredancestorIdCounts)
    .map(([ancestorId, count]) => ({...taxidMap[ancestorId], count}))
    .sort((a,b) => a.ancestors.length - b.ancestors.length)

  const baseLen = filteredAncestors[0].ancestors.length;
  const [taxonomyTrees, childElements] = partition(filteredAncestors, el => el.ancestors.length === baseLen);
  
  function addChildren(root, childOptions) {
    // recursively add children
    if (typeof root.children === 'undefined') {
      root.children = [];
    }
    childOptions.forEach(childOption => {
      const childParentId = childOption.ancestors.split('.').slice(-2, -1)[0];
      if (childParentId === root.id){
        root.children.push(childOption)
        addChildren(childOption, childOptions)
      }
    })
  }

  taxonomyTrees.forEach(taxonomyTree => addChildren(taxonomyTree, childElements))

  return { params, program, queryId, queryLen, queryTitle, hits, stat, version, db, taxonomyTrees }
}

export default async function ResultsWrapper({
  params
}:{
  params:{
    jobId: string
  }
}) {
  const { jobId } = params;
  const job = await prisma.blastjob.findFirst({ where: { id: jobId }})
  if (!job) return <Error statusCode={404} />

  const results = job.results ? await formatResults(job.results) : null;

  // if (!results) setTimeout(router.refresh, 1000);

  return (
    <>
      <h2 className='subtitle'>Results</h2>
      <p>Job ID: {jobId}</p>
      <p>Submitted: {new Date().toDateString()}</p>
      <p>Status: {results ? 'Finished' : 'In progress'}</p>
      <ResultsPage blastResults={results} />
    </>
  )
} 