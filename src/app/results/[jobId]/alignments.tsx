import { BlastHit } from "../../api/[...jobId]/route";

function padAligmentStrings(
  qseq: string, midline: string, hseq: string,
  queryFrom: string, queryTo: string, hitFrom: string, hitTo: string){
    const maxFrom = Math.max(queryFrom.length, hitFrom.length);
    const paddedQueryFrom = ' '.repeat(maxFrom - queryFrom.length) + ` ${queryFrom}`;
    const paddedHitFrom = ' '.repeat(maxFrom - hitFrom.length) + ` ${hitFrom}`;
    const paddedQseq = `Query ${paddedQueryFrom} ${qseq} ${queryTo}`;
    const paddedMidline = `${' '.repeat(maxFrom + 7)} ${midline}`;
    const paddedHseq = `Sbjct ${paddedHitFrom} ${hseq} ${hitTo}`;
    return [paddedQseq, paddedMidline, paddedHseq];
}

export default function Alignments({ hits }: { hits: BlastHit[] }) {
  return (
    <div>
      <nav className='navbar has-background-info-light' role='navigation'>
        <div className='navbar-menu'>
          <div className='navbar-start'>
            <p className='navbar-item'>Alignment view</p>
            <div className='select is-small' style={{marginTop: 12}}>
              <select disabled>
                <option>Pairwise</option>
              </select>
            </div>
          </div>
        </div>
      </nav>
      <ul className='is-size-7'>
        {hits.map(({ accession, title, hsps, len }) => (
          <li key={accession}>
            <div className='card' id={accession}>
              <header className='card-header is-size-6'>
                <b>{title}</b>
              </header>
              <p>
                Sequence ID:&nbsp;
                <a 
                  href={`https://www.ncbi.nlm.nih.gov/protein/${accession}`}
                  target='_blank'
                >
                  {accession}
                </a>
                &nbsp;Length: <b>{len}</b>
              </p>
              <div className='card-content'>
                <ul>
                  {hsps.map(({ hseq, qseq, midline, num, hitFrom, hitTo, queryFrom, queryTo }) => {
                    const [paddedQseq, paddedMidline, paddedHseq] = padAligmentStrings(
                      qseq, midline, hseq, queryFrom, queryTo, hitFrom, hitTo);
                    return (
                      <li key={num}>
                        <blockquote>
                          <pre>
                            {paddedQseq}
                            <br/>
                            {paddedMidline}
                            <br/>
                            {paddedHseq}
                          </pre>
                        </blockquote>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}