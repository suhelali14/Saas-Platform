-- How the public page looks, beyond which sections are on.
--
-- The typeface, the hero's shape, the spacing, the corners, and what the
-- main button says and does. Nullable, so a clinic that has never
-- touched any of it resolves to the defaults -- which are the layout it
-- is already being served, so nothing changes until somebody chooses to
-- change it.
ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "publicDesign" JSONB;
