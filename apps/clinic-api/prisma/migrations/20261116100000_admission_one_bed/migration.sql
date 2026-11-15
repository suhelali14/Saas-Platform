-- One admitted patient per bed, and one open stay per patient.
--
-- The admit and transfer routes check both, but a check is a read: two
-- desks admitting at the same moment both see the bed free and both
-- commit. These make the database refuse the second, and the routes answer
-- that refusal as "that bed has just been taken".
--
-- Partial indexes, which schema.prisma cannot express. A future
-- `prisma migrate diff` will offer to DROP them; strip those lines, as for
-- the other hand-made indexes.
CREATE UNIQUE INDEX IF NOT EXISTS "Admission_one_per_bed"
  ON "Admission" ("bedId")
  WHERE "status" = 'ADMITTED' AND "bedId" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Admission_one_open_per_patient"
  ON "Admission" ("patientId")
  WHERE "status" = 'ADMITTED';
