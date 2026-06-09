# BLAST@WUR

A web front-end and job runner for [NCBI BLAST+](https://blast.ncbi.nlm.nih.gov/), built for the WUR Bioinformatics Group. Users submit sequence-alignment jobs (`blastp`, `blastn`, `blastx`, `tblastn`, `tblastx`) through the browser; jobs are queued, executed against local BLAST databases by worker processes, and the results are rendered as sortable tables, a D3 hit-distribution plot, pairwise alignments, and a taxonomy tree.

## Architecture

```
Browser ──▶ Next.js app ──▶ pg-boss queue (Postgres) ──▶ blastworker  ──▶ blastp/blastn/… binaries
              │  (App Router,           │                  downloadworker ─▶ blastdbcmd
              │   API routes)           │
              └─────────────────────────┴──▶ PostgreSQL (Prisma): blastjob, download, taxonomy
```

- **App** (`src/app`) — Next.js 15 / React 19 App Router. UI is built with **Tailwind CSS v4 + shadcn/ui**; client state (theme) uses **zustand**; data fetching/polling uses **SWR**; forms use **react-hook-form** with a shared **zod** schema.
- **Queue** — **pg-boss** runs the `blastQueue` / `downloadQueue` job queues *on Postgres* (no separate broker), with retries, exponential backoff, and a per-job timeout. Job state itself lives in the `blastjob` / `download` tables, which the UI polls.
- **Workers** (`worker/`) — two pg-boss workers. `blastworker` runs the BLAST+ binary for a job; `downloadworker` extracts selected hit sequences with `blastdbcmd` and gzips them. Compiled separately via `tsconfig.worker.json`.
- **Validation** — a single zod schema in [`src/lib/blast/schema.ts`](src/lib/blast/schema.ts) drives both the client form (`zodResolver`) and server-side validation in the API routes. Allowlists in [`src/lib/blast/constants.ts`](src/lib/blast/constants.ts) are re-checked in the workers before any binary is run (defense in depth against command injection / path traversal).
- **Database** — PostgreSQL via Prisma ([`prisma/schema.prisma`](prisma/schema.prisma)): `blastjob` (parameters + raw XML results), `download` (gzipped FASTA), `taxonomy` (NCBI taxonomy for the organism filter).

## Quick start

The fastest way to see it running is the full container stack:

```bash
docker compose up --build      # → http://localhost:3000
```

This brings up Postgres, a one-shot migrate/seed job, then the app, `blastworker` and `downloadworker` — the same images that ship to production. A small `landmark` protein DB ships in [`blastdb/`](blastdb/) so it works out of the box; point it at your own databases with `BLAST_DB_PATH=/path/to/blastdb`.

> **Apple Silicon:** enable Docker Desktop's Rosetta emulation (*Settings → General → Use Rosetta for x86/amd64 emulation*). The images are `linux/amd64` because the BLAST+ binaries are x86_64 and Prisma's `binaryTargets` are x64; Compose sets `platform` for you.

## Development

Local hot-reload setup, dev scripts, environment variables, and how to submit changes are in **[CONTRIBUTING.md](CONTRIBUTING.md)**.
