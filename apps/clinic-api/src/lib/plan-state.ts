import { applyPlanOverride, isModuleKey, PLAN_ORDER, type PlanOverride, type PlanTier } from "../config/features.js";
import { env } from "../config/env.js";
import { prisma } from "./prisma.js";
import { privateKeyFrom, publicKeyFrom, s2sFetch } from "./s2s.js";
import type { KeyObject } from "node:crypto";

/**
 * The plan the Nayaversse console sets for this clinic (config/features.ts,
 * PlanOverride). Read once at start; written by the console's signed call
 * (routes/clinic-plan.ts), and in force from that moment, with no restart.
 */

export function isPlanTier(v: string): v is PlanTier {
  return (PLAN_ORDER as readonly string[]).includes(v);
}

function toOverride(row: { plan: string; features: string | null; readOnly: boolean; paidUntil: Date | null }): PlanOverride | null {
  if (!isPlanTier(row.plan)) return null;
  return { plan: row.plan, features: row.features, readOnly: row.readOnly, paidUntil: row.paidUntil };
}

/** At start: the console's plan, if it has set one. A missing table (an
 *  older database before its migration) leaves the env in charge. */
export async function loadPlanState(): Promise<void> {
  try {
    const row = await prisma.clinicPlanState.findUnique({ where: { id: "current" } });
    applyPlanOverride(row ? toOverride(row) : null);
  } catch {
    applyPlanOverride(null);
  }
}

export interface PlanInput {
  plan: string;
  features?: string[] | null;
  readOnly?: boolean;
  paidUntil?: string | null;
  note?: string;
}

/** Stores the console's plan and puts it in force. Unknown module names are
 *  dropped, as the env's list is: a newer console never stops an older clinic. */
export async function savePlanState(input: PlanInput): Promise<PlanOverride> {
  if (!isPlanTier(input.plan)) throw Object.assign(new Error("Unknown plan."), { status: 400 });
  const features = input.features == null ? null : input.features.filter(isModuleKey).join(",");
  const paidUntil = input.paidUntil ? new Date(input.paidUntil) : null;
  if (paidUntil && Number.isNaN(paidUntil.getTime())) throw Object.assign(new Error("paidUntil is not a date."), { status: 400 });
  const data = { plan: input.plan, features, readOnly: Boolean(input.readOnly), paidUntil, note: input.note?.slice(0, 200) ?? null };
  const row = await prisma.clinicPlanState.upsert({ where: { id: "current" }, create: { id: "current", ...data }, update: data });
  const o = toOverride(row)!;
  applyPlanOverride(o);
  return o;
}

// ── Calls to the console ───────────────────────────────────────────────

let keys: { signing: KeyObject; console: KeyObject } | null | undefined;

/** Whether this clinic is connected to the console. */
export function consoleConnected(): boolean {
  return Boolean(env.CONSOLE_URL && env.CONSOLE_PUBLIC_KEY && env.CLINIC_SIGNING_KEY && env.CONSOLE_CLINIC_REF);
}

export function consoleKeys() {
  if (keys !== undefined) return keys;
  keys = consoleConnected() ? { signing: privateKeyFrom(env.CLINIC_SIGNING_KEY!), console: publicKeyFrom(env.CONSOLE_PUBLIC_KEY!) } : null;
  return keys;
}

/** A signed call from this clinic to the console. */
export function callConsole<T = unknown>(path: string, method = "GET", body?: unknown): Promise<T> {
  const k = consoleKeys();
  if (!k) throw Object.assign(new Error("This clinic is not connected to the Nayaversse console yet."), { status: 409 });
  return s2sFetch<T>({ base: env.CONSOLE_URL!, path, method, body, key: k.signing, keyId: `clinic:${env.CONSOLE_CLINIC_REF}` });
}
