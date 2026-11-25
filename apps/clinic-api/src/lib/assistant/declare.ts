/**
 * A feature tells the assistant about itself.
 *
 * ── The problem this solves ──────────────────────────────────────────
 *
 * Every thing the assistant could do was written twice: once as the
 * feature (a route, with its validation and its role check), and once
 * more as an entry in the assistant's list (actions.ts) describing that
 * route to it. A feature added without the second half simply did not
 * exist as far as the assistant knew, and nothing said so.
 *
 * So the second half moves to where the first is. A route that should be
 * usable by voice says so in its own registration:
 *
 *   app.post("/api/clinic/service-items", {
 *     config: { assistant: told({
 *       summary: "Adds a service or procedure to the clinic's price list.",
 *       asks: z.object({ name: z.string(), price: z.number() }),
 *       toBody: (a) => ({ name: a.name, defaultPrice: a.price, category: "PROCEDURE" }),
 *       title: (a) => `Add "${a.name}" to the price list at ₹${a.price}?`,
 *     }) },
 *   }, handler);
 *
 * and that is the whole of it. When the server starts, every route is
 * looked at as it is registered (Fastify's onRoute hook); one that
 * carries `assistant` becomes an action, with its parameters read off
 * the schema it gave. Nothing in the assistant's own files is touched.
 *
 * ── What is generated, and what is not ───────────────────────────────
 *
 * Generated: the tool the model is offered (name, description,
 * parameters), the card that asks for a yes, the call to the route, and
 * the words for what the route answered.
 *
 * Not generated: permission. The route decides that, as it always has.
 * The assistant calls it as the person who asked, so a receptionist
 * reaching a doctor's route through the assistant is refused by that
 * route in that route's words. `roles` here only keeps the tool off the
 * list of somebody who could never use it.
 *
 * And a change still waits for a yes. A feature cannot declare its way
 * past the card.
 */

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { summarize } from "../../routes/clinic-billing.js";
import type { Feature } from "../../config/features.js";
import { sorry, type Action, type ActionContext, type Asker, type Line, type Reply } from "./registry.js";

type Call = (method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", url: string, payload?: unknown) => Promise<{ status: number; body: any }>;

/**
 * Something in the route's address that the person does not say and the
 * assistant works out: whose file, which visit, which bill, or a thing
 * found by the name it was called.
 */
export type Bound =
  | "patient"
  | "visit"
  /** The bill of the visit that is open, or the patient's unpaid one. */
  | "bill"
  /** Found by name from one of the fields asked for. */
  | { find: "medicine" | "service"; from: string };

export interface Told<A extends z.ZodRawShape = z.ZodRawShape> {
  /** One sentence, as it would be explained to a new member of staff,
   *  with a few of the ways people ask for it. */
  summary: string;
  /** What the assistant needs to be told. Describe each field
   *  (`.describe(...)`): the description is what the model reads. */
  asks: z.ZodObject<A>;
  /** Turns what was asked for into what the route takes. Left out, the
   *  route is sent what was asked for as it is. */
  toBody?: (asked: z.infer<z.ZodObject<A>>, about: { today: Date; patientId: string | null; appointmentId: string | null }) => Record<string, unknown>;
  /** The parts of the address filled in by code: `{ id: "patient" }`. */
  bind?: Record<string, Bound>;
  /** The question on the card. */
  title: (asked: z.infer<z.ZodObject<A>>, about: { patient?: string; found: Record<string, string> }) => string;
  /** What to say once it is done, from what the route answered. */
  done?: (result: any, asked: z.infer<z.ZodObject<A>>) => string;
  /** What each field is called on the card. Left out, its own name is tidied up. */
  labels?: Partial<Record<keyof A & string, string>>;
  /** Kept off the list of anybody not in these roles (admins always may). */
  roles?: string[];
  adminOnly?: boolean;
  module?: Feature;
  /** A name for the tool. Left out, one is made from the address. */
  name?: string;
  /** Where to offer to take them afterwards. */
  screen?: string;
}

/** Only for the types: lets a route write `told({...})` and have its
 *  `title` and `toBody` checked against its own `asks`. */
export function told<A extends z.ZodRawShape>(spec: Told<A>): Told {
  return spec as unknown as Told;
}

declare module "fastify" {
  interface FastifyContextConfig {
    /** Makes this route something the assistant can be asked for. */
    assistant?: Told;
  }
}

// ── A schema, as the model is shown it ────────────────────────────────

/** The part of zod this needs, turned into JSON Schema. */
export function jsonSchemaOf(schema: z.ZodTypeAny): Record<string, unknown> {
  const def = (schema as { _def: any })._def;
  const described = schema.description ? { description: schema.description } : {};
  switch (def.typeName) {
    case "ZodOptional":
    case "ZodNullable":
    case "ZodDefault":
      return { ...jsonSchemaOf(def.innerType), ...described };
    case "ZodEffects":
      return { ...jsonSchemaOf(def.schema), ...described };
    case "ZodString": return { type: "string", ...described };
    case "ZodNumber": return { type: def.checks?.some((c: { kind: string }) => c.kind === "int") ? "integer" : "number", ...described };
    case "ZodBoolean": return { type: "boolean", ...described };
    case "ZodEnum": return { type: "string", enum: [...def.values], ...described };
    case "ZodNativeEnum": return { type: "string", enum: Object.values(def.values).filter((v) => typeof v === "string"), ...described };
    case "ZodArray": return { type: "array", items: jsonSchemaOf(def.type), ...described };
    case "ZodObject": {
      const shape = (schema as z.ZodObject<z.ZodRawShape>).shape;
      const required = Object.entries(shape).filter(([, v]) => !isOptional(v as z.ZodTypeAny)).map(([k]) => k);
      return { type: "object", additionalProperties: false, properties: Object.fromEntries(Object.entries(shape).map(([k, v]) => [k, jsonSchemaOf(v as z.ZodTypeAny)])), required, ...described };
    }
    default: return { type: "string", ...described };
  }
}

function isOptional(schema: z.ZodTypeAny): boolean {
  const name = (schema as { _def: { typeName: string } })._def.typeName;
  return name === "ZodOptional" || name === "ZodNullable" || name === "ZodDefault";
}

/** "defaultPrice" -> "Default price". */
function labelOf(key: string): string {
  const spaced = key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function shown(value: unknown): string {
  if (typeof value === "number") return value.toLocaleString("en-IN");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.map(shown).join(", ");
  return String(value);
}

/** "POST /api/clinic/service-items" -> "add_service_items". */
function nameFrom(method: string, url: string): string {
  const verb = ({ POST: "add", PUT: "change", PATCH: "change", DELETE: "remove", GET: "show" } as Record<string, string>)[method] ?? "do";
  const words = url.replace(/^\/api\/clinic\//, "").split("/").filter((part) => part && !part.startsWith(":")).join("_").replace(/[^a-z0-9_]/gi, "_");
  return `${verb}_${words}`.toLowerCase().slice(0, 60);
}

// ── What the address needs, found ─────────────────────────────────────

/**
 * The things a name could mean, the likeliest first.
 *
 * A medicine catalogue holds every brand of a salt, so "Metformin 500"
 * matches dozens. What somebody means is nearly always the one whose
 * name BEGINS with what they said, or the one this clinic already keeps
 * on its shelf; those come first, and when exactly one of them stands
 * out it is taken without asking.
 */
async function find(what: "medicine" | "service", said: string): Promise<{ id: string; name: string; sure: boolean }[]> {
  const words = said.split(/\s+/).filter((w) => w.length > 1);
  if (words.length === 0) return [];
  const where = { AND: words.map((w) => ({ name: { contains: w, mode: "insensitive" as const } })) };
  const key = said.trim().toLowerCase();
  if (what === "service") {
    const items = await prisma.serviceItem.findMany({ where: { ...where, isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" }, take: 40 });
    const exact = items.filter((i) => i.name.toLowerCase() === key);
    return (exact.length === 1 ? exact : items).slice(0, 6).map((i) => ({ ...i, sure: exact.length === 1 || items.length === 1 }));
  }
  const drugs = await prisma.drug.findMany({ where, select: { id: true, name: true, _count: { select: { batches: true } } }, orderBy: { name: "asc" }, take: 60 });
  const begins = drugs.filter((d) => d.name.toLowerCase().startsWith(key));
  const stocked = drugs.filter((d) => d._count.batches > 0);
  const one = drugs.length === 1 ? drugs[0] : begins.length === 1 ? begins[0] : stocked.length === 1 ? stocked[0] : begins.filter((d) => d._count.batches > 0).length === 1 ? begins.find((d) => d._count.batches > 0) : undefined;
  if (one) return [{ id: one.id, name: one.name, sure: true }];
  const ranked = [...new Set([...begins.filter((d) => d._count.batches > 0), ...stocked, ...begins, ...drugs])];
  return ranked.slice(0, 6).map((d) => ({ id: d.id, name: d.name, sure: false }));
}

async function billOf(context: ActionContext): Promise<string | null> {
  if (context.appointmentId) {
    const bill = await prisma.invoice.findFirst({ where: { appointmentId: context.appointmentId }, select: { id: true }, orderBy: { createdAt: "desc" } });
    if (bill) return bill.id;
  }
  if (!context.patientId) return null;
  const bills = await prisma.invoice.findMany({ where: { patientId: context.patientId }, include: { items: true, payments: true }, orderBy: { createdAt: "desc" }, take: 20 });
  return bills.find((b) => summarize(b.items, b.payments, b).balance > 0)?.id ?? null;
}

// ── A route that told, as an action ───────────────────────────────────

const PATH = "__path";

function actionFrom(method: string, url: string, spec: Told): Action {
  const name = spec.name ?? nameFrom(method, url);
  const bind = spec.bind ?? {};
  const aboutPatient = Object.values(bind).some((b) => b === "patient" || b === "visit" || b === "bill");
  const allowed = (asker: Asker) => asker.isAdmin || asker.role === "ADMIN" || (!spec.adminOnly && (!spec.roles || spec.roles.includes(asker.role)));
  // What was asked for, plus the address as it was settled when the card
  // was drawn up. The card is sealed over both, so what is confirmed is
  // exactly what was shown.
  const schema = spec.asks.extend({ [PATH]: z.record(z.string()).optional() });

  /** The address filled in, or the reply that says what is missing. */
  async function settle(context: ActionContext, asked: Record<string, unknown>): Promise<{ path: Record<string, string>; found: Record<string, string> } | { reply: Reply }> {
    const path: Record<string, string> = {};
    const found: Record<string, string> = {};
    for (const [key, how] of Object.entries(bind)) {
      if (how === "patient") {
        if (!context.patientId) return { reply: sorry("Open a patient's file or visit first, or tell me who you mean.") };
        path[key] = context.patientId;
      } else if (how === "visit") {
        if (!context.appointmentId) return { reply: sorry("Open the patient's visit first.") };
        path[key] = context.appointmentId;
      } else if (how === "bill") {
        const bill = await billOf(context);
        if (!bill) return { reply: sorry("There is no bill for this patient yet. Add a charge first.") };
        path[key] = bill;
      } else {
        const said = String(asked[how.from] ?? "").trim();
        const matches = await find(how.find, said);
        const exact = matches.find((m) => m.name.toLowerCase() === said.toLowerCase());
        if (matches.length === 0) return { reply: sorry(`I could not find a ${how.find} called "${said}".`) };
        if (!exact && !matches[0]!.sure) return { reply: { kind: "answer", title: `Which ${how.find} do you mean by "${said}"? Say its full name.`, lines: matches.map((m) => ({ text: m.name })) } };
        const one = exact ?? matches[0]!;
        path[key] = one.id;
        found[how.from] = one.name;
      }
    }
    return { path, found };
  }

  const fill = (path: Record<string, string>) => url.replace(/:([A-Za-z]+)/g, (_, key: string) => encodeURIComponent(path[key] ?? ""));

  return {
    name,
    summary: spec.summary,
    kind: method === "GET" ? "read" : "write",
    needsPatient: aboutPatient,
    module: spec.module,
    schema,
    jsonSchema: jsonSchemaOf(spec.asks),
    allowed,
    async preview(context, params: Record<string, unknown>): Promise<Reply> {
      const { [PATH]: _, ...asked } = params;
      const settled = await settle(context, asked);
      if ("reply" in settled) return settled.reply;
      const patient = context.patientId ? (await prisma.patient.findUnique({ where: { id: context.patientId }, select: { name: true } }))?.name : undefined;
      const lines: Line[] = Object.entries(asked)
        .filter(([, value]) => value !== null && value !== undefined && value !== "")
        .map(([key, value]) => ({ label: spec.labels?.[key] ?? labelOf(key), text: settled.found[key] ?? shown(value) }));
      return { kind: "confirm", action: name, params: { ...asked, [PATH]: settled.path }, title: spec.title(asked as never, { patient, found: settled.found }), lines };
    },
    async run(context: ActionContext & { call?: Call }, params: Record<string, unknown>): Promise<Reply> {
      const { [PATH]: settledPath, ...asked } = params as Record<string, unknown> & { [PATH]?: Record<string, string> };
      if (!context.call) return sorry("That cannot be done from here.");
      // A read has no card, so its address is settled now.
      let path = settledPath;
      if (!path) {
        const settled = await settle(context, asked);
        if ("reply" in settled) return settled.reply;
        path = settled.path;
      }
      const about = { today: context.today, patientId: context.patientId, appointmentId: context.appointmentId };
      const body = spec.toBody ? spec.toBody(asked as never, about) : asked;
      const res = await context.call(method as "POST", fill(path), method === "GET" ? undefined : body);
      if (res.status >= 400) return sorry(typeof res.body?.error === "string" ? res.body.error : "That could not be done.");
      if (method === "GET") return { kind: "answer", title: spec.done?.(res.body, asked as never) ?? "Here it is", lines: [], to: spec.screen };
      return { kind: "done", say: spec.done?.(res.body, asked as never) ?? "Done.", to: spec.screen };
    },
  };
}

// ── Collected as the server starts ────────────────────────────────────

const declared: Action[] = [];

/** Everything routes have told the assistant it can do. */
export function declaredActions(): Action[] {
  return declared;
}

/**
 * Watches routes being registered and keeps the ones that told.
 * Must be called before the routes are registered.
 */
export function collectDeclared(app: FastifyInstance): void {
  app.addHook("onRoute", (route) => {
    const spec = route.config?.assistant;
    if (!spec) return;
    for (const method of Array.isArray(route.method) ? route.method : [route.method]) {
      if (method === "HEAD" || method === "OPTIONS") continue;
      const action = actionFrom(method, route.url, spec);
      // A second registration of the same route (a test building the app
      // twice) replaces the first rather than doubling the tool.
      const at = declared.findIndex((a) => a.name === action.name);
      if (at >= 0) declared[at] = action; else declared.push(action);
    }
  });
}

/** For tests. */
export function forgetDeclared(): void {
  declared.length = 0;
}

export const forTesting = { actionFrom, nameFrom, labelOf };
