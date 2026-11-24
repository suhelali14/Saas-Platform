/**
 * The clinic's own forms, as things the assistant can fill in.
 *
 * A clinic's specialty forms -- antenatal visit, growth chart, diabetes
 * review, and whatever it has built for itself -- are stored as
 * definitions: a list of fields, each with a type. That is everything
 * needed to describe a form to a model, so no form is written out here
 * by hand. Each one becomes an action when it is relevant to the patient
 * on screen, including a form the clinic adds next year.
 *
 * Only the forms that fit this patient and this visit are offered (the
 * same ones the visit screen suggests), because every form described to
 * the model is paid for in tokens on every request that reaches it.
 */

import { z } from "zod";
import { sorry, type Action, type Line, type Reply } from "./registry.js";
import type { RunContext } from "./actions.js";

interface Field {
  key: string;
  label: string;
  type: string;
  unit?: string;
  options?: string[];
  retired?: boolean;
}
interface Form {
  key: string;
  title: string;
  kind: string;
  isActive: boolean;
  episodeKey?: string;
  sections: { title: string; fields: Field[] }[];
}
interface Specialty {
  forms: Form[];
  suggested: string[];
  episodes: { id: string; formKey: string; status: string; viaPartner?: boolean }[];
}

/** The most forms described to the model in one request. */
const MAX_FORMS = 4;
/** Fields the model can sensibly be asked to fill from speech. A table
 *  is a grid nobody dictates, and a computed field is worked out. */
const FILLABLE = new Set(["text", "textarea", "number", "date", "select", "multi", "yesno"]);

function schemaFor(field: Field): Record<string, unknown> {
  const about = `${field.label}${field.unit ? ` (${field.unit})` : ""}`;
  switch (field.type) {
    case "number": return { type: "number", description: about };
    case "date": return { type: "string", description: `${about}, as YYYY-MM-DD` };
    case "yesno": return { type: "boolean", description: about };
    case "select": return { type: "string", enum: field.options ?? [], description: about };
    case "multi": return { type: "array", items: { type: "string", enum: field.options ?? [] }, description: about };
    default: return { type: "string", description: about };
  }
}

function shown(value: unknown): string {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

/**
 * One action per form that fits the patient on screen.
 *
 * Asked of the app's own specialty route, as the person asking, so the
 * forms offered are exactly the ones that person is allowed to see and
 * that the visit screen itself would suggest.
 */
export async function formActions(context: RunContext): Promise<Action[]> {
  if (!context.patientId || !["DOCTOR", "NURSE"].includes(context.asker.role)) return [];
  const query = context.appointmentId ? `?appointmentId=${encodeURIComponent(context.appointmentId)}` : "";
  const res = await context.call("GET", `/api/clinic/patients/${context.patientId}/specialty${query}`);
  if (res.status !== 200) return [];
  const specialty = res.body as Specialty;
  const open = new Map(specialty.episodes.filter((e) => e.status === "ACTIVE").map((e) => [e.formKey, e.id]));

  const fitting = specialty.forms.filter((form) => {
    if (!form.isActive || form.kind === "episode") return false;
    // A form that belongs to an episode (an antenatal visit to a
    // pregnancy) is offered only while that episode is open.
    if (form.episodeKey) return open.has(form.episodeKey);
    return specialty.suggested.includes(form.key);
  });

  return fitting.slice(0, MAX_FORMS).map((form): Action => {
    const fields = form.sections.flatMap((s) => s.fields).filter((f) => !f.retired && FILLABLE.has(f.type));
    const byKey = new Map(fields.map((f) => [f.key, f]));
    const name = `fill_form_${form.key}`;

    /** Only what the form actually has, and only what was given. */
    const kept = (raw: Record<string, unknown>) =>
      Object.fromEntries(Object.entries(raw).filter(([key, value]) => byKey.has(key) && value !== null && value !== "" && !(Array.isArray(value) && value.length === 0)));

    return {
      name,
      summary: `Fills in the "${form.title}" form for the patient whose record is open, from what was said. Give only the fields that were actually mentioned; leave every other field out.`,
      kind: "write",
      needsPatient: true,
      loose: true,
      schema: z.record(z.unknown()),
      jsonSchema: { type: "object", properties: Object.fromEntries(fields.map((f) => [f.key, schemaFor(f)])) },
      allowed: (asker) => ["DOCTOR", "NURSE"].includes(asker.role),
      async preview(_context, params: Record<string, unknown>): Promise<Reply> {
        const data = kept(params);
        if (Object.keys(data).length === 0) return sorry(`Tell me what to put in the ${form.title} form.`);
        return {
          kind: "confirm",
          action: name,
          params: data,
          title: `Fill in "${form.title}" with this?`,
          lines: Object.entries(data).map(([key, value]): Line => {
            const field = byKey.get(key)!;
            return { label: field.label, text: `${shown(value)}${field.unit && typeof value === "number" ? ` ${field.unit}` : ""}` };
          }),
        };
      },
      async run(runContext: RunContext, params: Record<string, unknown>): Promise<Reply> {
        const saved = await runContext.call("POST", `/api/clinic/patients/${runContext.patientId}/records`, {
          formKey: form.key,
          episodeId: form.episodeKey ? open.get(form.episodeKey) : null,
          appointmentId: runContext.appointmentId ?? null,
          data: kept(params),
        });
        if (saved.status !== 201 && saved.status !== 200) {
          return sorry(typeof saved.body?.error === "string" ? saved.body.error : `The ${form.title} form could not be saved.`);
        }
        return { kind: "done", say: `"${form.title}" is filled in and saved.` };
      },
    };
  });
}
