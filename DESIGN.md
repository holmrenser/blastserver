# Features

## Must

- [x] Run BLAST jobs of various flavors (blastp, blastn, etc.) against all relevant databases
- [x] Use NCBI taxonomy (could simply be linking to NCBI)
- [x] Mimic NCBI blast's web interface as much as possible for educational purposes
- [x] Download (selected) sequences of BLAST hits

## Should

- [x] Implement distributed architecture to run multiple simultaneous BLAST jobs
- [x] Taxonomy distribution of hits
- [ ] Use clustered NR for speed ups

## Could

- [ ] Email notification when job finishes
- [ ] Integraded taxonomy browsing
- [ ] Filtering of blast results
- [ ] Allow various download formats of BLAST hits

## Will not
- Use Diamond instead of NCBI BLAST

# Similar work

- Genenotebook has some BLAST functionality, but only for custom DBs. BLAST output parsing code can be reused. No taxonomy. (https://genenotebook.github.io/)
- React-bio-viz has some components for visualization. BLAST visualization could be implemented here. (https://github.com/genenotebook/react-bio-viz)
- SequenceServer only handles custom DBs, could use nr and nt. No taxonomy. (https://sequenceserver.com/)

# Implementation

> See [README.md](README.md) for the current architecture and setup. Summary below.

## Frontend

- Next.js 15 (App Router) / React 19 / TypeScript
- Tailwind CSS v4 + shadcn/ui components; zustand for client state; SWR for polling
- react-hook-form + a shared zod schema for the BLAST parameter forms
- User interface modelled on NCBI BLAST

## Backend

- Next.js API routes (App Router) — no separate Express server
- pg-boss for the job queue, running on Postgres — no separate broker (https://github.com/timgit/pg-boss). Provides retries, exponential backoff, and per-job timeouts.
- Two pg-boss workers: `blastworker` (runs BLAST+ binaries) and `downloadworker` (using `blastdbcmd`)
- PostgreSQL via Prisma; NCBI BLAST databases on disk

## Deployment / scaling

- Docker Compose (`docker-compose.yml`): app + postgres + multiple worker replicas
- Horizontal scaling via additional `blastworker` / `downloadworker` replicas
