import React from "react";
import { Hanken_Grotesk } from "next/font/google";
import { ThemeProvider } from "next-themes";

import "./globals.css";
import Nav from "./nav";

const font = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-sans" });

export const metadata = {
  title: "BLAST@WUR",
  description: "WUR BLAST service, hosted by the bioinformatics group",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={font.variable} suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <main>
            <Nav />
            {children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
