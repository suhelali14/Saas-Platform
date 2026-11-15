/**
 * An inpatient stay's bill: room days, posted charges, deposits, and
 * what is left to pay.
 *
 * Pure functions over plain numbers and dates, so the arithmetic is
 * tested without a database. Money is summed in paise and returned in
 * rupees, as in billing.
 *
 * ── Room days ─────────────────────────────────────────────────────────
 *
 * Charged by each 24 hours started, per bed, at the rate that bed's ward
 * had when the patient moved in (kept on the move, so changing a ward's
 * rate never rewrites a running bill). A stay of any length is at least
 * one day. A stop of under four hours in a bed on the way somewhere else
 * -- a transfer the same morning -- is not charged as a day of its own;
 * charging both wards for that day is what patients query at discharge.
 */

export interface Move {
  wardName: string;
  dailyRate: number;
  at: Date;
}

export interface RoomLine {
  wardName: string;
  dailyRate: number;
  from: Date;
  to: Date;
  days: number;
  amount: number;
}

const HOUR = 3_600_000;
const SHORT_STOP_HOURS = 4;
const paise = (r: number) => Math.round(r * 100);

export function roomLines(moves: Move[], end: Date): RoomLine[] {
  const sorted = [...moves].sort((a, b) => a.at.getTime() - b.at.getTime());
  const lines: RoomLine[] = [];
  for (let i = 0; i < sorted.length; i += 1) {
    const m = sorted[i]!;
    const to = i + 1 < sorted.length ? sorted[i + 1]!.at : end;
    const hours = Math.max(0, (to.getTime() - m.at.getTime()) / HOUR);
    const isOnly = sorted.length === 1;
    let days = Math.ceil(hours / 24);
    if (!isOnly && hours < SHORT_STOP_HOURS) days = 0;
    lines.push({ wardName: m.wardName, dailyRate: m.dailyRate, from: m.at, to, days, amount: (paise(m.dailyRate) * days) / 100 });
  }
  // At least one day for any stay, charged to the bed it began in.
  if (lines.length && lines.every((l) => l.days === 0)) {
    lines[0]!.days = 1;
    lines[0]!.amount = lines[0]!.dailyRate;
  }
  return lines;
}

export interface ChargeLine { category: string; description: string; quantity: number; rate: number }
export interface DepositLine { kind: "ADVANCE" | "REFUND" | "APPLIED"; amount: number }

export interface StayBill {
  room: RoomLine[];
  roomTotal: number;
  chargesTotal: number;
  total: number;
  /** Advance still held: in minus refunded minus already applied. */
  depositHeld: number;
  /** What would remain after using the whole held deposit. Negative
   *  means the deposit is more than the bill and the rest is a refund. */
  balance: number;
  /** True when the bill has passed what was deposited -- the moment the
   *  family is asked for more. */
  needsTopUp: boolean;
}

export function stayBill(moves: Move[], charges: ChargeLine[], deposits: DepositLine[], end: Date): StayBill {
  const room = roomLines(moves, end);
  const roomTotal = room.reduce((s, l) => s + paise(l.amount), 0);
  const chargesTotal = charges.reduce((s, c) => s + paise(c.rate) * c.quantity, 0);
  const held = deposits.reduce((s, d) => s + (d.kind === "ADVANCE" ? paise(d.amount) : -paise(d.amount)), 0);
  const total = roomTotal + chargesTotal;
  return {
    room,
    roomTotal: roomTotal / 100,
    chargesTotal: chargesTotal / 100,
    total: total / 100,
    depositHeld: held / 100,
    balance: (total - held) / 100,
    needsTopUp: total > held,
  };
}

/** IP-2026-00001: the IST year and a sequence number. */
export function ipNumber(seq: number, at: Date): string {
  const year = new Date(at.getTime() + 330 * 60_000).getUTCFullYear();
  return `IP-${year}-${String(seq).padStart(5, "0")}`;
}
