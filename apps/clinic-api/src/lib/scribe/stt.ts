/**
 * Speech to text, one short piece of audio at a time.
 *
 * The browser sends the consultation in pieces of under thirty seconds
 * (the provider's limit for an immediate answer), so the transcript grows
 * while the doctor is still talking and nothing has to be transcribed in
 * one long wait at the end.
 *
 * Audio is held in memory for the length of this call and then gone. It
 * is never written to disk and never stored.
 */

import { env } from "../../config/env.js";

export class SpeechUnavailable extends Error {
  constructor(message: string, readonly status = 503) {
    super(message);
  }
}

export function speechAvailable(): boolean {
  return Boolean(env.SARVAM_API_KEY);
}

/** The provider's own limits: at most 50 terms, each at most 64 characters. */
function keyterms(terms: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of terms) {
    const term = raw.replace(/[^\p{L}\p{N} .+-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 64);
    const key = term.toLowerCase();
    if (term.length < 3 || seen.has(key)) continue;
    seen.add(key);
    out.push(term);
    if (out.length === 50) break;
  }
  return out;
}

/**
 * Transcribes one piece of audio.
 *
 * `bias` is this doctor's own most-written medicine names. The engine is
 * told to expect them, which is the cheapest accuracy there is: a
 * medicine name is the word a general speech model is most likely to get
 * wrong and the one that matters most here.
 */
export async function transcribe(audio: Buffer, mimeType: string, bias: readonly string[] = []): Promise<string> {
  if (!env.SARVAM_API_KEY) throw new SpeechUnavailable("Listening is not set up on this deployment.");

  const form = new FormData();
  const extension = mimeType.includes("ogg") ? "ogg" : mimeType.includes("mp4") ? "m4a" : mimeType.includes("wav") ? "wav" : "webm";
  form.append("file", new Blob([new Uint8Array(audio)], { type: mimeType || "audio/webm" }), `piece.${extension}`);
  form.append("model", "saaras:v4");
  // Keeps each language in its own words: a consultation here is Marathi,
  // Hindi and English in one sentence, and translating it would lose the
  // medicine names the doctor said in English.
  form.append("mode", "codemix");
  form.append("language_code", env.SCRIBE_LANGUAGE);
  const terms = keyterms(bias);
  if (terms.length > 0) form.append("keyterms", JSON.stringify(terms));

  let response: Response;
  try {
    response = await fetch("https://api.sarvam.ai/speech-to-text", {
      method: "POST",
      headers: { "api-subscription-key": env.SARVAM_API_KEY },
      body: form,
      signal: AbortSignal.timeout(45_000),
    });
  } catch {
    throw new SpeechUnavailable("The speech service could not be reached.");
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: { code?: string } } | null;
    const code = body?.error?.code ?? "";
    // Said in terms of what to do about it, and never echoing the key.
    if (response.status === 402 || code === "insufficient_quota_error") throw new SpeechUnavailable("The speech service's credit has run out.", 402);
    if (response.status === 403 || code === "invalid_api_key_error") throw new SpeechUnavailable("The speech service rejected this deployment's key.", 403);
    if (response.status === 429) throw new SpeechUnavailable("The speech service is busy. This piece will be sent again.", 429);
    throw new SpeechUnavailable(`The speech service returned ${response.status}.`, response.status >= 500 ? 503 : 400);
  }

  const data = (await response.json().catch(() => null)) as { transcript?: string } | null;
  return (data?.transcript ?? "").trim();
}
