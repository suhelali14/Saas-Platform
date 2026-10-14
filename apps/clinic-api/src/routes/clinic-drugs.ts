import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireClinicAuth, requireClinicalWriteAuth } from "../plugins/auth.js";

const createSchema = z.object({
  name: z.string().min(1).max(300),
  composition: z.string().max(500).optional(),
  manufacturer: z.string().max(300).optional(),
  packSize: z.string().max(200).optional(),
  type: z.string().max(100).optional(),
});

/** A row of the search result, matching what the autocomplete renders. */
interface DrugHit {
  id: string;
  name: string;
  composition: string | null;
  manufacturer: string | null;
  packSize: string | null;
  type: string | null;
  price: unknown;
  /** Why this row matched, so the UI can show the salt when that is why. */
  matchedOn: "name" | "composition";
  /**
   * True when this came from the spelling-tolerant pass rather than a
   * literal match. Surfaced, never hidden: a doctor who typed
   * "amoxicillin" and is being shown "Amoxycillin" should be told that
   * is a near match and not what they typed.
   */
  approximate?: boolean;
}

/**
 * A user's text, made safe to put inside a LIKE pattern.
 *
 * `%` and `_` are wildcards and a backslash is the escape character, so a
 * doctor typing "100%" would otherwise search for "100<anything>" and a
 * lone backslash would make Postgres raise. The string still travels as a
 * bound parameter -- this is about the pattern meaning what was typed,
 * not about injection.
 */
function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

const SEARCH_LIMIT = 20;

/**
 * Below this many literal matches, try the spelling-tolerant pass too.
 *
 * Set so the common query never pays for it: "dolo" and "paracetamol"
 * fill the list literally and stop here. It is the thin result -- which
 * is what a misspelling looks like -- that triggers the second query.
 */
const EXACT_ENOUGH = 8;

/**
 * Shortest query worth matching approximately.
 *
 * Trigram word-similarity on three characters matches a great deal of a
 * 246,000-row catalogue, and a list of near-misses is worse than a short
 * list of right answers.
 */
const MIN_FUZZY_LENGTH = 4;

export async function clinicDrugRoutes(app: FastifyInstance) {
  /**
   * Medicine autocomplete over the ~246,000-row Indian catalogue.
   *
   * ── What was wrong ───────────────────────────────────────────────────
   *
   * This searched `name` with a prefix match and nothing else. That finds
   * "Dolo 650 Tablet" from "dolo" -- the easy half. Measured against the
   * real catalogue, it found 2 rows for "paracetamol", while 17,528 rows
   * carry paracetamol in their composition; 3 for "amo" against 27,725.
   *
   * Indian prescribing is taught and written in salts, so the half that
   * was missing is the half a doctor reaches for most often.
   *
   * ── Why raw SQL ──────────────────────────────────────────────────────
   *
   * Each clause is written in the one form its index can serve, and
   * Prisma cannot express that:
   *
   *   lower(name) LIKE 'do%'          -> btree on lower(name)
   *   name ILIKE '%do%'               -> GIN trigram on name
   *   composition ILIKE '%para%'      -> GIN trigram on composition
   *
   * Prisma's `mode: "insensitive"` emits `name ILIKE 'do%'`, which cannot
   * use the btree at all. Three shapes, three indexes, one query.
   *
   * ── Ranking ──────────────────────────────────────────────────────────
   *
   * A name that STARTS with the query is almost always the intent, so it
   * comes first; then a name containing it; then a composition match.
   * Within a tier, shorter names first -- "Dolo 650 Tablet" is what
   * someone typing "dolo" wants, not "Dolonex DT 20mg Tablet".
   *
   * ── Why two characters behaves differently ───────────────────────────
   *
   * A trigram is three characters, so at two characters a trigram index
   * has nothing selective to look up and both substring clauses would
   * degrade into a scan of 246k rows on a keystroke. At two characters
   * this does the prefix only, which the btree answers as a range scan.
   * Two characters is also too vague for a salt to be a useful match.
   */
  app.get("/api/clinic/drugs", async (request, reply) => {
    const auth = requireClinicAuth(request, reply);
    if (!auth) return;

    const { search } = request.query as { search?: string };
    const q = (search ?? "").trim();
    if (q.length < 2) return { data: [] };

    const safe = escapeLike(q.toLowerCase());
    const prefix = `${safe}%`;
    const infix = `%${safe}%`;

    // Two characters: prefix only. See the note above.
    if (q.length < 3) {
      const rows = await prisma.$queryRaw<DrugHit[]>`
        SELECT id, name, composition, manufacturer, "packSize", type, price,
               'name' AS "matchedOn"
        FROM "Drug"
        WHERE "isDiscontinued" = false
          AND lower(name) LIKE ${prefix}
        ORDER BY length(name), name
        LIMIT ${SEARCH_LIMIT}
      `;
      return { data: rows };
    }

    const rows = await prisma.$queryRaw<DrugHit[]>`
      SELECT id, name, composition, manufacturer, "packSize", type, price,
             CASE WHEN lower(name) LIKE ${infix} THEN 'name' ELSE 'composition' END AS "matchedOn"
      FROM "Drug"
      WHERE "isDiscontinued" = false
        AND (
          lower(name) LIKE ${prefix}
          OR name ILIKE ${infix}
          OR composition ILIKE ${infix}
        )
      ORDER BY
        CASE
          WHEN lower(name) LIKE ${prefix} THEN 0
          WHEN name ILIKE ${infix} THEN 1
          ELSE 2
        END,
        length(name),
        name
      LIMIT ${SEARCH_LIMIT}
    `;

    if (rows.length >= EXACT_ENOUGH || q.length < MIN_FUZZY_LENGTH) {
      return { data: rows };
    }

    /**
     * Nothing much matched literally, so try the spelling.
     *
     * This is not a nicety. The catalogue is Indian data and uses Indian
     * and British spellings: it has 8,375 rows for "Amoxycillin" and
     * ZERO for "amoxicillin". A doctor typing the spelling they were
     * taught got an empty list and concluded the search was broken --
     * which is exactly what was reported.
     *
     * `<%` is pg_trgm's word-similarity operator: it asks whether the
     * query resembles some WORD inside the target, rather than the whole
     * string. That distinction matters here because a composition is a
     * long list -- "Amoxycillin (200mg), Clavulanic Acid (28mg)" -- and
     * whole-string similarity against one salt name in it is near zero.
     * Measured: word_similarity('amoxicillin', 'Amoxycillin (500mg)')
     * is 0.60.
     *
     * The threshold is Postgres's own default (0.6) and is deliberately
     * left alone. Lowering it needs a per-session GUC, which is not safe
     * to set through a connection pooler, and would trade these right
     * answers for a longer list of near-misses on a screen where the
     * wrong medicine is the worst possible outcome.
     */
    const approximate = await prisma.$queryRaw<DrugHit[]>`
      SELECT id, name, composition, manufacturer, "packSize", type, price,
             CASE WHEN ${safe} <% name THEN 'name' ELSE 'composition' END AS "matchedOn"
      FROM "Drug"
      WHERE "isDiscontinued" = false
        AND (${safe} <% name OR ${safe} <% composition)
      ORDER BY
        GREATEST(
          word_similarity(${safe}, name),
          word_similarity(${safe}, coalesce(composition, ''))
        ) DESC,
        length(name),
        name
      LIMIT ${SEARCH_LIMIT}
    `;

    // Literal matches keep their place at the top; near matches fill the
    // rest, flagged, and never displace something the doctor actually
    // typed.
    const seen = new Set(rows.map((r) => r.id));
    for (const hit of approximate) {
      if (rows.length >= SEARCH_LIMIT) break;
      if (seen.has(hit.id)) continue;
      seen.add(hit.id);
      rows.push({ ...hit, approximate: true });
    }

    return { data: rows };
  });

  // "If new medicine there we can add that" -- a doctor who searches and
  // finds nothing can add it here, immediately available for future
  // autocomplete. Doctor/admin only, same clinical-content gate as
  // prescriptions/case-sheets/certificates.
  app.post("/api/clinic/drugs", async (request, reply) => {
    const auth = requireClinicalWriteAuth(request, reply);
    if (!auth) return;

    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const existing = await prisma.drug.findFirst({ where: { name: { equals: parsed.data.name, mode: "insensitive" } } });
    if (existing) return reply.status(200).send(existing);

    const drug = await prisma.drug.create({ data: { ...parsed.data, addedManually: true } });
    return reply.status(201).send(drug);
  });
}
