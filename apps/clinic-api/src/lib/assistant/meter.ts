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
 * There are two ceilings on each paid thing: one for the whole clinic and
 * a lower one for each person. Without the second, one login caught in a
 * loop -- or one person leaning on the microphone -- would use up the
 * clinic's day and switch the assistant off for the doctor mid-surgery.
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
const COUNTERS: Counter[] = ["audioSeconds", "modelCalls", "tokensIn", "tokensOut", "ruleAnswers"];

function dayKey(date = new Date()): string {
  // The clinic's day, not the server's: a ceiling should reset at
  // midnight where the clinic is.
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

const key = (counter: Counter, day: string) => `meter:${day}:${counter}`;
const userKey = (counter: Counter, day: string, userId: string) => `meter:${day}:user:${userId}:${counter}`;

export async function count(amounts: Partial<Record<Counter, number>>, userId?: string | null): Promise<void> {
  try {
    const day = dayKey();
    const multi = redis().multi();
    for (const [counter, amount] of Object.entries(amounts) as [Counter, number][]) {
      if (!amount || amount <= 0) continue;
      multi.incrby(key(counter, day), Math.round(amount)).expire(key(counter, day), KEEP_SECONDS);
      // Per person only for the two things that have a per-person ceiling.
      if (userId && (counter === "audioSeconds" || counter === "modelCalls")) {
        multi.incrby(userKey(counter, day, userId), Math.round(amount)).expire(userKey(counter, day, userId), 2 * 24 * 60 * 60);
      }
    }
    await multi.exec();
  } catch {
    // See the note above: a count that fails is a count that is missing.
  }
}

async function usedOn(day: string): Promise<Record<Counter, number>> {
  const values = await redis().mget(...COUNTERS.map((c) => key(c, day)));
  return Object.fromEntries(COUNTERS.map((c, i) => [c, Number(values[i] ?? 0)])) as Record<Counter, number>;
}

async function capped(counter: "audioSeconds" | "modelCalls", clinicCeiling: number, userCeiling: number, userId?: string | null): Promise<boolean> {
  try {
    const day = dayKey();
    const [clinic, user] = await redis().mget(key(counter, day), userId ? userKey(counter, day, userId) : key(counter, "never"));
    return Number(clinic ?? 0) >= clinicCeiling || Number(user ?? 0) >= userCeiling;
  } catch {
    return false;
  }
}

/** Whether today's ceiling on listening has been reached, for the clinic or for this person. */
export function listeningIsCapped(userId?: string | null): Promise<boolean> {
  return capped("audioSeconds", env.ASSISTANT_DAILY_AUDIO_MINUTES * 60, env.ASSISTANT_USER_DAILY_AUDIO_MINUTES * 60, userId);
}

/** Whether today's ceiling on model requests has been reached, for the clinic or for this person. */
export function modelIsCapped(userId?: string | null): Promise<boolean> {
  return capped("modelCalls", env.ASSISTANT_DAILY_MODEL_CALLS, env.ASSISTANT_USER_DAILY_MODEL_CALLS, userId);
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
      for (const k of COUNTERS) sum[k] += d[k];
      return sum;
    }, { audioSeconds: 0, modelCalls: 0, tokensIn: 0, tokensOut: 0, ruleAnswers: 0 });
    return { today: each[0]!, month, ceilings: { audioMinutes: env.ASSISTANT_DAILY_AUDIO_MINUTES, modelCalls: env.ASSISTANT_DAILY_MODEL_CALLS } };
  } catch {
    return null;
  }
}
