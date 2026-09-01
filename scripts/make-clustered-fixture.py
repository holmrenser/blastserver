#!/usr/bin/env python3
"""Build a small, self-consistent clustered_nr test fixture: a BLAST DB of cluster
representatives plus the matching member/LCA TSVs that the app seeds into Postgres.

Inputs (NCBI clustered_nr artifacts, not in this repo):
  cluster_data.sqlite3  — ClusterInfo(representative, member_accession, member_taxid,
                          member_title) + ClusterCommonAncestor(representative, taxid)
  nr_cluster_seq        — BLAST DB of the clustered_nr sequences

Outputs (written under --outdir into blastdb/ and cluster/ — by default the
repo's gitignored testdata/ root, the same layout docker-compose bind-mounts):
  blastdb/clustered_nr.*           — BLAST DB keyed on the representative accession
  cluster/test_cluster_members.tsv — CLUSTER_MEMBERS_FILE seed
  cluster/test_cluster_lca.tsv     — CLUSTER_LCA_FILE seed

The sample deliberately mixes versioned (accession.N) and legacy (no version
suffix) representatives so the fixture exercises the app's versioned-join path;
a plain `ORDER BY representative LIMIT n` would return only the lowest-sorting,
all-legacy accessions.

Why the per-rep relabel: `blastdbcmd -entry <rep>` reports the entry's PRIMARY
accession, which differs from ClusterInfo.representative when the representative is a
secondary accession. makeblastdb -parse_seqids would then key the DB on the primary
accession, breaking the join. Relabeling each defline to the representative keeps the
BLAST <accession>/saccver == representative == TSV key.

Why the per-rep taxid check: for a legacy/secondary accession `blastdbcmd -entry` can
resolve to an entirely unrelated record (a different organism's sequence), which the
relabel would then silently store under the representative — so a real query for that
representative's protein finds nothing. We therefore validate every extraction: the
taxid blastdbcmd returns (%T) must equal the representative's own member-row taxid (the
representative is always a member of its own cluster). Mismatches are dropped. Because
many legacy accessions fail this, the script oversamples candidates (--candidate-
multiplier) to still reach --rep-limit validated representatives, and writes the
member/LCA TSVs only for the survivors — so the DB and TSVs stay in lock-step.

Requires the BLAST+ CLI (blastdbcmd, makeblastdb) on PATH; SQLite is read via the
Python stdlib, so no sqlite3 CLI is needed.
"""

import argparse
import os
import sqlite3
import subprocess
import sys
import tempfile


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Build a clustered_nr BLAST DB + member/LCA TSV test fixture.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    # Inputs (NCBI clustered_nr artifacts).
    p.add_argument(
        "--sqlite",
        default="cluster_data.sqlite3",
        help="SQLite DB with ClusterInfo / ClusterCommonAncestor",
    )
    p.add_argument(
        "--db-src",
        default="nr_cluster_seq",
        help="source BLAST DB of clustered_nr sequences",
    )
    # Outputs. --outdir is the destination root; the DB lands in <outdir>/blastdb and
    # the TSVs in <outdir>/cluster — the same layout docker-compose bind-mounts — so no
    # manual move is needed. Defaults to the repo's gitignored testdata/ root.
    p.add_argument(
        "--outdir",
        default="testdata",
        help="destination root (DB -> <outdir>/blastdb, TSVs -> <outdir>/cluster)",
    )
    p.add_argument("--out", default="clustered_nr", help="BLAST DB base name")
    p.add_argument(
        "--members-out",
        default="test_cluster_members.tsv",
        help="CLUSTER_MEMBERS_FILE seed filename (written in <outdir>/cluster)",
    )
    p.add_argument(
        "--lca-out",
        default="test_cluster_lca.tsv",
        help="CLUSTER_LCA_FILE seed filename (written in <outdir>/cluster)",
    )
    p.add_argument(
        "--rep-limit",
        type=int,
        default=150,
        help="number of validated clusters to sample into the fixture",
    )
    p.add_argument(
        "--candidate-multiplier",
        type=int,
        default=20,
        help="oversample factor: pull rep-limit*this candidate representatives so "
        "taxid-validation rejections still leave ~rep-limit validated ones",
    )
    p.add_argument(
        "-v",
        "--verbose",
        action="store_true",
        help="log each external command as it runs",
    )
    p.add_argument(
        "--verify",
        action="store_true",
        help="after building the db, re-read every entry back out of it and confirm "
        "its taxid and sequence match what was extracted from --db-src. Catches the "
        "db silently ending up stale or out of sync with the TSVs it's supposed to "
        "match (e.g. a partial re-run that only regenerated one of the two outputs); "
        "exits non-zero with the mismatched accessions listed on any discrepancy.",
    )
    return p.parse_args()


def run(cmd, *, capture=False, check=True, verbose=False):
    if verbose:
        print("+ " + " ".join(cmd), file=sys.stderr)
    return subprocess.run(cmd, capture_output=capture, text=True, check=check)


def verify_build(db_out, kept, verbose=False):
    """Re-read every entry back out of the just-built db and confirm its taxid and
    sequence match what step 2 extracted and validated from --db-src. `kept` is the
    in-memory [(rep, taxid, seq)] list step 2 produced — the ground truth this build
    was supposed to encode. A mismatch here means the db that landed on disk isn't
    the one this run just built from (e.g. a stale file left over from an earlier,
    now-abandoned run, or a build that silently failed partway through), which is
    exactly the kind of drift that makes the fixture return wrong results without
    any error. Returns the list of mismatched accessions (empty on success)."""
    proc = run(
        ["blastdbcmd", "-db", db_out, "-entry", "all", "-outfmt", "%a\t%T\t%s"],
        capture=True,
        check=False,
        verbose=verbose,
    )
    if proc.returncode != 0:
        return [f"blastdbcmd -entry all failed: {proc.stderr.strip()}"]

    built = {}
    for line in proc.stdout.splitlines():
        acc, taxid, seq = line.split("\t", 2)
        built[acc] = (taxid, seq)

    mismatches = []
    for rep, expected_taxid, expected_seq in kept:
        if rep not in built:
            mismatches.append(f"{rep}: missing from built db")
            continue
        actual_taxid, actual_seq = built[rep]
        if actual_taxid != expected_taxid:
            mismatches.append(
                f"{rep}: taxid {actual_taxid} in db, expected {expected_taxid}"
            )
        elif actual_seq != expected_seq:
            mismatches.append(f"{rep}: sequence in db doesn't match --db-src extraction")
    return mismatches


def write_tsv(path, header, rows):
    """Write rows as tab-separated, unquoted lines with a leading header row — the
    format the migrate-and-seed COPY (DELIMITER tab, QUOTE E'\\b', CSV HEADER) expects:
    one row per line, header skipped on load, columns matched positionally. Titles and
    taxids are already flattened/coalesced in SQL, so a raw tab-join is safe."""
    with open(path, "w") as f:
        f.write("\t".join(header) + "\n")
        for row in rows:
            f.write("\t".join("" if v is None else str(v) for v in row) + "\n")


def main() -> int:
    args = parse_args()
    if args.rep_limit <= 0:
        sys.exit("--rep-limit must be a positive integer")
    if args.candidate_multiplier <= 0:
        sys.exit("--candidate-multiplier must be a positive integer")
    if not os.path.exists(args.sqlite):
        # Guard: sqlite3.connect() would otherwise silently create an empty DB and
        # then fail later with a confusing "no such table".
        sys.exit(f"SQLite DB not found: {args.sqlite}")

    blast_db_dir = os.path.join(args.outdir, "blastdb")
    cluster_dir = os.path.join(args.outdir, "cluster")
    # Create the destination dirs up front, so a bad --outdir fails fast rather than
    # after the slow sequence-extraction and SQL passes.
    os.makedirs(blast_db_dir, exist_ok=True)
    os.makedirs(cluster_dir, exist_ok=True)

    con = sqlite3.connect(args.sqlite)
    try:
        # 1. Pick candidate representatives. Two strata — versioned (accession.N,
        #    LIKE '%.%') and legacy (no version suffix) — because a single
        #    `ORDER BY representative LIMIT n` returns only the lowest-sorting
        #    (all-legacy) accessions. ORDER BY keeps the subset deterministic.
        #
        #    Oversample by --candidate-multiplier: legacy/secondary accessions often
        #    mis-resolve in blastdbcmd and get dropped by the taxid check (step 2), so
        #    a pool larger than --rep-limit is needed to still reach --rep-limit
        #    survivors.
        pool = args.rep_limit * args.candidate_multiplier

        def pick_reps(where_clause, n):
            # Deliberately simple (no per-group subquery): a GROUP BY that SQLite can
            # stream over the representative index and short-circuit at LIMIT. This
            # `LIKE '%.%'` pass over the ~287M-row ClusterInfo is the slow part, and it
            # runs BEFORE any blastdbcmd call — so `-v` prints nothing until it's done.
            return [
                row[0]
                for row in con.execute(
                    f"""
                    SELECT representative FROM ClusterInfo
                    WHERE {where_clause}
                    GROUP BY representative HAVING COUNT(*) BETWEEN 3 AND 10
                    ORDER BY representative LIMIT ?
                    """,
                    (n,),
                )
            ]

        print(
            "Selecting candidate representatives (scans ClusterInfo — can take a few "
            "minutes, no output until it finishes)...",
            file=sys.stderr,
        )
        # Versioned first (they resolve reliably in blastdbcmd), then legacy; de-dup.
        candidate_reps = []
        seen = set()
        for rep in pick_reps("representative LIKE '%.%'", pool) + pick_reps(
            "representative NOT LIKE '%.%'", pool
        ):
            if rep not in seen:
                seen.add(rep)
                candidate_reps.append(rep)
        if not candidate_reps:
            sys.exit("no representatives matched the selection query")

        # Each candidate's own taxid — the member_taxid of the row where the
        # representative is its own cluster member (it always is) — is the ground truth
        # step 2 validates each extraction against. Fetched in bounded IN-list chunks
        # over just the candidate pool (not a per-representative scan of the whole
        # table); chunked to stay under SQLite's bound-variable limit.
        own_taxid = {}
        for i in range(0, len(candidate_reps), 500):
            chunk = candidate_reps[i : i + 500]
            ph = ",".join("?" * len(chunk))
            for rep, tax in con.execute(
                f"""SELECT representative, member_taxid FROM ClusterInfo
                    WHERE member_accession = representative
                      AND member_taxid IS NOT NULL AND member_taxid <> ''
                      AND representative IN ({ph})""",
                chunk,
            ):
                own_taxid[rep] = str(tax)
        candidates = [(rep, own_taxid[rep]) for rep in candidate_reps if rep in own_taxid]
        print(
            f"Selected {len(candidates)} candidates; extracting + validating...",
            file=sys.stderr,
        )

        # Scratch FASTA + taxid map live in a temp dir removed on exit (context
        # manager), so a partial run leaves no stray files; the outputs are the only
        # footprint. makeblastdb reads them before the block exits.
        with tempfile.TemporaryDirectory() as work:
            reps_faa = os.path.join(work, "reps.faa")
            taxidmap = os.path.join(work, "reps.taxidmap.tsv")

            # 2. Extract each candidate's sequence, relabeling the defline to the
            #    representative accession (see module docstring), and VALIDATE it: the
            #    taxid blastdbcmd returns must equal the representative's own member-row
            #    taxid, or the accession mis-resolved to an unrelated record and we drop
            #    it. Stop once --rep-limit representatives have passed.
            missing = 0
            rejected = 0
            processed = 0
            kept = []  # [(rep, taxid, seq)] — the representatives that made it into the DB
            with open(reps_faa, "w") as faa, open(taxidmap, "w") as tmap:
                for rep, expected_taxid in candidates:
                    if len(kept) >= args.rep_limit:
                        break
                    processed += 1
                    if processed % 250 == 0:
                        print(
                            f"  ...processed {processed} candidates "
                            f"(kept {len(kept)}, rejected {rejected})",
                            file=sys.stderr,
                        )
                    proc = run(
                        [
                            "blastdbcmd",
                            "-db",
                            args.db_src,
                            "-entry",
                            rep,
                            "-outfmt",
                            "%T\t%s",
                        ],
                        capture=True,
                        check=False,
                        verbose=args.verbose,
                    )
                    if proc.returncode != 0:
                        missing += 1
                        continue
                    # An ambiguous accession can return several records; take the first.
                    first_line = proc.stdout.rstrip("\n").split("\n", 1)[0]
                    try:
                        taxid, seq = first_line.split("\t", 1)
                    except ValueError:
                        missing += 1
                        continue
                    taxid = taxid.strip()
                    if taxid != expected_taxid:
                        # Mis-resolved (e.g. a legacy patent accession returning an
                        # unrelated organism). Dropping keeps the DB self-consistent
                        # AND queryable with the representative's real sequence.
                        rejected += 1
                        if args.verbose:
                            print(
                                f"reject {rep}: resolved to taxid {taxid}, "
                                f"expected {expected_taxid}",
                                file=sys.stderr,
                            )
                        continue
                    faa.write(f">{rep}\n{seq}\n")
                    tmap.write(f"{rep}\t{taxid}\n")
                    kept.append((rep, taxid, seq))

            if not kept:
                sys.exit(
                    "no representatives survived taxid validation — check --db-src "
                    "and that its accessions match ClusterInfo.representative"
                )
            kept_reps = [rep for rep, _, _ in kept]

            # 3. Member + LCA TSVs for the representatives that survived validation
            #    (kept_reps) — so the TSVs and the DB describe exactly the same set.
            #    One parameterized IN-list pass each (not a per-rep scan of the ~287M-row
            #    ClusterInfo table). Titles are flattened of tabs/newlines so the
            #    tab-separated, quoting-disabled COPY seed stays one row per line.
            placeholders = ",".join("?" * len(kept_reps))

            members_path = os.path.join(cluster_dir, args.members_out)
            write_tsv(
                members_path,
                ["representative", "accession", "taxid", "title"],
                con.execute(
                    f"""
                    SELECT representative, member_accession,
                           coalesce(member_taxid, ''),
                           replace(replace(coalesce(member_title, ''),
                                           char(10), ' '), char(9), ' ')
                    FROM ClusterInfo WHERE representative IN ({placeholders})
                    """,
                    kept_reps,
                ),
            )

            lca_path = os.path.join(cluster_dir, args.lca_out)
            write_tsv(
                lca_path,
                ["representative", "lca_taxid"],
                con.execute(
                    f"""
                    SELECT representative, coalesce(taxid, '')
                    FROM ClusterCommonAncestor WHERE representative IN ({placeholders})
                    """,
                    kept_reps,
                ),
            )

            # 4. Build the DB keyed on the representative accession.
            db_out = os.path.join(blast_db_dir, args.out)
            run(
                [
                    "makeblastdb",
                    "-in",
                    reps_faa,
                    "-dbtype",
                    "prot",
                    "-parse_seqids",
                    "-taxid_map",
                    taxidmap,
                    "-title",
                    "Test ClusteredNR",
                    "-out",
                    db_out,
                ],
                verbose=args.verbose,
            )

            # 5. Optionally confirm the db that just landed on disk actually encodes
            #    what step 2 validated, rather than trusting the makeblastdb run above
            #    unconditionally (see verify_build's docstring for what this catches).
            if args.verify:
                print("Verifying built db against validated extractions...", file=sys.stderr)
                mismatches = verify_build(db_out, kept, verbose=args.verbose)
                if mismatches:
                    print(
                        f"VERIFY FAILED: {len(mismatches)} of {len(kept)} representative(s) "
                        "in the built db don't match what was extracted from --db-src:",
                        file=sys.stderr,
                    )
                    for m in mismatches[:20]:
                        print(f"  {m}", file=sys.stderr)
                    if len(mismatches) > 20:
                        print(f"  ...and {len(mismatches) - 20} more", file=sys.stderr)
                    sys.exit(
                        f"{db_out} does not match {members_path}/{lca_path} — "
                        "discard this output and rebuild from a fresh --sqlite/--db-src pair"
                    )
                print(f"Verify OK: all {len(kept)} representative(s) match.", file=sys.stderr)
    finally:
        con.close()

    if missing or rejected:
        print(
            f"Skipped {missing} missing + {rejected} taxid-mismatched candidate(s) "
            f"from {args.db_src}.",
            file=sys.stderr,
        )
    if len(kept_reps) < args.rep_limit:
        print(
            f"WARNING: kept {len(kept_reps)} of {args.rep_limit} requested; "
            f"raise --candidate-multiplier to include more.",
            file=sys.stderr,
        )
    print(
        f"Done. Wrote {db_out}.*, {members_path} and {lca_path} "
        f"for {len(kept_reps)} representative(s)."
    )
    print(f"Sanity check (should be {len(kept_reps)}):")
    print(f"  comm -12 <(blastdbcmd -db {db_out} -entry all -outfmt '%a' | sort -u) \\")
    print(f"           <(tail -n +2 {lca_path} | cut -f1 | sort -u) | wc -l")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
