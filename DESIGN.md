# Features

## Must

- Run BLAST jobs of various flavors (blastp, blastn, etc.) against all relevant databases
- Use NCBI taxonomy (could simply be linking to NCBI)
- Use Diamond instead of NCBI BLAST

## Should

- Load balancing to allow (many) simultaneous jobs
- Taxonomy distribution of hits
- Diamond formatted database for using database

## Could

- Email notification when job finishes
- Integraded taxonomy browsing
- Filtering of blast results

## Will not

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
- Two pg-boss workers: `blastworker` (runs BLAST+ binaries) and `downloadworker` (`blastdbcmd`)
- PostgreSQL via Prisma; NCBI BLAST databases on disk
- Diamond support: not yet implemented

## Deployment / scaling

- Docker Compose (`docker-compose.yml`): app + postgres + multiple worker replicas
- Horizontal scaling via additional `blastworker` / `downloadworker` replicas
