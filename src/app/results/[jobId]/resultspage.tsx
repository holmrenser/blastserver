'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

import Descriptions from './descriptions';
import GraphicSummary from './graphicSummary';
import Alignments from './alignments';
import Taxonomy from './taxonomy';

import styles from './resultspage.module.scss';
import { ThemeContext } from '@/app/themecontext';
import { useContext } from 'react';

type PANEL_COMPONENT = (arg0: {
  hits: any[],
  queryLength: number,
  taxonomyTrees: any,
  database: string
}) => JSX.Element;

const PANEL_COMPONENTS: Record<string, PANEL_COMPONENT> = {
  descriptions: Descriptions,
  graphic_summary: GraphicSummary,
  alignments: Alignments,
  // taxonomy: Taxonomy
}

function formatPanelName(panelName: string): string {
  return panelName
    .split('_')
    .map(namePart => namePart[0].toUpperCase() + namePart.substring(1))
    .join(' ')
}

export default function ResultsPage({ blastResults, database, err }: { blastResults: any, database: string, err: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { theme } = useContext(ThemeContext);
  
  // Next doesn't properly handle basepath in usePathname, so we have to trim manually
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
  const linkPath = pathname.slice(basePath.length)

  if (err) return <p>{err}</p>
  if (!blastResults) return <p>This page will automatically update once your job is ready</p>

  const activePanel = searchParams.get('panel') || 'descriptions';
  const PanelComponent = PANEL_COMPONENTS[activePanel];
  const { queryLen, hits, taxonomyTrees, message } = blastResults;
  
  return (
    <>
      { message }
      { !message && 
      <div
        className={`${theme === 'dark' ? 'has-background-grey' : 'has-background-light'}`}
        style={{ marginLeft: -12, marginRight: -12 }}
      >
        <div className={`tabs is-boxed panel-nav is-small has-background-grey-dark ${styles.navPanel}`}>
          <ul>
            {
              Object.keys(PANEL_COMPONENTS).map(panel => {
                let backgroundColor = '';
                let textColor = ''
                if (panel === activePanel) {
                  if (theme === 'dark') {
                    backgroundColor = 'has-background-grey-light'
                    textColor = 'has-text-info-light'
                  }
                } else {
                  if (theme === 'dark'){
                    backgroundColor = 'has-background-grey-dark'
                    textColor = 'has-text-light'
                  }
                }

                return (
                  <li
                    key={panel}
                    className={`${panel === activePanel ? 'is-active' : ''} ${backgroundColor}`}
                  >
                    <Link
                      className={`${textColor}`}
                      href={{ 
                        pathname: linkPath, 
                        query: { panel } 
                      }}>
                        { formatPanelName(panel) }
                    </Link>
                  </li>
                )
              })
            }
          </ul>
        </div>
        <PanelComponent hits={hits} queryLength={queryLen} taxonomyTrees={taxonomyTrees} database={database} />
      </div>
      }
    </>
  )
}
