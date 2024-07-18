"use client";

import React, { useContext } from "react";
import Link from "next/link";

import { ThemeContext } from "./themecontext";
import type { Theme } from "./themecontext";

import "./page.scss";

type Moltype = "nucleotide" | "protein";

function QueryTargetTags({
  query,
  target,
  theme,
}: {
  query: Moltype;
  target: Moltype;
  theme: Theme;
}): React.JSX.Element {
  return (
    <div className="field is-grouped is-grouped-multiline">
      <div className="control">
        <div className="tags has-addons">
          <span className={`tag ${theme === "dark" ? "is-dark" : "is-white"}`}>
            Query
          </span>
          <span
            className={`tag ${
              query === "nucleotide" ? "is-primary" : "is-info"
            }`}
          >
            {query}
          </span>
        </div>
      </div>
      <div className="control">
        <div className="tags has-addons">
          <span className={`tag ${theme === "dark" ? "is-dark" : "is-white"}`}>
            Target
          </span>
          <span
            className={`tag ${
              target === "nucleotide" ? "is-primary" : "is-info"
            }`}
          >
            {target}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const { theme } = useContext(ThemeContext);
  return (
    <section className="section">
      <div className="container is-fullhd">
        <section className="hero is-fullheight">
          <div className="hero-body" style={{ display: "unset" }}>
            <p className="title">BLAST SERVER</p>
            <p className="subtitle">WUR Bioinformatics Group</p>
            <div className="columns">
              <div
                className={`column ${
                  theme === "dark"
                    ? "has-background-grey-dark"
                    : "has-background-light"
                }`}
              >
                <QueryTargetTags
                  query="protein"
                  target="protein"
                  theme={theme}
                />
                <Link
                  className="button is-large is-fullwidth"
                  href="/blastp"
                  title="Search a protein database with a protein query"
                >
                  blastp
                </Link>
              </div>
              <div
                className={`column ${
                  theme === "dark"
                    ? "has-background-grey-dark"
                    : "has-background-light"
                }`}
              >
                <QueryTargetTags
                  query="nucleotide"
                  target="nucleotide"
                  theme={theme}
                />
                <Link
                  //@ts-ignore
                  disabled
                  className="button is-large is-fullwidth"
                  href="/blastn"
                  title="Search a nucleotide database with a nucleotide query"
                  style={{ pointerEvents: "none" }}
                >
                  blastn
                </Link>
                <Link
                  //@ts-ignore
                  disabled
                  className="button is-large is-fullwidth"
                  href="/tblastx"
                  title="Search a translated nucleotide database with a translated nucleotide query"
                  style={{ pointerEvents: "none" }}
                >
                  tblastx
                </Link>
              </div>
              <div
                className={`column ${
                  theme === "dark"
                    ? "has-background-grey-dark"
                    : "has-background-light"
                }`}
              >
                <QueryTargetTags
                  query="nucleotide"
                  target="protein"
                  theme={theme}
                />
                <Link
                  //@ts-ignore
                  disabled
                  className="button is-large is-fullwidth"
                  href="/blastx"
                  title="Search a protein database with a translated nucleotide query"
                  style={{ pointerEvents: "none" }}
                >
                  blastx
                </Link>
              </div>
              <div
                className={`column ${
                  theme === "dark"
                    ? "has-background-grey-dark"
                    : "has-background-light"
                }`}
              >
                <QueryTargetTags
                  query="protein"
                  target="nucleotide"
                  theme={theme}
                />
                <Link
                  // @ts-ignore
                  disabled
                  className="button is-large is-fullwidth"
                  href="/tblastn"
                  title="Search a translated nucleotide database with a protein query"
                  style={{ pointerEvents: "none" }}
                >
                  tblastn
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}
