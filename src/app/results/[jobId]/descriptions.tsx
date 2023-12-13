import { useState, useEffect, useCallback, useContext } from 'react';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { BlastHit } from "../../api/[...jobId]/formatResults";
import styles from './descriptions.module.scss';
import { ThemeContext } from '@/app/themecontext';

function truncate(string: string, limit=20){
  if (string.length <= limit) return string;
  return string.slice(0, limit) + '...'
}

function useSelectionSet<T>(): [Set<T>, Function, Function, Function]{
  const [selectionSet, setSelectionSet] = useState((): Set<T> => new Set());
  function addItem(item: T): void {
    setSelectionSet(prev => new Set(prev).add(item))
  }

  function clearSelection(): void {
    setSelectionSet(() => new Set())
  }

  function removeItem(item: T): void {
    setSelectionSet(prev => {
      const next = new Set(prev);
      next.delete(item);
      return next
    })
  }

  function toggleItemSelection(item: T): void {
    if (selectionSet.has(item)) {
      removeItem(item)
    } else {
      addItem(item)
    }
  }
  return [selectionSet, toggleItemSelection, clearSelection, addItem]
}

export default function Descriptions({ hits, database }: {hits: BlastHit[], database: string}): JSX.Element {
  const pathname = usePathname();
  const { theme } = useContext(ThemeContext);

  // Next doesn't properly handle basepath in usePathname, so we have to trim manually
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
  const linkPath = pathname.slice(basePath.length)

  const [selectionSet, toggleSelection, clearSelection, addItem] = useSelectionSet<string>();
  const [selectAll, setSelectAll] = useState(false);

  function toggleSelectAll(): void {
    setSelectAll(!selectAll);
    if (!selectAll) {
      hits.forEach(({ accession }) => addItem(accession))
    } else {
      clearSelection()
    }
  }

  function checkSelectAll(): void {
    const allSelected = hits.filter(({ accession}) => selectionSet.has(accession)).length === hits.length;
    setSelectAll(allSelected)
  }

  const cachedCheckSelectAll = useCallback(checkSelectAll, [selectionSet, hits]);

  useEffect(()=>{
    cachedCheckSelectAll()
  }, [cachedCheckSelectAll])

  function submitSelection() {
    console.log({ selectionSet })
    fetch(`${basePath}/api/download`, {
      body: JSON.stringify({
        sequenceIds: Array.from(selectionSet),
        database
      }),
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      method: 'POST'
    })
    .then(res => res.json())
    .then(data => {
      const { jobId } = data;
      console.log({ jobId })
      // window.location.replace(`${basePath}/results/${jobId}`) // HACK
    })
  }

  return (
    <div className={styles.descriptionContainer}>
      <nav className={`navbar ${theme === 'dark' ? 'has-background-info' : 'has-background-info-light'}`} role='navigation'>
        <div className='navbar-brand'>
          <b className={`navbar-item ${theme === 'dark' ? 'has-text-light' : ''}`}>
            <span className='tag is-small is-success'>{hits.length}</span>
            &nbsp;Significant alignments
          </b>
        </div>

        <div className='navbar-menu'>
          <div className='navbar-end'>
            <p className='navbar-item'>
              <button
                className='button navbar-item is-small is-info is-light is-outlined'
                onClick={submitSelection}
                disabled={true /*selectionSet.size === 0*/}
              >
                Download
              </button>
            </p>
          </div>
        </div>
      </nav>
      <label className={`checkbox select-all ${styles.selectAll}`}>
        <input
          type='checkbox'
          checked={selectAll}
          onChange={() => toggleSelectAll()}
        />
        Select all
      </label>
      <table className={`table is-size-7 is-narrow is-hoverable is-fullwidth ${theme === 'dark' ? 'is-dark has-background-grey-dark has-text-light' : ''}`}>
        <thead>
          <tr>
            <th></th>
            {
            ['Description', 'Scientific Name', 'Max Score', 'Total Score',
            'Query Cover', 'E value','Per. Ident.', 'Acc. Len.', 'Accession'].map(header => (
              <th key={header} className={`${theme === 'dark' ? 'has-text-light' : ''}`}>{header}</th>
            ))
            }
          </tr>
        </thead>
        <tbody>
          {hits.map(( { accession, title, taxid, name, queryCover, num, len, hsps, percentIdentity }) => {
            const scores = hsps.map(({ bitScore }) => Number(bitScore));
            const maxScore = Math.round(Math.max(...scores));
            const totalScore = Math.round(scores.reduce((total, score) => (total + score), 0));
            const evalues = hsps.map(({ evalue }) => Number(evalue));
            const evalue = Math.min(...evalues)
            const formattedEvalue = evalue === 0 ? evalue : evalue.toExponential(2)
            return <tr key={num}>
              <td data-label='Select'>
                <input
                  type='checkbox'
                  checked={selectionSet.has(accession)}
                  onChange={() => {
                    toggleSelection(accession);
                    checkSelectAll();
                  }}
                />
              </td>
              <td data-label='Description'>
                <Link
                  href={{
                    pathname: linkPath,
                    query: {
                      panel: 'alignments'
                    },
                    hash: accession
                  }}
                >
                  {title.slice(0,100)}
                </Link>
              </td>
              <td data-label='Scientific Name'>
                <a 
                  href={`https://www.ncbi.nlm.nih.gov/Taxonomy/Browser/wwwtax.cgi?id=${taxid}`}
                  target='_blank'
                  title={name}
                >
                  {truncate(name)}
                </a>
              </td>
              <td data-label='Max Score'>{maxScore}</td>
              <td data-label='Total Score'>{totalScore}</td>
              <td data-label='Query Cover'>{queryCover}%</td>
              <td data-label='E value'>{formattedEvalue}</td>
              <td data-label='Perc. Ident.'>{percentIdentity.toFixed(2)}%</td>
              <td data-label='Acc. Len.'>{len}</td>
              <td data-label='Accession'>
                <a href={`https://www.ncbi.nlm.nih.gov/protein/${accession}`} target='_blank'>
                  {accession}
                </a>
              </td>
            </tr>
          })}
        </tbody>
      </table>
    </div>
  )
}