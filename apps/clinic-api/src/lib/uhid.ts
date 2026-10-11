import { prisma } from "./prisma.js";
import { resolvedSchema } from "./db-schema.js";

const DEFAULT_CODE = "PT";
const SCHEMA = resolvedSchema();

/**
 * Generates the next unique patient file number ("UHID" in real hospital
 * software -- see the plan's research). Uses a real Postgres SEQUENCE
 * (created in the phase2 migration) rather than a `count()+1` in application
 * code, which would race under two simultaneous reception-desk
 * registrations -- `nextval()` is atomic and collision-proof under concurrency.
 */
export async function generatePatientUhid(): Promise<string> {
  const clinic = await prisma.clinic.findFirst({ select: { code: true } });
  const code = clinic?.code?.trim() || DEFAULT_CODE;

  // Identifier interpolation, not a parameter -- $queryRaw can't bind
  // identifiers. Safe here: SCHEMA comes only from this deployment's own
  // trusted DATABASE_URL, never from a request.
  const rows = await prisma.$queryRawUnsafe<{ nextval: bigint }[]>(
    `SELECT nextval('"${SCHEMA}"."patient_uhid_seq"')`,
  );
  const next = rows[0];
  if (!next) throw new Error("Failed to generate patient UHID -- sequence returned no rows");
  return `${code}-${next.nextval.toString().padStart(5, "0")}`;
}
