'use client';

import { ThemeContext } from "@/app/themecontext"
import { useContext } from "react"

export default function Layout({ children }: { children: React.ReactNode}) {
  const { theme } = useContext(ThemeContext)
  return <section className={`section ${theme === 'dark' ? 'has-background-dark has-text-light' : ''}`}>
    { children }
  </section>
}