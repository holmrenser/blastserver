-- Migrate the taxonomy table from text taxids to integers. NCBI taxids are
-- inherently small integers; storing them as Int / Int[] gives a more compact,
-- index-friendly ~2.7M-row table.
--
-- Prisma can't infer the cast for an incompatible type change, so the USING
-- clauses are written by hand. The casts run in place over already-seeded rows
-- (the seed step is idempotent and skips when rows exist, so we never truncate).
-- The PK / unique index on `id` is rebuilt automatically by ALTER TYPE.

-- AlterTable
ALTER TABLE "taxonomy"
  ALTER COLUMN "id" TYPE INTEGER USING "id"::integer,
  -- text[] has no direct cast to integer[]; round-trip through the text array
  -- literal ('{1,2,3}') which integer[] can parse.
  ALTER COLUMN "ancestors" TYPE INTEGER[] USING "ancestors"::text::integer[];
