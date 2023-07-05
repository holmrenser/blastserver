import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

import Descriptions from './descriptions';
import GraphicSummary from './graphicSummary';
import Alignments from './alignments';
import Taxonomy from './taxonomy';

import styles from './resultspage.module.scss';
import { mutate } from 'swr';

type PANEL_COMPONENT = (arg0: {
  hits: any[],
  queryLength: number,
  taxonomyTrees: any
}) => JSX.Element;

const PANEL_COMPONENTS: Record<string, PANEL_COMPONENT> = {
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

function AutoReload({ mutate, blastResults }: {mutate: Function, blastResults: any}) {
  /*console.log({ blastResults})
  const interval = setInterval(() => {
    if (!blastResults) {
      console.log('called mutate callback from results')
      mutate(undefined, false)
    } else {
      console.log('cleared interval')
      clearInterval(interval)
    }
  }, 5_000);*/
  return <p>This page will automatically update once your job is ready</p>
}

export default function ResultsPage({ blastResults, err }: { blastResults: any, mutate: Function, err: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (err) return <p>{err}</p>
  if (!blastResults) return <AutoReload mutate={mutate} blastResults={blastResults} />

  const activePanel = searchParams.get('panel') || 'descriptions';
  const PanelComponent = PANEL_COMPONENTS[activePanel];
  const { queryLen, hits, taxonomyTrees } = blastResults;
  
  return (
    <div className='container'>
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
