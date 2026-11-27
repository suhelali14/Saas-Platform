import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";

/**
 * Razorpay Subscriptions, as this console uses them: a plan (an amount and
 * an interval) and a subscription on it, which the customer authorises
 * once on Razorpay's page (UPI AutoPay, a card, or a bank mandate) and which
 * Razorpay then charges every cycle. Webhooks say what happened.
 *
 * Under the RBI's e-mandate rules (April 2026) a card or UPI debit above
 * ₹15,000 needs the customer's approval each time; a bank mandate (eNACH)
 * does not, so larger plans are best paid that way.
 */

type Interval = "MONTH" | "YEAR";

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const auth = Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString("base64");
  const res = await fetch(env.RAZORPAY_BASE.replace(/\/$/, "") + path, {
    method,
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: { description?: string } } & T;
  if (!res.ok) throw new Error(`Razorpay: ${data.error?.description ?? res.status}`);
  return data;
}

export async function createPlan(interval: Interval, amountPaise: number, name: string): Promise<string> {
  const p = await call<{ id: string }>("POST", "/plans", {
    period: interval === "MONTH" ? "monthly" : "yearly",
    interval: 1,
    item: { name: name.slice(0, 120), amount: amountPaise, currency: "INR" },
  });
  return p.id;
}

export async function createSubscription(planId: string, interval: Interval, notes: Record<string, string>, startAt?: Date): Promise<{ id: string; short_url: string; status: string }> {
  return call("POST", "/subscriptions", {
    plan_id: planId,
    // Razorpay needs a number of cycles: ten years, in practice until cancelled.
    total_count: interval === "MONTH" ? 120 : 10,
    quantity: 1,
    customer_notify: 1,
    notes,
    ...(startAt && startAt.getTime() > Date.now() + 60_000 ? { start_at: Math.floor(startAt.getTime() / 1000) } : {}),
  });
}

export async function cancelSubscription(id: string, atCycleEnd: boolean): Promise<void> {
  await call("POST", `/subscriptions/${id}/cancel`, { cancel_at_cycle_end: atCycleEnd ? 1 : 0 });
}

export function validWebhook(body: string, signature: string | undefined): boolean {
  if (!env.RAZORPAY_WEBHOOK_SECRET || !signature) return false;
  const want = createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET).update(body).digest("hex");
  const a = Buffer.from(want);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** The parts of a subscription webhook this console uses. */
export interface SubscriptionEvent {
  event: string;
  subscriptionId: string;
  status: string;
  currentStart: Date | null;
  currentEnd: Date | null;
  paymentId: string | null;
  paymentAmount: number | null;
}

export function parseEvent(body: string): SubscriptionEvent | null {
  try {
    const j = JSON.parse(body) as {
      event?: string;
      payload?: { subscription?: { entity?: { id?: string; status?: string; current_start?: number | null; current_end?: number | null } }; payment?: { entity?: { id?: string; amount?: number } } };
    };
    const s = j.payload?.subscription?.entity;
    if (!j.event?.startsWith("subscription.") || !s?.id) return null;
    const at = (t?: number | null) => (t ? new Date(t * 1000) : null);
    return {
      event: j.event,
      subscriptionId: s.id,
      status: s.status ?? "",
      currentStart: at(s.current_start),
      currentEnd: at(s.current_end),
      paymentId: j.payload?.payment?.entity?.id ?? null,
      paymentAmount: j.payload?.payment?.entity?.amount ?? null,
    };
  } catch {
    return null;
  }
}
