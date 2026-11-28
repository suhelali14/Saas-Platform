import { prisma } from "./prisma.js";
import { env } from "../config/env.js";

/**
 * Pings each live clinic's /health endpoint.
 *
 * This is deliberately the ONLY thing this console ever reads from a
 * running clinic deployment. /health is unauthenticated and returns a
 * status string and a timestamp -- no patient data, no counts, nothing
 * behind a login. The compliance boundary the whole architecture rests on
 * is that this console cannot see PHI, and a monitoring feature is exactly
 * the kind of convenience that erodes such a boundary one field at a time.
 *
 * The console's database is Neon, which sleeps after five idle minutes and
 * counts every minute it is awake against the month's compute. A sweep
 * every ten minutes that read the clinic list and wrote a row per clinic
 * kept it awake half of every day. So the sweep itself never touches the
 * database: results are held in memory (the console shows them when they
 * are newer than the stored ones), a row is written only when a clinic goes
 * down or comes back, or every six hours as a heartbeat, and the list of
 * live clinics is read every six hours.
 */

const TIMEOUT_MS = 8000;
const SIX_HOURS = 6 * 60 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

export type HealthResult = {
  accountId: string;
  ok: boolean;
  statusCode: number | null;
  latencyMs: number;
  error: string | null;
  checkedAt: Date;
};

type Clinic = { id: string; apiDomain: string | null };

/** The latest result per clinic, in memory. */
/** The database, or a stand-in in tests. */
type HealthDb = { healthCheck: Pick<typeof prisma.healthCheck, "create" | "findMany" | "deleteMany">; clinicAccount: Pick<typeof prisma.clinicAccount, "findMany"> };
let db: HealthDb = prisma;

const latest = new Map<string, HealthResult>();
/** What was last written per clinic: up or down, and when. */
const written = new Map<string, { ok: boolean; at: number }>();
let clinics: { list: Clinic[]; at: number } | null = null;
let prunedAt = 0;

/** The latest check of a clinic, when this process has made one. */
export function latestHealth(accountId: string): HealthResult | undefined {
  return latest.get(accountId);
}

/** The latest check as the console shows it: memory when newer than the row. */
export function newerHealth<T extends { checkedAt: Date }>(accountId: string, stored: T | null | undefined): (HealthResult & { id: string }) | T | null {
  const mem = latest.get(accountId);
  if (mem && (!stored || mem.checkedAt > stored.checkedAt)) return { id: `live-${accountId}`, ...mem };
  return stored ?? null;
}

async function probe(account: Clinic): Promise<HealthResult | null> {
  if (!account.apiDomain) return null;
  const url = `https://${account.apiDomain}/health`;
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return { accountId: account.id, ok: res.ok, statusCode: res.status, latencyMs: Date.now() - started, error: null, checkedAt: new Date() };
  } catch (error) {
    return {
      accountId: account.id,
      ok: false,
      statusCode: null,
      latencyMs: Date.now() - started,
      error: error instanceof Error ? error.message.slice(0, 200) : "unreachable",
      checkedAt: new Date(),
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Writes a result when it changes something (up or down), or as the heartbeat. */
async function record(r: HealthResult, heartbeat: boolean): Promise<boolean> {
  const prev = written.get(r.accountId);
  const due = heartbeat || !prev || prev.ok !== r.ok;
  if (!due) return false;
  await db.healthCheck.create({
    data: { accountId: r.accountId, ok: r.ok, statusCode: r.statusCode, latencyMs: r.latencyMs, error: r.error, checkedAt: r.checkedAt },
  });
  written.set(r.accountId, { ok: r.ok, at: r.checkedAt.getTime() });
  return true;
}

export async function checkAccount(account: Clinic, heartbeat = false): Promise<HealthResult | null> {
  const r = await probe(account);
  if (!r) return null;
  latest.set(r.accountId, r);
  await record(r, heartbeat);
  return r;
}

/** The live clinics, read again every six hours (or when asked); fresh says it was read now. */
async function liveClinics(force: boolean): Promise<{ list: Clinic[]; fresh: boolean }> {
  if (!force && clinics && Date.now() - clinics.at < SIX_HOURS) return { list: clinics.list, fresh: false };
  const list = await db.clinicAccount.findMany({
    where: { status: "LIVE", apiDomain: { not: null } },
    select: { id: true, apiDomain: true },
  });
  // What was written last, once per process, so a restart does not write a
  // row for every clinic.
  if (!clinics && list.length > 0) {
    const last = await db.healthCheck.findMany({
      where: { accountId: { in: list.map((c) => c.id) } },
      orderBy: { checkedAt: "desc" },
      distinct: ["accountId"],
      select: { accountId: true, ok: true, checkedAt: true },
    });
    for (const h of last) if (!written.has(h.accountId)) written.set(h.accountId, { ok: h.ok, at: h.checkedAt.getTime() });
  }
  clinics = { list, at: Date.now() };
  return { list, fresh: true };
}

/**
 * Checks every live clinic. The sweep that reads the list again (every six
 * hours, or force) also writes every result: one heartbeat for all, while
 * the database is awake anyway.
 */
export async function checkAllLive(force = false): Promise<HealthResult[]> {
  const { list, fresh } = await liveClinics(force);
  const out: HealthResult[] = [];
  // Sequential on purpose: a handful of clinics, and a burst of parallel
  // requests from one IP is exactly what a host's rate limiter reacts to.
  for (const account of list) {
    const r = await checkAccount(account, fresh);
    if (r) out.push(r);
  }
  // Pruned at most daily, while the database is awake for a write anyway.
  if (Date.now() - prunedAt > DAY && out.some((r) => written.get(r.accountId)?.at === r.checkedAt.getTime())) {
    prunedAt = Date.now();
    await pruneHealthHistory();
  }
  return out;
}

/** History is pruned so the table cannot grow without bound. Unlike the
 * clinic's audit log, these rows carry no compliance weight -- they are
 * operational telemetry, and keeping a year of them serves nobody. */
export async function pruneHealthHistory(): Promise<void> {
  const cutoff = new Date(Date.now() - 30 * DAY);
  await db.healthCheck.deleteMany({ where: { checkedAt: { lt: cutoff } } });
}

export function startHealthPolling(): NodeJS.Timeout | null {
  if (env.HEALTH_POLL_MINUTES <= 0) return null;
  const ms = env.HEALTH_POLL_MINUTES * 60 * 1000;
  const tick = async () => {
    try {
      await checkAllLive();
    } catch {
      // A failed sweep must not take the console down with it.
    }
  };
  void tick();
  return setInterval(tick, ms);
}

/** For tests: a stand-in database, and nothing held from before. */
export function healthForTest(stand: HealthDb) {
  db = stand;
  latest.clear();
  written.clear();
  clinics = null;
  prunedAt = 0;
}
