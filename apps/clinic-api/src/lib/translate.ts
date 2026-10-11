import { env } from "../config/env.js";

/**
 * Machine translation of clinic *website* content into Indian regional
 * languages.
 *
 * Scope is deliberate and narrow. This translates marketing and
 * information copy -- the clinic's tagline, services, opening-hours
 * labels, FAQs, health articles. It is never used for clinical content:
 * prescriptions, dosages, diagnoses and certificates stay in the language
 * the doctor wrote them in. A mistranslated "twice daily" is a patient
 * safety incident; a slightly awkward "General Consultation" is not.
 *
 * What comes out of here is a FIRST DRAFT. Every string lands in the
 * database with isReviewed=false and is shown to the clinic for
 * correction. Claiming machine output is finished, for a page real
 * patients act on, would be dishonest -- the review step is what makes the
 * result trustworthy, not the model.
 */

export interface LocaleInfo {
  code: string;
  englishName: string;
  nativeName: string;
}

/**
 * The regional languages worth offering an Indian clinic, by number of
 * speakers. English stays the authoring language and is always available,
 * so it isn't in this list.
 */
export const SUPPORTED_LOCALES: LocaleInfo[] = [
  { code: "hi", englishName: "Hindi", nativeName: "हिन्दी" },
  { code: "mr", englishName: "Marathi", nativeName: "मराठी" },
  { code: "bn", englishName: "Bengali", nativeName: "বাংলা" },
  { code: "te", englishName: "Telugu", nativeName: "తెలుగు" },
  { code: "ta", englishName: "Tamil", nativeName: "தமிழ்" },
  { code: "gu", englishName: "Gujarati", nativeName: "ગુજરાતી" },
  { code: "kn", englishName: "Kannada", nativeName: "ಕನ್ನಡ" },
  { code: "ml", englishName: "Malayalam", nativeName: "മലയാളം" },
  { code: "pa", englishName: "Punjabi", nativeName: "ਪੰਜਾਬੀ" },
  { code: "or", englishName: "Odia", nativeName: "ଓଡ଼ିଆ" },
  { code: "ur", englishName: "Urdu", nativeName: "اردو" },
  { code: "as", englishName: "Assamese", nativeName: "অসমীয়া" },
];

export const LOCALE_CODES = SUPPORTED_LOCALES.map((l) => l.code);

export function localeName(code: string): string {
  return SUPPORTED_LOCALES.find((l) => l.code === code)?.englishName ?? code;
}

export class TranslationUnavailableError extends Error {}

/** Says *which* reason applies, so an admin isn't told to add a key they
 * already added when the real cause is the feature being switched off. */
export function unavailableReason(): string {
  if (!env.AI_TRANSLATION_ENABLED) {
    return "Automatic translation is switched off for this clinic (AI_TRANSLATION_ENABLED=false). Translations can still be typed in by hand below.";
  }
  return "Automatic translation is not set up on this deployment. Add ANTHROPIC_API_KEY or GEMINI_API_KEY to the clinic API's .env — or just type the translations in by hand below, which works either way.";
}

/** Whether a content class may be auto-translated on this deployment.
 * Hand-entered translations are never restricted -- this only gates
 * spending, not the feature. */
export function namespaceAllowed(namespace: string): boolean {
  return env.AI_TRANSLATABLE_NAMESPACES.includes(namespace);
}

export function allowedNamespaces(): string[] {
  return env.AI_TRANSLATABLE_NAMESPACES;
}

export function maxItemsPerRun(): number {
  return env.AI_TRANSLATION_MAX_ITEMS;
}

export type Provider = "anthropic" | "gemini";

/**
 * Which provider this deployment can actually use. Returns null when no key
 * is configured -- the caller then falls back to hand-entered translations
 * rather than failing, because auto-translation is a convenience here, not
 * the feature itself.
 */
export function activeProvider(): Provider | null {
  // The master switch is checked before the keys: a deployment that has
  // turned AI translation off must behave exactly like one with no key at
  // all, rather than merely hiding the button in the UI.
  if (!env.AI_TRANSLATION_ENABLED) return null;

  const preference = env.TRANSLATION_PROVIDER;
  const hasAnthropic = Boolean(env.ANTHROPIC_API_KEY);
  const hasGemini = Boolean(env.GEMINI_API_KEY);

  if (preference === "anthropic") return hasAnthropic ? "anthropic" : null;
  if (preference === "gemini") return hasGemini ? "gemini" : null;
  // auto
  if (hasAnthropic) return "anthropic";
  if (hasGemini) return "gemini";
  return null;
}

/**
 * Translate a batch of strings in one call.
 *
 * Batched on purpose: sending the whole page at once lets the model keep
 * terminology consistent across it ("appointment" rendered the same way in
 * the nav, the button and the FAQ), which translating string-by-string
 * cannot do. Keys are echoed back so a reordered or partial response can
 * still be matched up rather than silently misaligning translations.
 */
export async function translateBatch(
  entries: { key: string; text: string }[],
  targetLocale: string,
  context: { clinicName?: string | null; region?: string | null },
): Promise<Record<string, string>> {
  const provider = activeProvider();
  if (!provider) {
    throw new TranslationUnavailableError(unavailableReason());
  }
  if (entries.length === 0) return {};

  const language = SUPPORTED_LOCALES.find((l) => l.code === targetLocale);
  if (!language) throw new Error(`Unsupported language: ${targetLocale}`);

  const system = [
    `You translate content for an Indian medical clinic's public website from English into ${language.englishName} (${language.nativeName}).`,
    "",
    "Rules:",
    `1. Translate the MEANING, not the words. Produce what a ${language.englishName}-speaking patient in India would naturally say, not a literal rendering.`,
    "2. Keep the register warm, plain and respectful -- this is read by patients, including elderly and low-literacy readers. Prefer everyday words over formal or Sanskritised ones.",
    "3. Medical terms: use the term patients actually use locally. Where the English word is what people say in practice (e.g. 'X-ray', 'BP', 'tablet'), keep it, transliterated into the local script if that is how it is normally written.",
    "4. Do NOT translate: proper nouns (clinic name, doctor names, place names), phone numbers, email addresses, registration numbers, or times/dates.",
    "5. Preserve the tone and approximate length. A short button label must stay short.",
    "6. If a string is already in the target language, or is a proper noun with no sensible translation, return it unchanged.",
    "",
    context.clinicName ? `The clinic is called "${context.clinicName}".` : "",
    context.region ? `It is located at: ${context.region}` : "",
    "",
    "Return ONLY a JSON object mapping each input key to its translated string. No markdown, no commentary, no code fences.",
  ]
    .filter(Boolean)
    .join("\n");

  const payload = JSON.stringify(Object.fromEntries(entries.map((e) => [e.key, e.text])), null, 2);
  const raw = provider === "anthropic" ? await callAnthropic(system, payload) : await callGemini(system, payload);

  return parseTranslationJson(raw, entries);
}

async function callAnthropic(system: string, payload: string): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: env.ANTHROPIC_TRANSLATION_MODEL,
      max_tokens: 8000,
      system,
      messages: [{ role: "user", content: payload }],
    }),
  });

  if (!response.ok) throw await providerError("Anthropic", response);

  const data = (await response.json()) as { content?: { type: string; text?: string }[] };
  return data.content?.find((c) => c.type === "text")?.text ?? "";
}

async function callGemini(system: string, payload: string): Promise<string> {
  // The key goes in a header, not the query string: a URL ends up in
  // request logs and proxy traces in a way a header does not.
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env.GEMINI_TRANSLATION_MODEL)}:generateContent`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "x-goog-api-key": env.GEMINI_API_KEY!, "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: payload }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 8000, responseMimeType: "application/json" },
    }),
  });

  if (!response.ok) throw await providerError("Gemini", response);

  const data = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  return data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
}

/** Provider errors are surfaced without ever echoing the API key, and the
 * upstream body is truncated so a verbose error can't flood a log. */
async function providerError(name: string, response: Response): Promise<Error> {
  const detail = await response.text().catch(() => "");
  if (response.status === 401 || response.status === 403) {
    return new TranslationUnavailableError(`${name} rejected the API key configured for this deployment.`);
  }
  if (response.status === 429) {
    return new TranslationUnavailableError(`${name} is rate-limiting this key. Wait a moment and try again.`);
  }
  return new Error(`${name} returned ${response.status}. ${detail.slice(0, 200)}`);
}

/**
 * Models occasionally wrap JSON in prose or a code fence despite being told
 * not to, so the object is extracted rather than assumed. Anything that
 * doesn't parse, or any key that comes back missing or non-string, is left
 * out -- the caller then keeps the English original for that field instead
 * of storing garbage.
 */
function parseTranslationJson(raw: string, entries: { key: string; text: string }[]): Record<string, string> {
  let jsonText = raw.trim();

  const fence = /```(?:json)?\s*([\s\S]*?)```/.exec(jsonText);
  if (fence?.[1]) jsonText = fence[1].trim();

  if (!jsonText.startsWith("{")) {
    const start = jsonText.indexOf("{");
    const end = jsonText.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("Translation service returned an unreadable response.");
    jsonText = jsonText.slice(start, end + 1);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("Translation service returned an unreadable response.");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Translation service returned an unreadable response.");
  }

  const record = parsed as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const entry of entries) {
    const value = record[entry.key];
    if (typeof value === "string" && value.trim().length > 0) out[entry.key] = value.trim();
  }
  return out;
}
