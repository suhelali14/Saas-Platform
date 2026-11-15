import type { Prisma } from "../generated/prisma-client/index.js";

/**
 * Serialise money movements on one patient's advance or one bill.
 *
 * Every check here is "read the balance, then write against it": is the
 * refund within what is held, is the payment within what is owed. Two
 * requests at once -- a double tap, two counters -- both read the same
 * balance and both write, and an advance goes below zero or a bill is paid
 * twice. A transaction alone does not stop that at READ COMMITTED; a lock
 * on the thing being spent from does.
 *
 * Transaction-scoped advisory locks in their own two-key space (the queue's
 * token lock uses the one-key space, so they can never collide), taken in a
 * sorted order so two requests needing the same pair cannot deadlock.
 */
const MONEY_LOCK_SPACE = 7301;

export async function lockMoney(tx: Prisma.TransactionClient, ...keys: string[]): Promise<void> {
  for (const key of [...new Set(keys)].sort()) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${MONEY_LOCK_SPACE}::int, hashtext(${key}))`;
  }
}
