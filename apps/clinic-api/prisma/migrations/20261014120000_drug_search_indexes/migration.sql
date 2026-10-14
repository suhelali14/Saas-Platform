-- Make the medicine search able to find a salt, and able to do it fast.
--
-- The catalogue is ~246,000 rows. Until now only `name` was indexed, and
-- the endpoint only searched `name` with a prefix match. That finds
-- "Dolo 650" from "dolo", which is the easy half. It finds 2 rows for
-- "paracetamol" -- while 17,528 rows carry paracetamol in their
-- composition, and 27,725 carry amoxicillin-family salts for "amo".
--
-- Indian prescribing is taught and written in salts, so the half that was
-- missing is the half a doctor reaches for most. Searching `composition`
-- without an index would be a sequential scan over 246k rows of text on
-- every keystroke, so the index comes first and the query follows.

-- Substring search on composition. GIN + trigram is what makes
-- `composition ILIKE '%paracetamol%'` an index scan instead of a table
-- scan. pg_trgm is already installed (phase 2 created it for `name`); the
-- IF NOT EXISTS keeps this migration safe on a database that has it.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Drug_composition_trgm_idx"
  ON "Drug" USING GIN ("composition" gin_trgm_ops);

-- A true prefix index for the commonest query of all.
--
-- The trigram index on `name` can serve a prefix, but it is built for
-- substrings and a trigram is three characters -- so a two-character
-- search has almost nothing selective to look up. A btree on the
-- lower-cased name with text_pattern_ops gives a plain range scan for
-- `lower(name) LIKE 'do%'`, which is the fastest shape available and
-- stays fast at two characters.
--
-- It only helps if the query is written as `lower(name) LIKE ...` rather
-- than `name ILIKE ...`, which is why the search route uses raw SQL
-- instead of Prisma's `mode: "insensitive"`. Prisma emits ILIKE, and
-- ILIKE cannot use this index.
CREATE INDEX IF NOT EXISTS "Drug_name_lower_prefix_idx"
  ON "Drug" (lower("name") text_pattern_ops);

-- Discontinued rows are excluded from every search, so let the planner
-- skip them rather than filter them out afterwards.
CREATE INDEX IF NOT EXISTS "Drug_active_name_idx"
  ON "Drug" (lower("name") text_pattern_ops)
  WHERE "isDiscontinued" = false;
