import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * The Nayaverse Growth connector: the pieces that need no database.
 *
 * A clinic gives its WhatsApp assistant a token. The assistant can read the
 * clinic's doctors, timings, fees and free slots, ask for an appointment
 * that reception confirms, and tell a patient their own next appointment by
 * the phone they write from. It never reads a record, a prescription or a
 * result: there is no route for it.
 */

/** A new token: shown to the clinic once, never stored. */
export function newToken(): string {
  return "nvc_" + randomBytes(32).toString("base64url");
}

/** What is stored, and the secret confirmations are signed with. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * The confirmation's signature: HMAC-SHA256 of the body, keyed by the
 * token's hash. Growth holds the token, so it can work out the same key;
 * the clinic holds only the hash, so it never needs the token again.
 */
export function sign(tokenHash: string, body: string): string {
  return createHmac("sha256", tokenHash).update(body, "utf8").digest("hex");
}

export function signatureMatches(tokenHash: string, body: string, signature: string): boolean {
  const want = Buffer.from(sign(tokenHash, body), "hex");
  const got = Buffer.from(signature, "hex");
  return want.length === got.length && timingSafeEqual(want, got);
}

export interface DayHours {
  open: string; // "10:00"
  close: string; // "13:30"
  closed?: boolean;
}

export type WeekKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export const WEEK_KEYS: WeekKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

const DAY_NAMES: Record<string, WeekKey> = {
  sunday: "sun", sun: "sun", monday: "mon", mon: "mon", tuesday: "tue", tue: "tue", tues: "tue",
  wednesday: "wed", wed: "wed", thursday: "thu", thu: "thu", thurs: "thu", friday: "fri", fri: "fri",
  saturday: "sat", sat: "sat",
};

/** "9:30", "09:30", "9:30 am", "1 PM" -> "09:30" / "13:00"; null when unreadable. */
export function clockOf(value: string | undefined | null): string | null {
  if (!value) return null;
  const m = /^\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?\s*$/i.exec(value);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] ?? "0");
  const ampm = m[3]?.toLowerCase().replace(/\./g, "");
  if (ampm === "pm" && h < 12) h += 12;
  if (ampm === "am" && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/**
 * The clinic's timings (the settings screen's list of { day, opensAt,
 * closesAt, closed }) as hours by day. A day missing from the list is
 * closed; a day whose times cannot be read is closed too, rather than
 * guessed.
 */
export function weekHours(timings: unknown): Partial<Record<WeekKey, DayHours>> {
  const out: Partial<Record<WeekKey, DayHours>> = {};
  if (!Array.isArray(timings)) return out;
  for (const t of timings) {
    if (!t || typeof t !== "object") continue;
    const row = t as { day?: string; opensAt?: string; closesAt?: string; closed?: boolean };
    const key = DAY_NAMES[String(row.day ?? "").trim().toLowerCase()];
    if (!key) continue;
    const open = clockOf(row.opensAt);
    const close = clockOf(row.closesAt);
    if (row.closed || !open || !close || close <= open) {
      out[key] = { open: open ?? "", close: close ?? "", closed: true };
    } else {
      out[key] = { open, close };
    }
  }
  return out;
}

export interface Busy {
  start: Date;
  end: Date;
}

/**
 * Free times on a day: every `step` minutes inside the day's hours, at
 * least `leadMinutes` from now, long enough for `minutes`, and not over a
 * time already taken. `day` is any moment on the clinic's local day.
 */
export function freeSlots(opts: {
  day: Date;
  hours: Partial<Record<WeekKey, DayHours>>;
  minutes: number;
  step?: number;
  busy: Busy[];
  now: Date;
  leadMinutes?: number;
}): Date[] {
  const h = opts.hours[WEEK_KEYS[opts.day.getDay()]!];
  if (!h || h.closed) return [];
  const at = (clock: string) => {
    const [hh, mm] = clock.split(":").map(Number);
    const d = new Date(opts.day);
    d.setHours(hh!, mm!, 0, 0);
    return d;
  };
  const open = at(h.open);
  const close = at(h.close);
  const step = Math.max(5, opts.step ?? 15) * 60_000;
  const length = Math.max(5, opts.minutes) * 60_000;
  const earliest = opts.now.getTime() + (opts.leadMinutes ?? 30) * 60_000;
  const out: Date[] = [];
  for (let t = open.getTime(); t + length <= close.getTime(); t += step) {
    if (t < earliest) continue;
    const end = t + length;
    if (opts.busy.some((b) => b.start.getTime() < end && t < b.end.getTime())) continue;
    out.push(new Date(t));
  }
  return out;
}

/** The last ten digits: how two ways of writing one Indian number match. */
export function lastTen(phone: string | null | undefined): string {
  const digits = String(phone ?? "").replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

export function samePhone(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = lastTen(a);
  return x.length === 10 && x === lastTen(b);
}

/** The request list's rough window for an exact time. */
export function windowOf(at: Date): "morning" | "afternoon" | "evening" {
  const h = at.getHours();
  return h < 12 ? "morning" : h < 16 ? "afternoon" : "evening";
}

/** A local day ("2026-11-30") at noon, the anchor every date-only value here uses. */
export function localDay(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
  return d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]) ? d : null;
}

/** Growth's address for confirmations must be https on a Nayaverse host. */
export function validCallback(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && (u.hostname === "nayaverse.in" || u.hostname.endsWith(".nayaverse.in"));
  } catch {
    return false;
  }
}
