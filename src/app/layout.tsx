import { Inter, Hanken_Grotesk, Open_Sans } from 'next/font/google'

import { ThemeProvider } from './themecontext';
import Nav from './nav';

import './globals.scss'

const font = Hanken_Grotesk({ subsets: ['latin']})


export const metadata = {
  title: 'JingleBLAST',
  description: 'Happy holidays from the bioinformatics group',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider>
          <main className={font.className}>
            <Nav />
            { children }
          </main>
        </ThemeProvider>
      </body>
    </html>
  )
}
