/**
 * The clinic, as the assistant's engine sees it.
 *
 * The engine (engine.ts) knows nothing about this database. This file is
 * the whole of what it is told: which tests the clinic can order, what
 * this doctor usually writes, and how a medicine name is looked up.
 */

import { prisma } from "../prisma.js";
import type { AssistantHost, Habit } from "./engine.js";
import type { DrugCandidate } from "./checks.js";
import type { Frequency } from "./structure.js";

/** How far back a doctor's habits are read from. Recent enough to be
 *  what they write now, long enough to hold their whole usual range. */
const HABIT_ITEMS = 1500;
const HABIT_LIMIT = 60;

function mostCommon(values: string[]): string {
  const counts = new Map<string, number>();
  for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = "";
  let bestCount = 0;
  for (const [value, count] of counts) if (count > bestCount) { best = value; bestCount = count; }
  return best;
}

/**
 * What this doctor usually writes, read from their own prescriptions.
 *
 * Nothing is configured and nothing is typed in: the habits are simply
 * what the doctor has already done, so they are right from the first day
 * for anyone with a history here and empty for anyone without.
 */
export async function doctorHabits(doctorId: string): Promise<Habit[]> {
  const items = await prisma.prescriptionItem.findMany({
    where: { prescription: { doctorId } },
    select: { drugId: true, drugName: true, dosage: true, frequency: true, duration: true, drug: { select: { composition: true } } },
    orderBy: { prescription: { createdAt: "desc" } },
    take: HABIT_ITEMS,
  });

  const groups = new Map<string, typeof items>();
  for (const item of items) {
    const key = item.drugId ?? item.drugName.trim().toLowerCase();
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }

  return [...groups.values()]
    .map((group): Habit => ({
      drugId: group[0]!.drugId,
      drugName: group[0]!.drugName,
      composition: group[0]!.drug?.composition ?? null,
      dosage: mostCommon(group.map((g) => g.dosage)),
      frequency: mostCommon(group.map((g) => g.frequency)) as Frequency,
      duration: mostCommon(group.map((g) => g.duration)),
      count: group.length,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, HABIT_LIMIT);
}

function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * A medicine as it was said, against the catalogue.
 *
 * A name that starts with what was said comes first, shortest first:
 * "dolo 650" is "Dolo 650 Tablet", not "Dolonex DT". Only when nothing
 * starts that way is a spelling-tolerant match tried, and it is reported
 * as approximate so the screen can say so (see routes/clinic-drugs.ts for
 * why the catalogue's spellings make that necessary).
 */
export async function searchMedicine(spoken: string): Promise<{ hits: DrugCandidate[]; approximate: boolean }> {
  const said = spoken.toLowerCase().replace(/[^a-z0-9 .+-]/g, " ").replace(/\s+/g, " ").trim();
  if (said.length < 3) return { hits: [], approximate: false };

  const exact = await prisma.$queryRaw<DrugCandidate[]>`
    SELECT id, name, composition
    FROM "Drug"
    WHERE "isDiscontinued" = false AND lower(name) LIKE ${`${escapeLike(said)}%`}
    ORDER BY length(name), name
    LIMIT 5
  `;
  if (exact.length > 0) return { hits: exact, approximate: false };

  if (said.length < 4) return { hits: [], approximate: false };
  const near = await prisma.$queryRaw<DrugCandidate[]>`
    SELECT id, name, composition
    FROM "Drug"
    WHERE "isDiscontinued" = false AND ${said} <% name
    ORDER BY word_similarity(${said}, name) DESC, length(name), name
    LIMIT 5
  `;
  return { hits: near, approximate: near.length > 0 };
}

export function clinicHost(doctorId: string, habits?: Habit[]): AssistantHost {
  return {
    async labCatalogue() {
      const tests = await prisma.labTest.findMany({ select: { name: true }, orderBy: { name: "asc" } });
      return tests.map((t) => t.name);
    },
    async habits() {
      return habits ?? doctorHabits(doctorId);
    },
    searchMedicine,
  };
}
