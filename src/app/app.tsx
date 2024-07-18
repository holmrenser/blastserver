"use client";
import React, { useContext } from "react";
import { Hanken_Grotesk } from "next/font/google";

import { ThemeContext } from "./themecontext";
import Nav from "./nav";

const font = Hanken_Grotesk({ subsets: ["latin"], weight: "400" });

export default function App({ children }: { children: React.ReactNode }) {
  const { theme } = useContext(ThemeContext);
  return (
    <html lang="en" data-theme={theme}>
      <body>
        <main className={font.className}>
          <Nav />
          {children}
        </main>
      </body>
    </html>
  );
}
