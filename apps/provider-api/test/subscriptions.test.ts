/**
 * Subscriptions sold from the console: signed calls between servers, the
 * yearly price, what may be bought together, and Razorpay's webhooks.
 */

import { strict as assert } from "node:assert";
import { createHmac } from "node:crypto";
import { test } from "node:test";

process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/unused";
process.env.JWT_SECRET ??= "test-secret-not-used-for-anything-real-0000";
process.env.RAZORPAY_WEBHOOK_SECRET = "rzp-webhook-test";

const { canonical, privateKeyFrom, publicKeyFrom, signRequest, verifyRequest } = await import("../src/lib/s2s.js");
const { priceChoice, runningWhere, withGst, yearlyPaise } = await import("../src/lib/subscriptions.js");
const { parseEvent, validWebhook } = await import("../src/lib/razorpay.js");

// A throwaway key (seed 0x07 x 32). Growth's backend/internal/s2s test checks
// the same signature, so both sides sign and check one way.
const PRIVATE = "MC4CAQAwBQYDK2VwBCIEIAcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcH";
const PUBLIC = "MCowBQYDK2VwAyEA6kpsY+KcUgq+9VB7Ey7F+ZVHdq6+vnuSQh7qaRRG0iw=";
const BODY = '{"ref":"charge-1","businessId":"biz-1"}';
const SIG = "VKBZiiLGlaVfR7yaRp7uJRTeXIXyxlp78rz5iaxF3Ia61OuBmtqJMrWS+9PTMXuOBU0Ip9IxgrKy6uoJAi2GAw==";

test("a signed call is checked against the sender's public key, the body and the time", () => {
  const pub = publicKeyFrom(PUBLIC);
  const at = 1764300000 * 1000;
  assert.ok(verifyRequest(pub, "POST", "/api/s2s/v1/grants", BODY, "1764300000", SIG, at), "the shared vector");
  assert.ok(!verifyRequest(pub, "POST", "/api/s2s/v1/grants", BODY + " ", "1764300000", SIG, at), "a changed body");
  assert.ok(!verifyRequest(pub, "POST", "/api/s2s/v1/grants?x=1", BODY, "1764300000", SIG, at), "a changed path");
  assert.ok(!verifyRequest(pub, "POST", "/api/s2s/v1/grants", BODY, "1764300000", SIG, at + 301_000), "too late: replayed");
  assert.ok(!verifyRequest(pub, "POST", "/api/s2s/v1/grants", BODY, undefined, SIG, at), "no time");
  const fresh = signRequest(privateKeyFrom(PRIVATE), "GET", "/api/provider/s2s/v1/catalog?account=a", "");
  assert.ok(verifyRequest(pub, "GET", "/api/provider/s2s/v1/catalog?account=a", "", fresh.time, fresh.signature));
  assert.match(canonical("post", "/p", "1", ""), /^POST\n\/p\n1\ne3b0c442/);
});

test("a year is twelve months less the discount, to the rupee", () => {
  assert.equal(yearlyPaise(10_000_00, 0), 1_20_000_00);
  assert.equal(yearlyPaise(10_000_00, 15), 1_02_000_00);
  assert.equal(yearlyPaise(999_00, 10), 10_789_00); // 10,789.20 rounds to the rupee
  assert.equal(yearlyPaise(10_000_00, 200), yearlyPaise(10_000_00, 90), "never more than 90% off");
});

const sale = [
  { id: "g:plan-10k", code: "plan-10k", kind: "plan", name: "Starter", summary: "", includes: [], grants: { modules: ["reviews", "whatsapp"] }, monthlyPaise: 10_000_00, yearlyPaise: 1_02_000_00, yearlyDiscountPct: 15, custom: false },
  { id: "g:plan-15k", code: "plan-15k", kind: "plan", name: "Growth", summary: "", includes: [], grants: { modules: ["reviews", "whatsapp", "ads"] }, monthlyPaise: 15_000_00, yearlyPaise: 1_53_000_00, yearlyDiscountPct: 15, custom: false },
  { id: "g:module-reviews", code: "module-reviews", kind: "module", name: "Reviews QR", summary: "", includes: [], grants: { modules: ["reviews"] }, monthlyPaise: 999_00, yearlyPaise: 10_189_00, yearlyDiscountPct: 15, custom: false },
  { id: "g:module-online", code: "module-online", kind: "module", name: "Find customers online", summary: "", includes: [], grants: { modules: ["online"] }, monthlyPaise: 2_999_00, yearlyPaise: 30_590_00, yearlyDiscountPct: 15, custom: false },
];

test("GST is added on top, 18% to the rupee, and the total is what is charged", () => {
  assert.deepEqual(withGst(10_000_00), { subtotalPaise: 10_000_00, gstPercent: 18, gstPaise: 1_800_00, totalPaise: 11_800_00 });
  assert.equal(withGst(12_999_00).gstPaise, 2_340_00, "rounded to the rupee");
  assert.equal(withGst(200_00).totalPaise, 236_00);
});

test("one plan, with single modules beside it only for what it lacks", () => {
  assert.equal(priceChoice(sale, ["plan-10k", "module-online"], "MONTH").amountPaise, 12_999_00);
  assert.equal(priceChoice(sale, ["plan-10k", "module-online"], "YEAR").amountPaise, 1_32_590_00);
  assert.equal(priceChoice(sale, ["module-reviews", "module-online"], "MONTH").chosen.length, 2, "modules alone");
  assert.throws(() => priceChoice(sale, ["plan-10k", "plan-15k"], "MONTH"), /one plan/);
  assert.throws(() => priceChoice(sale, ["plan-10k", "module-reviews"], "MONTH"), /already in Starter/);
  assert.throws(() => priceChoice(sale, ["plan-99k"], "MONTH"), /not on sale/);
  assert.throws(() => priceChoice(sale, [], "MONTH"), /Choose a plan/);
});

test("Razorpay's webhooks are trusted only with its signature, and read for what matters", () => {
  const body = JSON.stringify({
    event: "subscription.charged",
    payload: {
      subscription: { entity: { id: "sub_X1", status: "active", current_start: 1764300000, current_end: 1766978400 } },
      payment: { entity: { id: "pay_P1", amount: 1000000 } },
    },
  });
  const sig = createHmac("sha256", "rzp-webhook-test").update(body).digest("hex");
  assert.ok(validWebhook(body, sig));
  assert.ok(!validWebhook(body, sig.slice(0, -1) + (sig.endsWith("0") ? "1" : "0")));
  assert.ok(!validWebhook(body + " ", sig));
  const e = parseEvent(body)!;
  assert.equal(e.subscriptionId, "sub_X1");
  assert.equal(e.paymentId, "pay_P1");
  assert.equal(e.paymentAmount, 1000000);
  assert.equal(e.currentEnd!.getTime(), 1766978400 * 1000);
  assert.equal(parseEvent(JSON.stringify({ event: "payment.captured", payload: {} })), null, "not a subscription event");
});

test("with real payments on, a test subscription does not hold back a real one", () => {
  assert.deepEqual(runningWhere("GROWTH", "biz-1", "razorpay"), { product: "GROWTH", accountRef: "biz-1", status: "ACTIVE", cancelAtEnd: false, test: false });
  assert.equal("test" in runningWhere("GROWTH", "biz-1", "test"), false, "in test mode, test ones follow each other");
});
