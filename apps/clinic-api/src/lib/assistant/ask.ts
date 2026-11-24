/**
 * A request to the assistant, start to finish.
 *
 *   1. RULE     does a rule recognise it? (router.ts)        free, instant
 *   2. MODEL    if not, a model chooses an action (pick.ts)  one short call
 *   3. CHECK    is the action this person's to use, and are the
 *               parameters well-formed?
 *   4. DO       a lookup or a screen runs now; a change comes back as a
 *               card and runs only when confirmed.
 *
 * Nothing in steps 1 and 2 is trusted. Whatever chose the action, step 3
 * checks it the same way, and a change still goes through the app's own
 * route and its own permission check when it is finally made.
 */

import { route, type Intent } from "./router.js";
import { pickAction, pickerAvailable } from "./pick.js";
import { actionNamed, actionsFor, type RunContext } from "./actions.js";
import { formActions } from "./forms.js";
import { sorry, type Action, type Reply } from "./registry.js";
import { modelIsCapped } from "./meter.js";

export interface Answered {
  reply: Reply;
  /** What worked out the request, so its cost is never a guess. */
  by: "rule" | "model" | "none";
  action: string | null;
  usage: { model: string; inputTokens: number; outputTokens: number } | null;
}

const HELP = "I did not follow that. Try: “show her last prescription”, “who is next”, “open billing”, “find patient Ramesh Joshi”.";

async function resolve(name: string, context: RunContext, dynamic?: Action[]): Promise<Action | undefined> {
  const fixed = actionNamed(name);
  if (fixed) return fixed;
  if (!name.startsWith("fill_form_")) return undefined;
  return (dynamic ?? (await formActions(context))).find((a) => a.name === name);
}

/** Step 3: may this person do this, and is it well-formed? */
function check(action: Action, intent: Intent, context: RunContext): { ok: true; params: unknown } | { ok: false; reply: Reply } {
  if (!actionsFor(context.asker).some((a) => a.name === action.name) && !action.name.startsWith("fill_form_")) {
    return { ok: false, reply: sorry("That is not available to your login in this clinic.") };
  }
  if (!action.allowed(context.asker)) return { ok: false, reply: sorry("That is not available to your login in this clinic.") };
  if (action.needsPatient && !context.patientId) return { ok: false, reply: sorry("Open a patient's file or visit first, or tell me who you mean.") };
  const parsed = action.schema.safeParse(intent.params ?? {});
  if (!parsed.success) return { ok: false, reply: sorry("I did not catch enough to do that. Say it once more with the details.") };
  return { ok: true, params: parsed.data };
}

async function perform(action: Action, intent: Intent, context: RunContext): Promise<Reply> {
  const checked = check(action, intent, context);
  if (!checked.ok) return checked.reply;
  try {
    // A change is described, never made, on the way in.
    if (action.kind === "write") return action.preview ? await action.preview(context, checked.params as never) : sorry("That cannot be done from here yet.");
    return await action.run(context, checked.params as never);
  } catch {
    return sorry("Something went wrong while doing that. Nothing was changed.");
  }
}

export async function ask(text: string, context: RunContext, pending?: { request: string; question: string }): Promise<Answered> {
  const request = text.trim().slice(0, 600);
  if (request.length < 1) return { reply: sorry(HELP), by: "none", action: null, usage: null };

  // An answer to a question the assistant asked ("three days") means
  // nothing on its own, so no rule is tried on it: it goes to the model
  // together with what it is an answer to.
  const ruled = pending ? null : route(request, { today: context.today, hasPatient: Boolean(context.patientId), hasVisit: Boolean(context.appointmentId) });
  if (ruled) {
    const action = await resolve(ruled.action, context);
    if (action) return { reply: await perform(action, ruled, context), by: "rule", action: action.name, usage: null };
  }

  if (!pickerAvailable()) return { reply: sorry(HELP), by: "none", action: null, usage: null };
  if (await modelIsCapped(context.asker.userId)) {
    return { reply: sorry("The assistant has reached today's limit for requests it has to think about. The everyday ones still work: “who is next”, “show her last prescription”, “open billing”."), by: "none", action: null, usage: null };
  }

  const forms = await formActions(context).catch(() => []);
  const offered = [...actionsFor(context.asker), ...forms];
  let picked;
  try {
    picked = await pickAction({
      text: request,
      actions: offered,
      hasPatient: Boolean(context.patientId),
      hasVisit: Boolean(context.appointmentId),
      today: `${context.today.getFullYear()}-${String(context.today.getMonth() + 1).padStart(2, "0")}-${String(context.today.getDate()).padStart(2, "0")}`,
      role: context.asker.role,
      pending,
    });
  } catch {
    return { reply: sorry("I could not work that out just now. The simple requests still work: “open billing”, “who is next”, “show her last prescription”."), by: "none", action: null, usage: null };
  }

  if (!picked.intent) return { reply: sorry(picked.said || HELP), by: "model", action: null, usage: picked.usage };
  const action = await resolve(picked.intent.action, context, forms);
  if (!action) return { reply: sorry(HELP), by: "model", action: null, usage: picked.usage };
  return { reply: await perform(action, picked.intent, context), by: "model", action: action.name, usage: picked.usage };
}

/**
 * Carries out a change the person has confirmed.
 *
 * The card they pressed Confirm on came from this server, but what comes
 * back is a request like any other and is treated as one: the action
 * must exist, must be a change, must be theirs to make, and its
 * parameters are validated again. Then it goes through the app's own
 * route, which checks them once more.
 */
export async function runConfirmed(name: string, params: unknown, context: RunContext): Promise<Answered> {
  const action = await resolve(name, context);
  if (!action || action.kind !== "write") return { reply: sorry("That is not something I can do."), by: "none", action: null, usage: null };
  const checked = check(action, { action: name, params: (params ?? {}) as Record<string, unknown> }, context);
  if (!checked.ok) return { reply: checked.reply, by: "none", action: name, usage: null };
  try {
    return { reply: await action.run(context, checked.params as never), by: "none", action: name, usage: null };
  } catch {
    return { reply: sorry("Something went wrong while doing that. Check the record before trying again."), by: "none", action: name, usage: null };
  }
}
