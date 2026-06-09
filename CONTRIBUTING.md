# Contributing to BLAST@WUR

This guide covers running the project locally, the dev workflow, and how to get a
change merged. For a high-level overview of what the system is and how it fits
together, see the [README](README.md).

## Prerequisites

- **Node.js ≥ 24.4.1** (see `engines` in [package.json](package.json)).
- **Docker** (Desktop on macOS/Windows) — used for the local Postgres, Redis, and
  workers. On Apple Silicon, enable *Settings → General → Use Rosetta for
  x86/amd64 emulation* (the images are `linux/amd64`; the BLAST+ binaries are
  x86_64).
- **BLAST data:** BLAST databases under the directory referenced by
  `APP_BLAST_DB_PATH` (a small `landmark` protein DB ships in
  [`blastdb/`](blastdb/) for testing) and the NCBI taxonomy TSV at
  `TAXONOMY_FILE`.

To run the **workers on the host** instead of in Docker (see below), you also need
the NCBI BLAST+ binaries (`blastp`, `blastn`, … and `blastdbcmd`) on your `PATH`.

## Local development (hot reload)

The recommended loop runs the data services **and** the workers in Docker, and the
Next.js app on the host with hot module reloading. The base
[docker-compose.yml](docker-compose.yml) only `expose`s Postgres/Redis
network-internally, so [docker-compose.dev.yml](docker-compose.dev.yml) is a
dev-only overlay that publishes their ports to the host — that's what lets a
host-run `next dev` reach them.

1. **Install:** `npm ci`
2. **Env:** `cp .env.example .env.development`. The committed defaults already point
   `DATABASE_URL` / `JOBQUEUE_HOST` at the published compose ports — see
   [Environment variables](#environment-variables).
3. **Start the infra** (Postgres + Redis + one-shot migrate/seed + both workers,
   backgrounded):

   ```bash
   npm run dev:infra
   ```

4. **Start the app** with hot reload:

   ```bash
   npm run dev:app        # → http://localhost:3000
   ```

5. **Tear down** when you're done:

   ```bash
   npm run dev:infra:down
   ```

Edit anything under [src/](src/) and it reloads live.

### Editing worker code

The workers run as compiled JS (`worker/build/`), so there's no HMR for them. To
iterate on worker code, bring up only the data services and run the workers on the
host (requires BLAST+ on `PATH`):

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d postgres redis migrate
npm run build:worker && npm run dev:worker
```

Re-run `npm run build:worker` after each change.

### Full container stack (closest to production)

```bash
docker compose up --build      # everything incl. app; no HMR
```

Point it at your databases with `BLAST_DB_PATH=/path/to/blastdb`. This runs the
same images used in production.

## Useful scripts

| Script | Purpose |
| --- | --- |
| `npm run dev:infra` / `dev:infra:down` | start / stop the Dockerised data services + workers |
| `npm run dev:app` | dev server for the app (hot reload) |
| `npm run dev:worker` | both workers on the host (compiled JS, no HMR) |
| `npm run build:app:prod` / `build:worker` | production builds |
| `npm run migrate:deploy` | apply migrations + seed taxonomy (the one-shot bootstrap) |
| `npm run lint` | ESLint (flat config) |
| `npm test` | Jest unit tests |
| `npx tsc --noEmit` / `tsc -p tsconfig.worker.json --noEmit` | typecheck app / worker |

## Database & migrations

PostgreSQL via Prisma ([`prisma/schema.prisma`](prisma/schema.prisma)). Committed
migrations live in [`prisma/migrations/`](prisma/migrations/);
`npm run migrate:deploy` applies them and seeds the `taxonomy` table if empty (the
`migrate` compose service runs this for you in the dev loop above). When you change
the schema during development, use `npx prisma migrate dev` to generate a new
migration.

## Submitting changes

1. Branch off `main`.
2. Before opening a PR, run the same checks CI enforces
   ([`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs these on every
   pull request):

   ```bash
   npm run lint && npm run build:worker && npm run build:app:prod && npm test
   ```

3. Open a PR against `main`. CI must be green before merge; on merge to `main` the
   app and worker images are built and pushed to GHCR, tagged by commit SHA.

Code style is enforced by ESLint (flat config) and TypeScript — there's no separate
style guide, so match the surrounding code and keep `npm run lint` clean.

## Configuration model

No `.env` file is baked into the images — all runtime config is injected from the
environment: inline `environment:` in Compose, and `.env.development` for host dev.
Copy [`.env.example`](.env.example) as the reference for every key.

### Environment variables

| Variable | Used by | Description |
| --- | --- | --- |
| `DATABASE_URL` | app, workers, migrate | Postgres connection string |
| `JOBQUEUE_HOST` / `JOBQUEUE_PORT` | app, workers | Redis host/port for BullMQ |
| `APP_BLAST_DB_PATH` | workers | directory containing BLAST databases |
| `NUM_BLAST_THREADS` | blastworker | `-num_threads` passed to BLAST (default `4`) |
| `BLAST_MAX_BUFFER` | workers | cap (bytes) on spawnSync output buffer (default 1 GiB) |
| `BLAST_LOCK_DURATION_MS` | workers | BullMQ stalled-job lock in ms (default 30 min) |
| `HEALTH_PORT` | workers | port for the worker `/healthz` `/readyz` server (default 8080) |
| `TAXONOMY_FILE` | migrate | taxonomy TSV path **on the Postgres host** (seed COPY is server-side) |
| `BASE_PATH` / `NEXT_PUBLIC_BASE_PATH` | app (build arg) | base path when served under a sub-path |
| `CORS_ALLOW_ORIGIN` | app | comma-separated origin allowlist for `/api` CORS (empty = same-origin only) |
| `APP_PORT` / `BLAST_DB_PATH` / `NAME` | compose only | published port, host BLAST DB path, project name |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | postgres | Postgres credentials |

### Health endpoints

- App: `GET /api/health` (liveness) and `GET /api/ready` (readiness — checks
  Postgres + Redis).
- Workers: `GET /healthz` (liveness) and `GET /readyz` (readiness) on
  `HEALTH_PORT`.
