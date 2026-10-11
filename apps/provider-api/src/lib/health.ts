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
 */

const TIMEOUT_MS = 8000;

export async function checkAccount(account: { id: string; apiDomain: string | null }): Promise<void> {
  if (!account.apiDomain) return;

  const url = `https://${account.apiDomain}/health`;
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal });
    await prisma.healthCheck.create({
      data: {
        accountId: account.id,
        ok: res.ok,
        statusCode: res.status,
        latencyMs: Date.now() - started,
      },
    });
  } catch (error) {
    await prisma.healthCheck.create({
      data: {
        accountId: account.id,
        ok: false,
        latencyMs: Date.now() - started,
        error: error instanceof Error ? error.message.slice(0, 200) : "unreachable",
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function checkAllLive(): Promise<number> {
  const accounts = await prisma.clinicAccount.findMany({
    where: { status: "LIVE", apiDomain: { not: null } },
    select: { id: true, apiDomain: true },
  });
  // Sequential on purpose: a handful of clinics, and a burst of parallel
  // requests from one IP is exactly what a host's rate limiter reacts to.
  for (const account of accounts) await checkAccount(account);
  return accounts.length;
}

/** History is pruned so the table cannot grow without bound. Unlike the
 * clinic's audit log, these rows carry no compliance weight -- they are
 * operational telemetry, and keeping a year of them serves nobody. */
export async function pruneHealthHistory(): Promise<void> {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  await prisma.healthCheck.deleteMany({ where: { checkedAt: { lt: cutoff } } });
}

export function startHealthPolling(): NodeJS.Timeout | null {
  if (env.HEALTH_POLL_MINUTES <= 0) return null;
  const ms = env.HEALTH_POLL_MINUTES * 60 * 1000;
  const tick = async () => {
    try {
      await checkAllLive();
      await pruneHealthHistory();
    } catch {
      // A failed sweep must not take the console down with it.
    }
  };
  void tick();
  return setInterval(tick, ms);
}
