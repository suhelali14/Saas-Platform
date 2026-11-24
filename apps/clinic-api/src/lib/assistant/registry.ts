/**
 * The assistant's action list: what it can do in this app.
 *
 * ── The idea ─────────────────────────────────────────────────────────
 *
 * The assistant does not click through screens. Each thing it can do is
 * an ACTION: a name, what it needs, who may do it, and the function that
 * does it by calling the same code the screens call. Somebody asks in
 * their own words; a rule or a model works out which action and with
 * what; the action runs.
 *
 * That is what makes it fast (one function call, not a tour of the
 * interface), cheap (at most one short model call, often none), safe
 * (every action checks who is asking, exactly as its screen does) and
 * easy to grow: a new feature is offered to the assistant by adding its
 * action here, and nothing else about the assistant changes.
 *
 * ── Three kinds, and the one rule ────────────────────────────────────
 *
 *   read   looks something up and answers.            Runs at once.
 *   go     takes the person to a screen.              Runs at once.
 *   write  changes a record.                          NEVER runs at once.
 *
 * A write is first turned into a card that says exactly what is about to
 * be done, and is carried out only when the person presses Confirm on
 * it. The assistant can be mistaken about what was meant; a record
 * changed on a mishearing is not something a clinic can take back.
 */

import type { z } from "zod";
import type { Feature } from "../../config/features.js";

export interface Asker {
  userId: string;
  role: string;
  isAdmin: boolean;
  name: string;
}

export interface ActionContext {
  asker: Asker;
  /** The patient on the asker's screen, when there is one. */
  patientId: string | null;
  /** The visit on the asker's screen, when there is one. */
  appointmentId: string | null;
  today: Date;
}

/** One line of an answer. `to` makes it a link into the app. */
export interface Line {
  label?: string;
  text: string;
  to?: string;
  tone?: "danger" | "warning" | "muted";
}

export type Reply =
  /** Something looked up. */
  | { kind: "answer"; title: string; lines: Line[]; to?: string; toLabel?: string }
  /** Take them to a screen. */
  | { kind: "go"; to: string; say: string }
  /** A change, described, waiting for a yes. */
  | { kind: "confirm"; action: string; params: Record<string, unknown>; title: string; lines: Line[] }
  /** A change that was confirmed and has been made. */
  | { kind: "done"; say: string; to?: string }
  /** It cannot, or did not understand; says so plainly. */
  | { kind: "sorry"; say: string };

export interface Action {
  name: string;
  /** For the model: what this does and when to choose it. One or two
   *  plain sentences, written as a description, not as a command. */
  summary: string;
  kind: "read" | "go" | "write";
  /** Only meaningful with a patient on screen or named. */
  needsPatient?: boolean;
  /** Offered only when this module is part of the clinic's plan. */
  module?: Feature;
  /** Validates what a rule or a model supplied. A model's output is a
   *  proposal, and this is where a malformed one stops. */
  schema: z.ZodTypeAny;
  /** The same shape as JSON Schema, for the model's tool definition. */
  jsonSchema: Record<string, unknown>;
  /** One of the clinic's own forms, built from its definition. */
  loose?: boolean;
  /** The same role rule the action's own screen enforces. */
  allowed(asker: Asker): boolean;
  /** For a write: the card describing what is about to happen. Looks
   *  things up and checks them, changes nothing. */
  preview?(context: ActionContext, params: never): Promise<Reply>;
  /** Does it. For a write, called only after the card was confirmed. */
  run(context: ActionContext, params: never): Promise<Reply>;
}

export const sorry = (say: string): Reply => ({ kind: "sorry", say });

/**
 * The JSON Schema a model is shown for an action's parameters.
 *
 * A property written as nullable (`type: ["string", "null"]`) is one
 * that may simply be left out, and is described to the model that way:
 * not required, and with its plain type. What the model sends back is
 * not trusted to match this -- the action's zod schema is what decides
 * (ask.ts) -- so this is a description for the model, not a guard.
 */
export function strictObject(properties: Record<string, unknown>): Record<string, unknown> {
  const required: string[] = [];
  const plain: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(properties)) {
    const type = (value as { type?: unknown }).type;
    if (Array.isArray(type)) plain[key] = { ...(value as object), type: type.find((t) => t !== "null") };
    else { plain[key] = value; required.push(key); }
  }
  return { type: "object", additionalProperties: false, required, properties: plain };
}
