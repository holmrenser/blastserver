import Link from 'next/link';

import { Inter, Hanken_Grotesk, Open_Sans } from 'next/font/google'

import { QueueStatus } from './queuestatus';

import './globals.scss'

//@ts-ignore
import { ALLOWED_FLAVOURS } from './[blastFlavour]/blastflavour.d.ts';

// const ALLOWED_FLAVOURS = ['blastp','blastx','blastn','tblastx','tblastn']

const font = Hanken_Grotesk({ subsets: ['latin']})

export const metadata = {
  title: 'BLAST',
  description: 'Web form to submit BLAST jobs',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <main className={font.className}>
          <nav className="navbar has-background-light" role="navigation" aria-label="main navigation">
          <div className="navbar-brand">
            <Link className="navbar-item" href="/">
              BLAST
            </Link>

            <a role="button" className="navbar-burger" aria-label="menu" aria-expanded="false" data-target="blast-navbar">
              <span aria-hidden="true"></span>
              <span aria-hidden="true"></span>
              <span aria-hidden="true"></span>
            </a>
          </div>

          <div id="blast-navbar" className="navbar-menu">
            <div className="navbar-start">
              <div className="navbar-item has-dropdown is-hoverable">
                <a className="navbar-link">
                  Flavours
                </a>

                <div className="navbar-dropdown">
                  {
                    ALLOWED_FLAVOURS.map(flavour => (
                      <Link className='navbar-item' href={`/${flavour}`} key={flavour}>
                        {flavour}
                      </Link>
                    ))
                  }
                </div>
              </div>
            </div>
            <div className='navbar-end'>
              <p className='navbar-item'>Queue</p>
              <div className='navbar-item'>
                <QueueStatus />
              </div>
            </div>
            </div>
          </nav>
          
          <section className='section has-background-white'>
            <div className='container is-fullhd'>
              {children}
            </div>
          </section>
        </main>
      </body>
    </html>
  )
}
