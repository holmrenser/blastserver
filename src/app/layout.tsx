import React from "react";
import { Hanken_Grotesk } from "next/font/google";

import "./globals.css";
import Nav from "./nav";
import ThemeSync from "./theme-sync";
import { THEME_STORAGE_KEY } from "@/lib/stores/theme";

const font = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-sans" });

export const metadata = {
  title: "BLAST@WUR",
  description: "WUR BLAST service, hosted by the bioinformatics group",
};

// Runs before hydration to set the theme from localStorage, avoiding a flash of
// the wrong theme. Reads the same persisted shape the zustand store writes.
const themeScript = `(function(){try{var s=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY
)});var t=s?JSON.parse(s).state.theme:"light";if(t==="dark"){document.documentElement.classList.add("dark");}}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={font.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ThemeSync />
        <main>
          <Nav />
          {children}
        </main>
      </body>
    </html>
  );
}
