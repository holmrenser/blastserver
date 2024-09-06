import { ThemeContext } from "@/app/themecontext";
import React, { useContext } from "react";

import { BlastHit, Hsp } from "../../api/[...jobId]/formatResults";

import styles from "./alignments.module.scss";

function padAligmentStrings(hsp: Hsp) {
  const { qseq, midline, hseq, queryFrom, queryTo, hitFrom, hitTo } = hsp;
  const maxFrom = Math.max(queryFrom.length, hitFrom.length);
  const paddedQueryFrom =
    " ".repeat(maxFrom - queryFrom.length) + ` ${queryFrom}`;
  const paddedHitFrom = " ".repeat(maxFrom - hitFrom.length) + ` ${hitFrom}`;
  const paddedQseq = `Query ${paddedQueryFrom} ${qseq} ${queryTo}`;
  const paddedMidline = `${" ".repeat(maxFrom + 7)} ${midline}`;
  const paddedHseq = `Sbjct ${paddedHitFrom} ${hseq} ${hitTo}`;
  return [paddedQseq, paddedMidline, paddedHseq];
}

function HspBlock({ hsp }: { hsp: Hsp }): React.JSX.Element {
  const { theme } = useContext(ThemeContext);
  const { score, evalue: _evalue, midline, bitScore } = hsp;
  const evalue = Number(_evalue);
  const formattedEvalue = evalue === 0 ? evalue : evalue.toExponential(0);
  const alignLen = Number(hsp.alignLen);
  const positives = midline.split("+").length - 1;
  const gaps = midline.split(" ").length - 1;
  const identities = alignLen - positives - gaps;
  const [paddedQseq, paddedMidline, paddedHseq] = padAligmentStrings(hsp);
  return (
    <>
      <table className={`${styles.hspTable} table is-bordered`}>
        <thead>
          <tr className="">
            <th>Score</th>
            <th>Expect</th>
            <th>Identities</th>
            <th>Positives</th>
            <th>Gaps</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              {Math.floor(Number(bitScore))} bits ({score})
            </td>
            <td>{formattedEvalue}</td>
            <td>
              {identities}/{alignLen}(
              {Math.floor((identities / alignLen) * 100)}%)
            </td>
            <td>
              {positives}/{alignLen}({Math.floor((positives / alignLen) * 100)}
              %)
            </td>
            <td>
              {gaps}/{alignLen}({Math.floor((gaps / alignLen) * 100)}%)
            </td>
          </tr>
        </tbody>
      </table>
      <blockquote className={styles.alignmentBlock}>
        <pre
          className={
            theme === "dark" ? "has-background-grey has-text-light" : ""
          }
        >
          {paddedQseq}
          <br />
          {paddedMidline}
          <br />
          {paddedHseq}
        </pre>
      </blockquote>
    </>
  );
}

function HitPanel({ hit }: { hit: BlastHit }): React.JSX.Element {
  const { theme } = useContext(ThemeContext);
  const { accession, title, len, hsps } = hit;
  return (
    <div
      className={`${styles.alignmentCard} card ${
        theme === "dark" ? "has-background-grey-dark has-text-light" : ""
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
          &nbsp;Number of hits: <b>{hsps.length}</b>
        </p>
        <ul>
          {hsps.map((hsp) => (
            <li key={hsp.num}>
              <HspBlock hsp={hsp} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
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
        {hits.map((hit) => (
          <li key={hit.accession} style={{ paddingTop: "2px" }}>
            <HitPanel hit={hit} />
          </li>
        ))}
      </ul>
    </div>
  );
}
