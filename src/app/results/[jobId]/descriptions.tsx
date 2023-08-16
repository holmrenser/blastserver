import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { BlastHit } from "../../api/[...jobId]/route";
import styles from './descriptions.module.scss';

function truncate(string: string, limit=20){
  if (string.length <= limit) return string;
  return string.slice(0, limit) + '...'
}

export default function Descriptions({ hits }: {hits: BlastHit[]}): JSX.Element {
  const pathname = usePathname();
  console.log(hits[0])
  return (
    <div className={`has-background-light description-container ${styles.descriptionContainer}`}>
      <nav className='navbar has-background-info-light' role='navigation'>
        <div className='navbar-brand'>
          <b className='navbar-item'>Sequences producing significant alignments</b>
        </div>

        <div className='navbar-menu'>
          <div className='navbar-end'>
            <p className='navbar-item'>Download</p>
            <p className='navbar-item'>Select Columns</p>
            <p className='navbar-item'>Show #</p>
          </div>
        </div>
      </nav>
      <label className={`checkbox select-all ${styles.selectAll}`}>
        <input type='checkbox'/>
        Select all
      </label>
      <table className='table is-size-7 is-narrow is-hoverable is-fullwidth'>
        <thead>
          <tr>
            <th></th>
            <th>Description</th>
            <th>Scientific Name</th>
            <th>Max Score</th>
            <th>Total Score</th>
            <th>Query Cover</th>
            <th>E value</th>
            <th>Per. Ident.</th>
            <th>Acc. Len.</th>
            <th>Accession</th>
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
              <td><input type='checkbox'/></td>
              <td>
                <Link
                  href={{
                    pathname,
                    query: {
                      panel: 'alignments'
                    },
                    hash: accession
                  }}
                >
                  {title}
                </Link>
              </td>
              <td>
                <a 
                  href={`https://www.ncbi.nlm.nih.gov/Taxonomy/Browser/wwwtax.cgi?id=${taxid}`}
                  target='_blank'
                  title={name}
                >
                  {truncate(name)}
                </a>
              </td>
              <td>{maxScore}</td>
              <td>{totalScore}</td>
              <td>{queryCover}%</td>
              <td>{formattedEvalue}</td>
              <td>{percentIdentity.toFixed(2)}%</td>
              <td>{len}</td>
              <td>
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