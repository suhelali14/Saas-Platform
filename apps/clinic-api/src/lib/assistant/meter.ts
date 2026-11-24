/**
 * What the assistant has used, and a ceiling on it.
 *
 * Every minute it listens and every request a model reads costs the
 * provider of this software real money, per clinic, per day. Two things
 * follow from that and both live here:
 *
 *   A COUNT, so the cost of running the assistant for a clinic is a
 *   number that can be looked up, not an invoice that arrives as a
 *   surprise at the end of the month.
 *
 *   A CEILING per day, so a fault -- a microphone left recording over a
 *   weekend, a script calling the assistant in a loop -- stops at a known
 *   amount instead of running until somebody notices.
 *
 * Counters are kept in the clinic's own Redis, one small key per day,
 * for forty-five days. They hold numbers only: no words, no patient.
 *
 * Counting must never get in the way of the work. If Redis cannot be
 * reached, nothing is counted and nothing is refused.
 */

import { env } from "../../config/env.js";
import { redis } from "../sessions.js";

export type Counter = "audioSeconds" | "modelCalls" | "tokensIn" | "tokensOut" | "ruleAnswers";

const KEEP_SECONDS = 45 * 24 * 60 * 60;

function dayKey(date = new Date()): string {
  // The clinic's day, not the server's: a ceiling should reset at
  // midnight where the clinic is.
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

const key = (counter: Counter, day: string) => `meter:${day}:${counter}`;

export async function count(amounts: Partial<Record<Counter, number>>): Promise<void> {
  try {
    const day = dayKey();
    const multi = redis().multi();
    for (const [counter, amount] of Object.entries(amounts) as [Counter, number][]) {
      if (!amount || amount <= 0) continue;
      multi.incrby(key(counter, day), Math.round(amount)).expire(key(counter, day), KEEP_SECONDS);
    }
    await multi.exec();
  } catch {
    // See the note above: a count that fails is a count that is missing.
  }
}

async function usedOn(day: string): Promise<Record<Counter, number>> {
  const counters: Counter[] = ["audioSeconds", "modelCalls", "tokensIn", "tokensOut", "ruleAnswers"];
  const values = await redis().mget(...counters.map((c) => key(c, day)));
  return Object.fromEntries(counters.map((c, i) => [c, Number(values[i] ?? 0)])) as Record<Counter, number>;
}

/** Whether today's ceiling on listening has been reached. */
export async function listeningIsCapped(): Promise<boolean> {
  try {
    return (await usedOn(dayKey())).audioSeconds >= env.ASSISTANT_DAILY_AUDIO_MINUTES * 60;
  } catch {
    return false;
  }
}

/** Whether today's ceiling on model requests has been reached. */
export async function modelIsCapped(): Promise<boolean> {
  try {
    return (await usedOn(dayKey())).modelCalls >= env.ASSISTANT_DAILY_MODEL_CALLS;
  } catch {
    return false;
  }
}

/**
 * What the providers charge, for turning counts into rupees.
 *
 * ESTIMATES, written down once so they are easy to correct: the speech
 * service's published per-minute rate and the small model's published
 * per-token rates, at a fixed exchange rate. The providers' own invoices
 * are the truth; this is for seeing the size of the number, and for
 * noticing when it changes.
 */
const RUPEES_PER_AUDIO_MINUTE = 0.49;
const RUPEES_PER_DOLLAR = 88;
const DOLLARS_PER_MILLION_IN = 0.1;
const DOLLARS_PER_MILLION_OUT = 0.5;

export function estimatedRupees(used: Record<Counter, number>): { speech: number; model: number; total: number } {
  const speech = (used.audioSeconds / 60) * RUPEES_PER_AUDIO_MINUTE;
  const model = ((used.tokensIn * DOLLARS_PER_MILLION_IN + used.tokensOut * DOLLARS_PER_MILLION_OUT) / 1_000_000) * RUPEES_PER_DOLLAR;
  return { speech, model, total: speech + model };
}

export interface Usage {
  today: Record<Counter, number>;
  /** The last thirty days, today included. */
  month: Record<Counter, number>;
  ceilings: { audioMinutes: number; modelCalls: number };
}

export async function usage(): Promise<Usage | null> {
  try {
    const days = Array.from({ length: 30 }, (_, i) => dayKey(new Date(Date.now() - i * 86_400_000)));
    const each = await Promise.all(days.map(usedOn));
    const month = each.reduce((sum, d) => {
      for (const k of Object.keys(sum) as Counter[]) sum[k] += d[k];
      return sum;
    }, { audioSeconds: 0, modelCalls: 0, tokensIn: 0, tokensOut: 0, ruleAnswers: 0 });
    return { today: each[0]!, month, ceilings: { audioMinutes: env.ASSISTANT_DAILY_AUDIO_MINUTES, modelCalls: env.ASSISTANT_DAILY_MODEL_CALLS } };
  } catch {
    return null;
  }
}
