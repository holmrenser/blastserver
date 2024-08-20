import { ThemeContext } from "@/app/themecontext";
import React, { useContext } from "react";

import { BlastHit } from "../../api/[...jobId]/formatResults";

import styles from "./alignments.module.scss";

function padAligmentStrings(
  qseq: string,
  midline: string,
  hseq: string,
  queryFrom: string,
  queryTo: string,
  hitFrom: string,
  hitTo: string
) {
  const maxFrom = Math.max(queryFrom.length, hitFrom.length);
  const paddedQueryFrom =
    " ".repeat(maxFrom - queryFrom.length) + ` ${queryFrom}`;
  const paddedHitFrom = " ".repeat(maxFrom - hitFrom.length) + ` ${hitFrom}`;
  const paddedQseq = `Query ${paddedQueryFrom} ${qseq} ${queryTo}`;
  const paddedMidline = `${" ".repeat(maxFrom + 7)} ${midline}`;
  const paddedHseq = `Sbjct ${paddedHitFrom} ${hseq} ${hitTo}`;
  return [paddedQseq, paddedMidline, paddedHseq];
}

export default function Alignments({
  hits,
}: {
  hits: BlastHit[];
}): React.JSX.Element {
  const { theme } = useContext(ThemeContext);
  return (
    <div
      className={`${theme === "dark" ? "has-background-grey" : ""} ${
        styles.alignmentContainer
      }`}
    >
      <nav
        className={`navbar ${
          theme === "dark" ? "has-background-info" : "has-background-info-light"
        }`}
        role="navigation"
      >
        <div className="navbar-brand">
          <p
            className={`navbar-item ${
              theme === "dark" ? "has-text-light" : ""
            }`}
          >
            Alignment view
          </p>
          <div className="select is-small" style={{ marginTop: 12 }}>
            <select disabled>
              <option>Pairwise</option>
            </select>
          </div>
        </div>
      </nav>
      <ul className="is-size-7">
        {hits.map(({ accession, title, hsps, len }) => (
          <li key={accession} style={{ paddingTop: "2px" }}>
            <div
              className={`${styles.alignmentCard} card ${
                theme === "dark"
                  ? "has-background-grey-dark has-text-light"
                  : ""
              }`}
              id={accession}
            >
              <header className="card-header is-size-6">
                <b style={{ paddingLeft: "4px" }}>{title}</b>
              </header>
              <div className={`${styles.alignmentCardContent} card-content`}>
                <p>
                  Sequence ID:&nbsp;
                  <a
                    href={`https://www.ncbi.nlm.nih.gov/protein/${accession}`}
                    target="_blank"
                  >
                    {accession}
                  </a>
                  &nbsp;Length: <b>{len}</b>
                </p>
                <ul>
                  {hsps.map(
                    ({
                      hseq,
                      qseq,
                      midline,
                      num,
                      hitFrom,
                      hitTo,
                      queryFrom,
                      queryTo,
                    }) => {
                      const [paddedQseq, paddedMidline, paddedHseq] =
                        padAligmentStrings(
                          qseq,
                          midline,
                          hseq,
                          queryFrom,
                          queryTo,
                          hitFrom,
                          hitTo
                        );
                      return (
                        <li key={num}>
                          <blockquote className={styles.alignmentBlock}>
                            <pre
                              className={
                                theme === "dark"
                                  ? "has-background-grey has-text-light"
                                  : ""
                              }
                            >
                              {paddedQseq}
                              <br />
                              {paddedMidline}
                              <br />
                              {paddedHseq}
                            </pre>
                          </blockquote>
                        </li>
                      );
                    }
                  )}
                </ul>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
