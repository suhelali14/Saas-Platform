/**
 * Inpatient bills: what a family is asked to pay at discharge.
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { ipNumber, roomLines, stayBill } from "../src/lib/ipd.js";

const H = 3_600_000;
const t0 = new Date("2026-11-10T10:00:00+05:30");
const at = (hours: number) => new Date(t0.getTime() + hours * H);

test("a stay of a few hours is still one day", () => {
  const lines = roomLines([{ wardName: "General", dailyRate: 1500, at: t0 }], at(5));
  assert.equal(lines[0]!.days, 1);
  assert.equal(lines[0]!.amount, 1500);
});

test("each 24 hours started is a day", () => {
  const lines = roomLines([{ wardName: "General", dailyRate: 1500, at: t0 }], at(49));
  assert.equal(lines[0]!.days, 3);
  assert.equal(lines[0]!.amount, 4500);
});

test("a transfer bills each ward at its own rate, at the rate when moved in", () => {
  const lines = roomLines(
    [{ wardName: "ICU", dailyRate: 6000, at: t0 }, { wardName: "Private", dailyRate: 3500, at: at(30) }],
    at(70),
  );
  assert.deepEqual(lines.map((l) => [l.wardName, l.days, l.amount]), [["ICU", 2, 12000], ["Private", 2, 7000]]);
});

test("a short stop on the way is not a day of its own", () => {
  const lines = roomLines(
    [{ wardName: "Casualty", dailyRate: 2000, at: t0 }, { wardName: "General", dailyRate: 1500, at: at(2) }],
    at(20),
  );
  assert.deepEqual(lines.map((l) => l.days), [0, 1]);
});

test("the bill: room + charges, against the deposit", () => {
  const b = stayBill(
    [{ wardName: "General", dailyRate: 1500, at: t0 }],
    [{ category: "DOCTOR_VISIT", description: "Visit", quantity: 2, rate: 500 }, { category: "LAB", description: "CBC", quantity: 1, rate: 350.5 }],
    [{ kind: "ADVANCE", amount: 5000 }, { kind: "ADVANCE", amount: 2000 }, { kind: "REFUND", amount: 500 }],
    at(47),
  );
  assert.equal(b.roomTotal, 3000);
  assert.equal(b.chargesTotal, 1350.5);
  assert.equal(b.total, 4350.5);
  assert.equal(b.depositHeld, 6500);
  assert.equal(b.balance, -2149.5, "the rest of the deposit is a refund");
  assert.equal(b.needsTopUp, false);
});

test("when the bill passes the deposit, it asks for a top-up", () => {
  const b = stayBill([{ wardName: "ICU", dailyRate: 6000, at: t0 }], [], [{ kind: "ADVANCE", amount: 10000 }], at(50));
  assert.equal(b.total, 18000);
  assert.equal(b.needsTopUp, true);
  assert.equal(b.balance, 8000);
});

test("IP numbers carry the Indian year", () => {
  assert.equal(ipNumber(7, new Date("2026-12-31T20:00:00Z")), "IP-2027-00007"); // 01:30 IST on 1 Jan
  assert.equal(ipNumber(42, t0), "IP-2026-00042");
});
