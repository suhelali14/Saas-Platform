import { prisma } from "./prisma.js";

/**
 * Finding and merging the same person registered twice.
 *
 * This happens constantly and for mundane reasons: a patient gives their
 * name differently ("Ramesh Kumar" / "R. Kumar"), reception mistypes a
 * digit of the phone, or somebody registers a walk-in who turns out to
 * have been here two years ago. The result is a split history — half the
 * case sheets under one record, half under another — and a doctor who
 * sees neither half as complete.
 *
 * ── Matching ─────────────────────────────────────────────────────────
 *
 * ONC's guidance for patient matching names the fields to compare: name,
 * date of birth, address, phone and sex. This scores on those, weighted
 * by how much each one actually distinguishes two people:
 *
 * - An exact phone match is the strongest single signal in this context.
 *   Indian families do share a number, which is why it is never enough
 *   on its own — a mother and daughter on one phone must not be merged.
 * - A name match carries most of the rest, compared after normalising
 *   for the things that differ without meaning anything: case, initials,
 *   honorifics, and word order ("Kumar Ramesh").
 * - Date of birth, when both have one, is close to decisive. Disagreeing
 *   dates of birth are strong evidence these are different people, so a
 *   mismatch subtracts rather than merely failing to add.
 *
 * ── Suggested, never automatic ───────────────────────────────────────
 *
 * Nothing merges itself. A master patient index typically queues
 * uncertain pairs for human review, and that is the right shape here for
 * a much blunter reason: a wrong merge is irreversible and mixes two
 * people's medical histories. A false positive is a clinical risk, so
 * the system's job is to surface candidates and let a person decide.
 */

export type DuplicateCandidate = {
  id: string;
  uhid: string;
  name: string;
  phone: string | null;
  dob: Date | null;
  age: number | null;
  gender: string | null;
  address: string | null;
  createdAt: Date;
  /** Visit count, so the operator can tell which record is the real one. */
  visits: number;
  lastSeen: Date | null;
  /** 0-100. Above 80 is near-certain; 50-80 wants a look. */
  score: number;
  /** Why it matched, in words, so the decision is informed. */
  reasons: string[];
};

/** Digits only. Formatting, country codes and spaces are noise. */
function normalisePhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  // Indian mobiles are ten digits; a leading 0 or 91 is the same number.
  return digits.length > 10 ? digits.slice(-10) : digits;
}

/**
 * A name reduced to what actually identifies a person.
 *
 * Honorifics, punctuation and case all vary between two registrations of
 * the same human and mean nothing. Word order varies too -- "Kumar
 * Ramesh" and "Ramesh Kumar" are one person at an Indian front desk --
 * so the tokens are sorted.
 */
function normaliseName(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/\b(dr|mr|mrs|ms|miss|master|smt|shri|sri|baby|b\/o|s\/o|d\/o|w\/o)\b\.?/g, " ")
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 0)
    .sort();
}

/**
 * How two names compare, as the three facts that actually decide it.
 *
 * A single ratio cannot separate the cases that matter. "Sunita Patil"
 * and "Priya Patil" share one of two tokens, as do "Ramesh Kumar" and
 * "Ramesh Shyam Kumar" relative to the longer name -- but the first pair
 * is a mother and daughter on one phone and the second is one person
 * registered twice. What distinguishes them is *which* tokens matched
 * and whether the shorter name was fully accounted for.
 *
 * Token-based rather than string distance, because the differences here
 * are whole words: a dropped surname, an added middle name, an initial
 * standing in for a given name.
 */
function compareNames(a: string, b: string): {
  /** The same person's name, once honorifics, case and order are gone. */
  exact: boolean;
  /** Every part of the shorter name appears in the longer one, and the
   *  shorter name has at least two parts. An added middle name. */
  containsAll: boolean;
  /** How many parts matched, counting an initial as nearly a match. */
  matched: number;
  /** Parts in the shorter of the two names. */
  shorterLength: number;
} {
  const ta = normaliseName(a);
  const tb = normaliseName(b);
  if (!ta.length || !tb.length) {
    return { exact: false, containsAll: false, matched: 0, shorterLength: 0 };
  }

  const exact = ta.length === tb.length && ta.every((t, i) => t === tb[i]);

  const [shorter, longer] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  const pool = longer.slice();
  let matched = 0;

  for (const token of shorter) {
    const hit = pool.indexOf(token);
    if (hit >= 0) {
      pool.splice(hit, 1);
      matched += 1;
      continue;
    }
    // A single letter standing in for a full name: "R." for "Ramesh".
    // Counted as nearly a match, not a full one, because it genuinely is
    // weaker evidence -- but "R. Kumar" beside an exact surname is not
    // ambiguous in practice.
    const initial = pool.findIndex(
      (p) => (token.length === 1 && p.startsWith(token)) || (p.length === 1 && token.startsWith(p)),
    );
    if (initial >= 0) {
      pool.splice(initial, 1);
      matched += 0.85;
    }
  }

  // The 0.3 tolerance is there so one initial does not disqualify an
  // otherwise complete match.
  const containsAll = shorter.length >= 2 && matched >= shorter.length - 0.3;

  return { exact, containsAll, matched, shorterLength: shorter.length };
}

function sameDay(a: Date | null, b: Date | null): boolean | null {
  if (!a || !b) return null;
  return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
}

/**
 * Scores one pair. Returns null when they are clearly different people.
 *
 * Exported so the thresholds can be exercised directly against named
 * cases rather than inferred from whatever the database happens to hold.
 */
export function scorePair(
  a: { name: string; phone?: string | null; dob?: Date | null; age?: number | null; gender?: string | null; address?: string | null },
  b: { name: string; phone?: string | null; dob?: Date | null; age?: number | null; gender?: string | null; address?: string | null },
): { score: number; reasons: string[] } | null {
  const reasons: string[] = [];
  let score = 0;

  const phoneA = normalisePhone(a.phone);
  const phoneB = normalisePhone(b.phone);
  const phoneMatch = phoneA.length >= 10 && phoneA === phoneB;

  const names = compareNames(a.name, b.name);
  // What counts as the same name. One shared token between multi-part
  // names does NOT -- that is a family surname, and treating it as a
  // name match is what offered a mother and daughter for merge.
  const nameMatch = names.exact || names.containsAll || names.matched >= 2;

  // Different sexes recorded is strong evidence of two people. Checked
  // before anything is added, because no amount of name similarity
  // should outvote it.
  if (a.gender && b.gender && a.gender.toLowerCase() !== b.gender.toLowerCase()) {
    return null;
  }

  const dobSame = sameDay(a.dob ?? null, b.dob ?? null);
  if (dobSame === false) {
    // Two recorded, disagreeing dates of birth. Families share phones
    // and names; they do not share a birthday.
    return null;
  }

  if (phoneMatch) {
    score += 45;
    reasons.push("same phone number");
  }

  if (names.exact) {
    // On its own this lands exactly on the surfacing threshold: two
    // patients with the same name and nothing else recorded are worth a
    // look, and no more than that.
    score += 50;
    reasons.push("identical name");
  } else if (names.containsAll) {
    score += 42;
    reasons.push("same name with an extra part");
  } else if (names.matched >= 2) {
    score += 34;
    reasons.push("most of the name matches");
  } else if (names.matched > 0) {
    // A shared surname. Recorded as weak corroboration, never as a
    // name match.
    score += 8;
  }

  if (dobSame === true) {
    // As conclusive as a shared phone, and arguably more so: families
    // share phone numbers, and they do not share birthdays.
    score += 40;
    reasons.push("same date of birth");
  } else if (a.age != null && b.age != null && Math.abs(a.age - b.age) <= 1) {
    // Ages are entered as a number at the desk and drift by a year as
    // time passes, so a near match is corroboration, not proof.
    score += 8;
    reasons.push("same age");
  }

  if (a.address && b.address && a.address.trim().toLowerCase() === b.address.trim().toLowerCase()) {
    score += 10;
    reasons.push("same address");
  }

  // A shared phone with a name that does not match is a family, not a
  // duplicate -- and it is the single most likely false positive here.
  // Rejected outright rather than scored low, because the cost of
  // getting this one wrong is two people's histories merged.
  if (phoneMatch && !nameMatch) return null;

  // And a name that merely resembles another, with nothing else in
  // agreement, is two different people who share a surname.
  if (!phoneMatch && dobSame !== true && !nameMatch) return null;

  return { score: Math.min(100, score), reasons };
}

/** Likely duplicates of one patient, best first. */
/** The details of a person, whether or not they are a row yet. */
export type PersonDetails = {
  name: string;
  phone?: string | null;
  dob?: Date | null;
  age?: number | null;
  gender?: string | null;
  address?: string | null;
};

/**
 * Above this, two records are the same person beyond reasonable doubt.
 *
 * Only reached by an exact phone match together with a real name match, or
 * by a matching date of birth -- see scorePair. It is the threshold the
 * booking flow is allowed to act on without asking, and it is exported so
 * that the one place which auto-links and the UI that explains it cannot
 * drift to different numbers.
 */
export const NEAR_CERTAIN_SCORE = 85;

/**
 * Candidates for a person who may not exist in the database yet.
 *
 * `findDuplicatesOf` needs a patient id, which an online booking request
 * does not have -- that is the whole problem, since the request is about to
 * become a patient and should not if they already are one.
 */
export async function findDuplicatesForDetails(
  person: PersonDetails,
  options: { excludePatientId?: string } = {},
): Promise<DuplicateCandidate[]> {
  const phone = normalisePhone(person.phone);
  const nameTokens = normaliseName(person.name);
  if (phone.length < 10 && nameTokens.length === 0) return [];

  // Narrowed in the database before scoring in memory. Scoring every
  // patient against every other is fine at a few thousand rows and not
  // at fifty thousand, and a clinic that grows should not discover that
  // the hard way.
  const candidates = await prisma.patient.findMany({
    where: {
      ...(options.excludePatientId ? { id: { not: options.excludePatientId } } : {}),
      mergedIntoId: null,
      OR: [
        ...(phone.length >= 10 ? [{ phone: { contains: phone } }] : []),
        // Any single name token, which is a wide net on purpose: the
        // scoring decides, and missing a real duplicate is worse than
        // examining a few extra rows.
        ...nameTokens
          .filter((t) => t.length >= 3)
          .map((t) => ({ name: { contains: t, mode: "insensitive" as const } })),
      ],
    },
    take: 200,
  });

  const out: DuplicateCandidate[] = [];
  for (const c of candidates) {
    const scored = scorePair(person, c);
    if (!scored || scored.score < 50) continue;

    const [visits, last] = await Promise.all([
      prisma.appointment.count({ where: { patientId: c.id } }),
      prisma.appointment.findFirst({
        where: { patientId: c.id },
        orderBy: { scheduledAt: "desc" },
        select: { scheduledAt: true },
      }),
    ]);

    out.push({
      id: c.id, uhid: c.uhid, name: c.name, phone: c.phone, dob: c.dob,
      age: c.age, gender: c.gender, address: c.address, createdAt: c.createdAt,
      visits, lastSeen: last?.scheduledAt ?? null,
      score: scored.score, reasons: scored.reasons,
    });
  }

  return out.sort((a, b) => b.score - a.score);
}

export async function findDuplicatesOf(patientId: string): Promise<DuplicateCandidate[]> {
  const target = await prisma.patient.findUnique({ where: { id: patientId } });
  if (!target) return [];
  return findDuplicatesForDetails(target, { excludePatientId: patientId });
}

export type MergeResult = {
  survivingId: string;
  mergedId: string;
  moved: Record<string, number>;
  filledFields: string[];
};

/**
 * Moves everything from the duplicate onto the surviving record.
 *
 * Irreversible, and the UI says so before calling this. There is no undo
 * because there is no way to know afterwards which case sheet came from
 * which record once they are interleaved — and a half-undone merge would
 * be worse than either state.
 *
 * The duplicate row is kept, pointing at the survivor. A prescription
 * printed last year carries its UHID and somebody will arrive holding
 * it, so that number has to keep resolving. Retaining the old record is
 * also what the industry guidance recommends.
 */
export async function mergePatients(
  survivingId: string,
  duplicateId: string,
  actorId: string,
): Promise<MergeResult> {
  if (survivingId === duplicateId) {
    throw new Error("A patient cannot be merged into themselves.");
  }

  const [surviving, duplicate] = await Promise.all([
    prisma.patient.findUnique({ where: { id: survivingId } }),
    prisma.patient.findUnique({ where: { id: duplicateId } }),
  ]);
  if (!surviving) throw new Error("The patient to keep no longer exists.");
  if (!duplicate) throw new Error("The duplicate no longer exists.");
  if (duplicate.mergedIntoId) throw new Error(`${duplicate.uhid} has already been merged.`);
  if (surviving.mergedIntoId) {
    throw new Error(`${surviving.uhid} is itself a merged record -- merge into the record it points at instead.`);
  }

  // One transaction. A merge that moved the case sheets and then failed
  // before the prescriptions would leave a patient's history split
  // across two records with no sign of which, which is worse than the
  // duplicate it was fixing.
  return prisma.$transaction(async (tx) => {
    const moved: Record<string, number> = {};
    const move = async (
      label: string,
      fn: (where: { patientId: string }, data: { patientId: string }) => Promise<{ count: number }>,
    ) => {
      const { count } = await fn({ patientId: duplicateId }, { patientId: survivingId });
      if (count) moved[label] = count;
    };

    await move("appointments", (where, data) => tx.appointment.updateMany({ where, data }));
    await move("case sheets", (where, data) => tx.caseSheet.updateMany({ where, data }));
    await move("prescriptions", (where, data) => tx.prescription.updateMany({ where, data }));
    await move("certificates", (where, data) => tx.certificate.updateMany({ where, data }));
    await move("invoices", (where, data) => tx.invoice.updateMany({ where, data }));
    await move("lab orders", (where, data) => tx.labOrder.updateMany({ where, data }));

    // Fill blanks on the survivor from the duplicate, and only blanks.
    // Overwriting is not the system's call: the operator chose which
    // record to keep, so its values win.
    const fillable = [
      "phone", "email", "address", "bloodGroup", "gender", "referredBy",
      "emergencyContactName", "emergencyContactPhone", "emergencyContactRelation",
      "insuranceProvider", "insurancePolicyNumber",
    ] as const;

    const data: Record<string, unknown> = {};
    const filledFields: string[] = [];
    for (const field of fillable) {
      const mine = (surviving as Record<string, unknown>)[field];
      const theirs = (duplicate as Record<string, unknown>)[field];
      if ((mine === null || mine === undefined || mine === "") && theirs) {
        data[field] = theirs;
        filledFields.push(field);
      }
    }
    if (!surviving.dob && duplicate.dob) { data.dob = duplicate.dob; filledFields.push("dob"); }
    if (surviving.age == null && duplicate.age != null) { data.age = duplicate.age; filledFields.push("age"); }

    // Allergies and chronic conditions are appended, never replaced or
    // dropped. Losing "penicillin" because the surviving record happened
    // to have its own allergy field filled is the one outcome this must
    // not produce.
    for (const field of ["allergies", "chronicConditions"] as const) {
      const mine = (surviving[field] ?? "").trim();
      const theirs = (duplicate[field] ?? "").trim();
      if (!theirs) continue;
      if (!mine) {
        data[field] = theirs;
        filledFields.push(field);
      } else if (mine.toLowerCase() !== theirs.toLowerCase() && !mine.toLowerCase().includes(theirs.toLowerCase())) {
        data[field] = `${mine}; ${theirs}`;
        filledFields.push(`${field} (combined)`);
      }
    }

    if (Object.keys(data).length) {
      await tx.patient.update({ where: { id: survivingId }, data });
    }

    await tx.patient.update({
      where: { id: duplicateId },
      data: { mergedIntoId: survivingId, mergedAt: new Date(), mergedById: actorId },
    });

    return { survivingId, mergedId: duplicateId, moved, filledFields };
  });
}
