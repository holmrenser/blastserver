import Link from 'next/link';

import { Inter, Hanken_Grotesk } from 'next/font/google'

import './globals.scss'

const ALLOWED_FLAVOURS = ['blastp','blastx','blastn','tblastx','tblastn']

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
          <nav className="navbar" role="navigation" aria-label="main navigation">
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
              <Link className="navbar-item" href='/jobqueue'>
                Jobqueue
              </Link>
            </div>
            </div>
          </nav>
          
          <section className='section has-background-light'>
            <div className='container is-max-desktop'>
              {children}
            </div>
          </section>
        </main>
      </body>
    </html>
  )
}
