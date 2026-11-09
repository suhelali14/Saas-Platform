/**
 * Tokens and the times a visit moves through the clinic.
 *
 * ── Why tokens ─────────────────────────────────────────────────────────
 *
 * Indian OPDs run on token numbers. The patient holds a slip, the
 * waiting-room screen shows "Now: 14", and nobody's name is read out or
 * shown. Until now the waiting-room screen showed the last four digits of
 * a UHID, which no patient knows, and the queue had no number a
 * receptionist could say out loud.
 *
 * One sequence per day for the whole clinic, not one per doctor: two
 * people in the same waiting room holding "Token 4" is the confusion a
 * token exists to prevent.
 *
 * A token is given at check-in, when the person is actually here, not at
 * booking. Numbers handed out to people who never arrive leave gaps that
 * make the waiting room think the queue is moving when it is not. Once
 * given, a token is never reissued, so undoing a check-in by mistake and
 * redoing it keeps the number on the slip.
 *
 * ── Why the times ──────────────────────────────────────────────────────
 *
 * checkedInAt, startedAt and completedAt are what the queue needs to say
 * how long someone has been waiting and roughly when they will be called.
 * Each is set once, the first time the visit reaches that stage, and never
 * moved by a later edit: a wait time that resets when somebody re-saves
 * the row is a wrong number on the screen.
 */

import type { Prisma } from "../generated/prisma-client/index.js";

/** The start and end of the clinic day containing `day`, server-local,
 *  matching how GET /appointments has always drawn the day. */
export function dayBounds(day: Date): { start: Date; end: Date } {
  const start = new Date(day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(day);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

type Status = "SCHEDULED" | "CHECKED_IN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "NO_SHOW";

interface Stamped {
  status: string;
  tokenNumber: number | null;
  checkedInAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
}

/**
 * The time fields a move to `next` should set, given what the visit
 * already has. Pure, so it can be tested without a database.
 *
 * Skipping a stage still records it: a doctor who calls in a patient
 * reception never marked arrived has, in fact, got that patient in the
 * room, so check-in is stamped at the same moment rather than left empty.
 *
 * Moving a visit back a stage (an undone check-in, a patient sent back to
 * wait) clears the times of the stages it has left, because those things
 * have not happened after all. The token stays, see above.
 *
 * Cancelled and no-show leave every time as it was: that is the record of
 * how far the visit got.
 */
export interface Stamps {
  checkedInAt?: Date | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  needsToken: boolean;
}

const STAGE: Record<string, number> = { SCHEDULED: 0, CHECKED_IN: 1, IN_PROGRESS: 2, COMPLETED: 3 };

export function stampsFor(existing: Stamped, next: Status, now: Date): Stamps {
  const out: Stamps = { needsToken: false };
  const to = STAGE[next];
  if (to === undefined) return out;

  if (to >= 1) {
    if (!existing.checkedInAt) out.checkedInAt = now;
    if (existing.tokenNumber == null) out.needsToken = true;
  } else if (existing.checkedInAt) {
    out.checkedInAt = null;
  }

  if (to === 2) {
    if (!existing.startedAt) out.startedAt = now;
  } else if (to < 2 && existing.startedAt) {
    out.startedAt = null;
  }

  if (to === 3) {
    if (!existing.completedAt) out.completedAt = now;
  } else if (existing.completedAt) {
    out.completedAt = null;
  }
  return out;
}

/**
 * Serialises token assignment.
 *
 * Two receptionists checking two people in at the same second would both
 * read "highest token is 7" and both write 8. A transaction-scoped
 * advisory lock makes the read-then-write one step; it is released when
 * the transaction ends, works through a transaction-mode pooler, and the
 * whole database belongs to one clinic, so one fixed key is enough.
 */
const TOKEN_LOCK_KEY = 7_204_311;

export async function nextToken(tx: Prisma.TransactionClient, scheduledAt: Date): Promise<number> {
  await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${TOKEN_LOCK_KEY})`);
  const { start, end } = dayBounds(scheduledAt);
  const max = await tx.appointment.aggregate({
    _max: { tokenNumber: true },
    where: { scheduledAt: { gte: start, lte: end } },
  });
  return (max._max.tokenNumber ?? 0) + 1;
}
