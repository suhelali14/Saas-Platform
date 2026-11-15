/**
 * The arithmetic on Nayaverse's own invoices, and the module list it sells.
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  financialYear, invoiceLines, invoiceNumber, invoiceTotals, nextPeriodStart, stateFromGstin, type Contract,
} from "../src/lib/billing.js";
import { FEATURES } from "../src/lib/plans.js";

// The clinic API's config validates its environment on import; these are
// placeholders so its module list can be read.
process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/unused";
process.env.JWT_SECRET ??= "test-secret-not-used-for-anything-real-0000";
process.env.REDIS_URL ??= "redis://127.0.0.1:6399";
const { MODULES } = await import("../../clinic-api/src/config/features.js");

const base: Contract = {
  pricingModel: "SETUP_YEARLY", billingCycle: "ANNUAL",
  setupFee: 75000, yearlyFee: 240000, monthlyFee: null, licenceFee: null, amcPercent: null, hostingFee: null,
};
const start = new Date("2026-11-15T12:00:00+05:30");

test("the console sells exactly the modules a clinic can switch on", () => {
  assert.deepEqual(FEATURES.map((f) => f.key).sort(), MODULES.map((m) => m.key).sort());
  for (const f of FEATURES) {
    const m = MODULES.find((x) => x.key === f.key)!;
    assert.equal(f.from, m.from, `${f.key} starts at a different plan in the clinic API`);
  }
});

test("setup + yearly: the first invoice carries both, a renewal only the year", () => {
  const first = invoiceLines(base, { first: true, periodStart: start, planLabel: "Hospital" });
  assert.equal(first.length, 2);
  assert.equal(first.reduce((s, l) => s + l.amount, 0), 315000);
  const renewal = invoiceLines(base, { first: false, periodStart: start, planLabel: "Hospital" });
  assert.equal(renewal.length, 1);
  assert.equal(renewal[0]!.amount, 240000);
});

test("in-state GST splits evenly into CGST and SGST and adds to 18%", () => {
  const t = invoiceTotals([{ description: "x", sac: "998315", amount: 240000 }], true);
  assert.deepEqual(t, { subtotal: 240000, cgst: 21600, sgst: 21600, igst: 0, total: 283200 });
});

test("out-of-state GST is all IGST", () => {
  const t = invoiceTotals([{ description: "x", sac: "998315", amount: 240000 }], false);
  assert.deepEqual(t, { subtotal: 240000, cgst: 0, sgst: 0, igst: 43200, total: 283200 });
});

test("an odd paisa of tax still adds up exactly", () => {
  // 18% of 999.99 is 179.9982, which rounds to 180.00; halves 90.00 each.
  const t = invoiceTotals([{ description: "x", sac: "998315", amount: 999.99 }], true);
  assert.equal(Math.round((t.cgst + t.sgst) * 100), Math.round((t.total - t.subtotal) * 100));
  // 18% of 0.05 is 0.009, which rounds to 0.01 -- one paisa, split 0 + 1.
  const tiny = invoiceTotals([{ description: "x", sac: "998315", amount: 0.05 }], true);
  assert.equal(Math.round(tiny.cgst * 100) + Math.round(tiny.sgst * 100), 1);
});

test("subscription bills the cycle's months", () => {
  const c: Contract = { ...base, pricingModel: "SUBSCRIPTION", billingCycle: "QUARTERLY", monthlyFee: 7000, setupFee: null };
  const lines = invoiceLines(c, { first: true, periodStart: start, planLabel: "Polyclinic" });
  assert.equal(lines.length, 1);
  assert.equal(lines[0]!.amount, 21000);
  assert.equal(nextPeriodStart(c, start).getMonth(), (start.getMonth() + 3) % 12);
});

test("licence + AMC: licence once, then AMC at its percentage plus hosting", () => {
  const c: Contract = { ...base, pricingModel: "LICENCE_AMC", licenceFee: 600000, amcPercent: 20, hostingFee: 36000, setupFee: null, yearlyFee: null };
  const first = invoiceLines(c, { first: true, periodStart: start, planLabel: "Hospital" });
  assert.deepEqual(first.map((l) => l.amount), [600000, 36000]);
  const renewal = invoiceLines(c, { first: false, periodStart: start, planLabel: "Hospital" });
  assert.deepEqual(renewal.map((l) => l.amount), [120000, 36000]);
});

test("zero and missing amounts are left off the invoice", () => {
  const c: Contract = { ...base, setupFee: 0 };
  assert.equal(invoiceLines(c, { first: true, periodStart: start, planLabel: "Clinic" }).length, 1);
});

test("financial years turn over on 1 April", () => {
  assert.equal(financialYear(new Date("2026-03-31T12:00:00")), "2526");
  assert.equal(financialYear(new Date("2026-04-01T12:00:00")), "2627");
});

test("invoice numbers stay within GST's 16 characters", () => {
  const n = invoiceNumber("NAYAVERSE-PLATFORM", start, 12);
  assert.ok(n.length <= 16, n);
  assert.equal(invoiceNumber("NV", start, 7), "NV/2627/0007");
});

test("a GSTIN gives its state; nonsense gives nothing", () => {
  assert.equal(stateFromGstin("27AAPFU0939F1ZV"), "27");
  assert.equal(stateFromGstin("27AAPFU0939F1Z"), null);
  assert.equal(stateFromGstin("99AAPFU0939F1ZV"), null);
  assert.equal(stateFromGstin(""), null);
});
