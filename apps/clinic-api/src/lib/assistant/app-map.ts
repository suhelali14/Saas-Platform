/**
 * What the app is, read from the app.
 *
 * ── Why the assistant is given a map ─────────────────────────────────
 *
 * A person who has worked in a clinic for a year knows that a
 * prescription belongs to a visit and a visit to a patient, that a lab
 * order has tests on it and a bill has payments. They were not told this
 * as a list of rules; they know how the place is put together, and so
 * they understand a request nobody has made before.
 *
 * The assistant is given the same thing, and it is not written by hand.
 * It is read from the two places that already define the app:
 *
 *   the data model   every kind of record and what each belongs to,
 *                    from the database schema itself (Prisma's own
 *                    description of it)
 *   the routes       everything the server can be asked to do, noted as
 *                    each route is registered (declare.ts)
 *
 * A table added next month, or a route, is in the map the next time the
 * server starts. Nobody has to remember to describe it.
 *
 * ── What the map is used for ─────────────────────────────────────────
 *
 *   understanding   the model reads how the records fit together
 *   honesty         "does the app do that?" is answered from what it is,
 *                   not from what somebody remembered to list
 *   coverage        which parts of the app can be worked by voice, and
 *                   which cannot yet (scripts/assistant-coverage.mjs)
 *
 * It is a map of structure only: names of record types and how they
 * join. No record's contents are in it.
 */

// The clinic's own generated client: the workspace also holds another
// product's, and `@prisma/client` resolves to that one.
import { Prisma } from "../../generated/prisma-client/index.js";

export interface Entity {
  name: string;
  /** What it holds, by field name. */
  fields: string[];
  /** What it belongs to, or has many of. */
  joins: { to: string; many: boolean }[];
}

/** Records that are plumbing, and would only crowd the map. */
const PLUMBING = /^(?:AuditLog|RecordRevision|ScribeSession|Translation|.*Session|.*Token|.*Counter|IdSequence)$/i;
/** Fields every record has, which say nothing about it. */
const EVERYWHERE = new Set(["id", "createdAt", "updatedAt"]);

/** Every kind of record the app keeps, and how they join. */
export function entities(): Entity[] {
  return Prisma.dmmf.datamodel.models
    .filter((model) => !PLUMBING.test(model.name))
    .map((model) => ({
      name: model.name,
      fields: model.fields.filter((f) => f.kind !== "object" && !EVERYWHERE.has(f.name) && !/Id$|Path$|Hash$|Mime$/.test(f.name)).map((f) => f.name),
      joins: model.fields.filter((f) => f.kind === "object").map((f) => ({ to: f.type, many: f.isList })),
    }));
}

/** "CaseSheet" -> "case sheet". */
function inWords(name: string): string {
  return name.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
}

let written: string | null = null;

/**
 * The data model in a few hundred words, for the model to read once and
 * the provider to cache: what each record holds and what it belongs to.
 */
export function appInWords(): string {
  if (written !== null) return written;
  const lines = entities().map((entity) => {
    const owns = entity.joins.filter((j) => j.many).map((j) => inWords(j.to) + "s");
    const within = entity.joins.filter((j) => !j.many).map((j) => inWords(j.to));
    const parts = [
      entity.fields.slice(0, 9).join(", "),
      within.length ? `belongs to: ${[...new Set(within)].join(", ")}` : "",
      owns.length ? `has: ${[...new Set(owns)].slice(0, 8).join(", ")}` : "",
    ].filter(Boolean);
    return `- ${inWords(entity.name)} (${parts.join("; ")})`;
  });
  written = `How this clinic's software is put together. Each line is one kind of record, what it holds, and what it joins to:\n${lines.join("\n")}`;
  return written;
}

// ── Every route the server has, noted as it is registered ─────────────

export interface SeenRoute {
  method: string;
  url: string;
  /** It told the assistant about itself (declare.ts). */
  told: string | null;
  /** It said the assistant should leave it alone. */
  optedOut: boolean;
}

const seen: SeenRoute[] = [];

export function noteRoute(route: SeenRoute): void {
  const at = seen.findIndex((r) => r.method === route.method && r.url === route.url);
  if (at >= 0) seen[at] = route; else seen.push(route);
}

export function routesSeen(): SeenRoute[] {
  return seen;
}

/** The parts of the app, by the first word of their address. */
export function areas(): { area: string; routes: number; byVoice: number }[] {
  const out = new Map<string, { routes: number; byVoice: number }>();
  for (const route of seen) {
    const area = route.url.replace(/^\/api\/clinic\//, "").split("/")[0] ?? "";
    if (!area || area === "public" || area === "auth" || area === "assistant" || area === "scribe") continue;
    const row = out.get(area) ?? { routes: 0, byVoice: 0 };
    row.routes += 1;
    if (route.told) row.byVoice += 1;
    out.set(area, row);
  }
  return [...out.entries()].map(([area, row]) => ({ area, ...row })).sort((a, b) => a.area.localeCompare(b.area));
}
