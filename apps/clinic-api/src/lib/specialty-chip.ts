import { prisma } from "./prisma.js";
import { gestationalAge } from "./specialty-forms.js";

/**
 * A one-line signal, next to a patient's name on the queue or in search, of
 * what they are open on: "ANC 32w", "Growth 18m", "INF cycle 8". Reception
 * would otherwise have to open each profile to see that Priya is here for
 * her antenatal check, and the doctor only finds out when the encounter
 * opens -- too late for the booking to have been labelled.
 *
 * `urgency` is the sort nudge: "due" for a visit that should happen this
 * week (term pregnancy, newborn first vaccine), "overdue" for anything
 * past that. Not a priority tier of its own -- triage still wins -- a
 * stable-sort tie-breaker inside the GENERAL tier only.
 */
export interface SpecialtyChip {
  key: string;
  short: string;
  episodeId: string;
  urgency: "due" | "overdue" | null;
}

/** The chip for one active episode, or null if nothing worth showing. */
export function chipFor(
  episode: { id: string; formKey: string; data: unknown; startedOn: Date },
  todayIso: string,
): SpecialtyChip | null {
  const data = (episode.data as Record<string, unknown>) ?? {};
  switch (episode.formKey) {
    case "pregnancy": {
      const ga = gestationalAge(todayIso, data);
      if (!ga) return { key: "pregnancy", short: "ANC", episodeId: episode.id, urgency: null };
      const urgency: SpecialtyChip["urgency"] = ga.weeks >= 40 ? "overdue" : ga.weeks >= 36 ? "due" : null;
      return { key: "pregnancy", short: `ANC ${ga.weeks}w`, episodeId: episode.id, urgency };
    }
    case "infertility": {
      const cycle = typeof data.cycle === "number" ? ` cycle ${data.cycle}` : "";
      return { key: "infertility", short: `IVF${cycle}`, episodeId: episode.id, urgency: null };
    }
    case "diabetes":
      return { key: "diabetes", short: "DM review", episodeId: episode.id, urgency: null };
    case "cardiac":
      return { key: "cardiac", short: "Cardiac", episodeId: episode.id, urgency: null };
    default: {
      // A custom episode gets a short label from the form key itself,
      // capitalised; still useful to show something rather than nothing.
      const short = episode.formKey.slice(0, 1).toUpperCase() + episode.formKey.slice(1);
      return { key: episode.formKey, short, episodeId: episode.id, urgency: null };
    }
  }
}

/**
 * Chips for many patients in one go. Returns a Map rather than a list so
 * the caller joins by patientId in the same shape it already has.
 * The query uses the (patientId, status) index on CareEpisode.
 */
export async function chipsForPatients(patientIds: readonly string[]): Promise<Map<string, SpecialtyChip>> {
  if (patientIds.length === 0) return new Map();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const episodes = await prisma.careEpisode.findMany({
    where: { patientId: { in: [...patientIds] }, status: "ACTIVE" },
    select: { id: true, patientId: true, formKey: true, data: true, startedOn: true },
    // Pregnancy is the most load-bearing episode to surface; otherwise the
    // most recently started one wins. With the index this is a single scan.
    orderBy: [{ startedOn: "desc" }],
  });
  const chosen = new Map<string, { id: string; formKey: string; data: unknown; startedOn: Date }>();
  for (const e of episodes) {
    const prior = chosen.get(e.patientId);
    // Prefer pregnancy over anything else -- a woman at 32 weeks is here
    // for her antenatal, not for her old diabetes review.
    if (!prior || (prior.formKey !== "pregnancy" && e.formKey === "pregnancy")) {
      chosen.set(e.patientId, e);
    }
  }
  const out = new Map<string, SpecialtyChip>();
  for (const [patientId, episode] of chosen) {
    const chip = chipFor(episode, today);
    if (chip) out.set(patientId, chip);
  }
  return out;
}
