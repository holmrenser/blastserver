'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

import Descriptions from './descriptions';
import GraphicSummary from './graphicSummary';
import Alignments from './alignments';
import Taxonomy from './taxonomy';

import styles from './resultspage.module.scss';


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

export default function ResultsPage({ blastResults }: { blastResults: any }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  if (!blastResults) {
    return <p>This page will refresh in 1second</p>
  }
  const activePanel = searchParams.get('panel') || 'descriptions';
  const PanelComponent = PANEL_COMPONENTS[activePanel];
  const { params, program, queryId, queryLen, queryTitle, hits, stat, version, db, taxonomyTrees } = blastResults;
  
  console.log({ params, program })
  return (
    <div className='container'>
      <p>Program: {version}</p>
      <p>DB: {db}</p>
      <p>Query ID: {queryId}</p>
      <p>Query def: {queryTitle}</p>
      <p>Query length: {queryLen}</p>
      <div className={`tabs is-boxed panel-nav has-background-light ${styles.navPanel}`}>
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
      <PanelComponent hits={hits} queryLength={queryLen} taxonomyTrees={taxonomyTrees} />
    </div>
  )
}
