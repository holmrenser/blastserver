import React from "react";

import { ThemeProvider } from "./themecontext";

import App from "./app";
import "./globals.scss";

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
    <ThemeProvider>
      <App>{children}</App>
    </ThemeProvider>
  );
}
