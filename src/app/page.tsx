import Link from 'next/link';

import './page.scss';

export default function HomePage() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
  return (
    <section className='hero is-full-height'>
      <div className='hero-body'>
        <p className='title'>BLAST SERVER</p>
        <p className='subtitle'>WUR Bioinformatics Group</p>
        <table className='table flavour-table'>
          <caption>
            Flavours
          </caption>
          <thead>
            <tr>
              <th rowSpan={2} colSpan={2}></th>
              <th colSpan={2}>Database</th>
            </tr>
            <tr>
              <th className='moltype'>nucleotide</th>
              <th className='moltype'>protein</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th rowSpan={2} id='querylabel'>Query</th>
              <th className='moltype'>nucleotide</th>
              <td>
                <Link
                  className='button is-large is-fullwidth'
                  href='/blastn'
                  title='Search a nucleotide database with a nucleotide query'
                >
                  blastn
                </Link>
                <Link
                  className='button is-large is-fullwidth'
                  href='/tblastx'
                  title='Search a translated nucleotide database with a translated nucleotide query'
                >
                  tblastx
                </Link>
              </td>
              <td>
                <Link
                  className='button is-large is-fullwidth'
                  href='/blastx'
                  title='Search a protein database with a translated nucleotide query'
                >
                  blastx
                </Link>
              </td>
            </tr>
            <tr>
              <th className='moltype'>protein</th>
              <td>
                <Link
                  className='button is-large is-fullwidth'
                  href='tblastn'
                  title='Search a translated nucleotide database with a protein query'
                >
                  tblastn
                </Link>
              </td>
              <td>
                <Link
                  className='button is-large is-fullwidth'
                  href='blastp'
                  title='Search a protein database with a protein query'
                >
                  blastp
                </Link>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  )
}
