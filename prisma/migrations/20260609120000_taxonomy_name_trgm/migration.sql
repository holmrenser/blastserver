-- Speed up the taxonomy autocomplete. The /api/taxonomy endpoint matches
-- `name` with a case-insensitive `contains` (ILIKE '%q%') over ~2.7M rows; with
-- no index that is a full table scan on every keystroke. pg_trgm lets a GIN
-- index back ILIKE/`contains` queries (effective for patterns of >= 3 chars,
-- which the frontend now enforces).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "taxonomy_name_trgm"
  ON "taxonomy" USING gin (name gin_trgm_ops);
