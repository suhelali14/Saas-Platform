/**
 * Which actions a request could be about, when there are too many to
 * offer all of them.
 *
 * Every action offered to the model is paid for on every request that
 * reaches it, and past a few dozen a model also chooses worse. Today's
 * list is small enough to send whole. But actions now arrive on their
 * own, one for each feature that declares itself (declare.ts), so the
 * list will grow without anybody deciding it should. Before it is too
 * long, it is narrowed here.
 *
 * By words, not by a model: the request's words against each action's
 * name, description and field names. That costs nothing and takes no
 * time, and it only has to be good enough to keep the right action
 * among the twenty-five that go forward. It does not choose; the model
 * still does that.
 *
 * Pure, and tested.
 */

import type { Action } from "./registry.js";

/** Up to here the whole list is sent, and the provider caches it. */
export const SEND_ALL_UP_TO = 60;
const KEEP = 25;

/** Always offered: finding somebody and going somewhere are what a
 *  request falls back to when nothing else fits. */
const ALWAYS = new Set(["find_patient", "open_screen", "register_patient"]);

/** Said one way, written another. Each word stands for the rest of its line. */
const SAME: string[][] = [
  ["medicine", "medicines", "dawai", "dava", "aushadh", "tablet", "drug", "prescription", "prescribe", "दवा", "औषध", "गोळी"],
  ["bill", "billing", "invoice", "charge", "charges", "payment", "paid", "pay", "paise", "rupaye", "rupees", "discount", "बिल", "पैसे"],
  ["test", "tests", "lab", "report", "reports", "result", "results", "tapasni", "jaanch", "जांच", "तपासणी", "रिपोर्ट"],
  ["stock", "inventory", "batch", "expiry", "shelf", "saatha", "स्टॉक", "साठा"],
  ["visit", "appointment", "booking", "book", "queue", "token", "bhet", "भेट", "अपॉइंटमेंट"],
  ["patient", "patients", "peshant", "mareez", "marij", "file", "record", "पेशंट", "मरीज"],
  ["expense", "expenses", "kharcha", "spent", "खर्च"],
  ["certificate", "leave", "fitness", "referral", "refer", "सर्टिफिकेट", "रजा"],
  ["vitals", "bp", "pressure", "pulse", "weight", "temperature", "sugar", "spo2"],
  ["family", "relative", "husband", "wife", "mother", "father", "son", "daughter", "कुटुंब", "परिवार"],
];
const GROUP = new Map<string, number>();
SAME.forEach((words, i) => words.forEach((w) => GROUP.set(w, i)));

function words(text: string): string[] {
  return text.toLowerCase().replace(/([a-z])([A-Z])/g, "$1 $2")// Marks are kept with their letters: a Devanagari word is letters and
    // vowel signs, and splitting on the signs leaves no word at all.
    .split(/[^\p{L}\p{M}\p{N}]+/u).filter((w) => w.length > 1);
}

/** The words an action answers to, with the families they belong to. */
function vocabulary(action: Action): Set<string> {
  const properties = Object.keys(((action.jsonSchema as { properties?: object }).properties ?? {}) as object);
  const own = words([action.name.replace(/_/g, " "), action.summary, properties.join(" ")].join(" "));
  const out = new Set(own);
  for (const w of own) if (GROUP.has(w)) out.add(`#${GROUP.get(w)}`);
  return out;
}

/**
 * The actions worth offering for this request, most likely first.
 * `mentioned` are action names from earlier in the conversation: a
 * correction is about the action it corrects, whatever words it uses.
 */
export function relevant(actions: Action[], request: string, mentioned: string[] = []): Action[] {
  if (actions.length <= SEND_ALL_UP_TO) return actions;
  const asked = words(request);
  const families = new Set(asked.map((w) => GROUP.get(w)).filter((g): g is number => g !== undefined).map((g) => `#${g}`));
  const scored = actions.map((action, at) => {
    const vocab = vocabulary(action);
    let score = 0;
    for (const w of asked) if (vocab.has(w)) score += 2;
    for (const f of families) if (vocab.has(f)) score += 1;
    if (ALWAYS.has(action.name)) score += 100;
    if (mentioned.includes(action.name)) score += 100;
    // A clinic's own forms are few and fit the patient on screen.
    if (action.loose) score += 50;
    return { action, score, at };
  });
  return scored.sort((a, b) => b.score - a.score || a.at - b.at).slice(0, KEEP).map((s) => s.action);
}
