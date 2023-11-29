'use client'

import { useContext } from 'react';
import Link from 'next/link';

import { ThemeContext } from './themecontext';

import './page.scss';

export default function HomePage() {
  // const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
  const { theme } = useContext(ThemeContext);
  return (
    <section className={`section ${theme === 'dark' ? 'has-background-dark has-text-light' : ''}`}>
      <div className='container is-fullhd'>
        <section className={`hero is-full-height `}>
          <div className='hero-body'>
            <p className={`title ${theme === 'dark' ? 'has-text-light' : ''}`}>BLAST SERVER</p>
            <p className={`subtitle ${theme === 'dark' ? 'has-text-light' : ''}`}>WUR Bioinformatics Group</p>
            <table className={`table flavour-table ${theme}`}>
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
                      //@ts-ignore
                      disabled
                      className='button is-large is-fullwidth'
                      href='/blastn'
                      title='Search a nucleotide database with a nucleotide query'
                    >
                      blastn
                    </Link>
                    <Link
                      //@ts-ignore
                      disabled
                      className='button is-large is-fullwidth'
                      href='/tblastx'
                      title='Search a translated nucleotide database with a translated nucleotide query'
                    >
                      tblastx
                    </Link>
                  </td>
                  <td>
                    <Link
                      //@ts-ignore
                      disabled
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
                      // @ts-ignore
                      disabled
                      className='button is-large is-fullwidth'
                      href='/tblastn'
                      title='Search a translated nucleotide database with a protein query'
                    >
                      tblastn
                    </Link>
                  </td>
                  <td>
                    <Link
                      className='button is-large is-fullwidth'
                      href='/blastp'
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
      </div>
    </section>
  )
}
