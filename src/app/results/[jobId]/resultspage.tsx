'use client';

import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

function Descriptions({ hits }) {
  return <ul>
    {hits.map(({Hit_num, Hit_id}) => {
      return <li key={Hit_num}>
        <p>{Hit_id}</p>
      </li>
    })}
  </ul>
}

function GraphicSummary() {
  return <div>
    <h2>Graphic Summary</h2>
  </div>
}

function Alignments() {
  return <div>
    <h2>Alignments</h2>
  </div>
}

function Taxonomy() {
  return <div>
    <h2>Taxonomy</h2>
  </div>
}

const PANEL_COMPONENTS = {
  descriptions: Descriptions,
  graphic_summary: GraphicSummary,
  alignments: Alignments,
  taxonomy: Taxonomy
}

function formatPanelName(panelName: string): string {
  return panelName
    .split('_')
    .map(namePart => namePart[0].toUpperCase() + namePart.substring(1))
    .join(' ')
}

export default function ResultsPage({ results }: { results: any }) {
  // const router = useRouter();
  // console.log({ router });
  console.log({ results });
  const pathname = usePathname();
  const searchParams = useSearchParams();
  if (!results) {
    // router.refresh();
    return <p>This page will refresh in 1second</p>
  }
  const activePanel = searchParams.get('panel') || 'descriptions';
  const PanelComponent = PANEL_COMPONENTS[activePanel];
  const { BlastOutput } = results;
  const { 
    BlastOutput_version, 
    BlastOutput_db, 
    'BlastOutput_query-ID': BlastOutput_query_ID,
    'BlastOutput_query-def': BlastOutput_query_def,
    'BlastOutput_query-len': BlastOutput_query_len,
    BlastOutput_param: { 
      Parameters
    },
    BlastOutput_iterations: {
      Iteration: {
        Iteration_hits: {
          Hit
        }
      }
    }
  } =  BlastOutput;
  console.log({ Parameters, Hit})
  return <div className='container'>
    <p>Program: {BlastOutput_version}</p>
    <p>DB: {BlastOutput_db}</p>
    <p>Query ID: {BlastOutput_query_ID}</p>
    <p>Query def: {BlastOutput_query_def}</p>
    <p>Query length: {BlastOutput_query_len}</p>
    <div className='tabs is-boxed'>
      <ul>
        {
          Object.keys(PANEL_COMPONENTS).map(panel => {
            return <li key={panel} className={panel === activePanel ? 'is-active' : ''}>
              <Link 
                href={{ 
                  pathname, 
                  query: { panel } 
                }}>
                  { formatPanelName(panel) }
              </Link>
            </li>
          })
        }
      </ul>
    </div>
    <PanelComponent hits={Hit}/>

  </div>
}
