import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clockOf, freeSlots, hashToken, lastTen, localDay, newToken, samePhone, sign, signatureMatches,
  validCallback, weekHours, windowOf,
} from "../src/lib/connector.js";

test("tokens are long, random and stored only as a hash", () => {
  const a = newToken();
  const b = newToken();
  assert.ok(a.startsWith("nvc_") && a.length > 40);
  assert.notEqual(a, b);
  assert.equal(hashToken(a).length, 64);
  assert.notEqual(hashToken(a), hashToken(b));
});

test("confirmations are signed with the token's hash, and checked in constant time", () => {
  const h = hashToken("nvc_example");
  const body = JSON.stringify({ type: "request.confirmed", requestId: "r1" });
  const sig = sign(h, body);
  assert.ok(signatureMatches(h, body, sig));
  assert.ok(!signatureMatches(h, body + " ", sig));
  assert.ok(!signatureMatches(hashToken("nvc_other"), body, sig));
  assert.ok(!signatureMatches(h, body, "zz"));
});

test("the same vector Growth checks (clinicconn_test.go): one scheme on both sides", () => {
  const token = "nvc_vector-token-for-tests";
  const body = JSON.stringify({ type: "request.confirmed", requestId: "req-7", phone: "919800000001", start: "2026-11-30T05:00:00.000Z", doctor: "Dr. Kulkarni" });
  assert.equal(hashToken(token), "950e138503f5ea2496fb8e634d4ab03ef70200bd4a9bb3745fe6a1e1fd245f27");
  assert.equal(sign(hashToken(token), body), "c053a2ebf002591d2b86c71b3de942f4fa214c05b9d3acaf3963cabe5e64683a");
});

test("the settings screen's timings become hours by day", () => {
  assert.equal(clockOf("9:30 am"), "09:30");
  assert.equal(clockOf("1 PM"), "13:00");
  assert.equal(clockOf("18:45"), "18:45");
  assert.equal(clockOf("25:00"), null);
  const week = weekHours([
    { day: "Monday", opensAt: "10:00", closesAt: "13:00" },
    { day: "Tuesday", closed: true },
    { day: "Wednesday", opensAt: "5 pm", closesAt: "9 pm" },
    { day: "Thursday", opensAt: "nonsense", closesAt: "13:00" },
  ]);
  assert.deepEqual(week.mon, { open: "10:00", close: "13:00" });
  assert.equal(week.tue?.closed, true);
  assert.deepEqual(week.wed, { open: "17:00", close: "21:00" });
  assert.equal(week.thu?.closed, true, "unreadable times close the day rather than guess");
  assert.equal(week.fri, undefined);
});

test("free slots skip the past, the closed and the taken", () => {
  const hours = weekHours([{ day: "Monday", opensAt: "10:00", closesAt: "12:00" }]);
  const monday = new Date(2026, 10, 30, 12); // Monday 30 November 2026
  const now = new Date(2026, 10, 30, 9, 0);
  const busy = [{ start: new Date(2026, 10, 30, 10, 30), end: new Date(2026, 10, 30, 10, 45) }];
  const slots = freeSlots({ day: monday, hours, minutes: 15, busy, now });
  const labels = slots.map((d) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`);
  assert.deepEqual(labels, ["10:00", "10:15", "10:45", "11:00", "11:15", "11:30", "11:45"]);
  // Less than half an hour away is not offered.
  const late = freeSlots({ day: monday, hours, minutes: 15, busy: [], now: new Date(2026, 10, 30, 11, 20) });
  assert.equal(late.length, 0, "11:45 is 25 minutes away, so nothing is left that morning");
  // A closed day has none.
  assert.equal(freeSlots({ day: new Date(2026, 11, 1, 12), hours, minutes: 15, busy: [], now }).length, 0);
});

test("one number written two ways is one number", () => {
  assert.equal(lastTen("+91 98765-43210"), "9876543210");
  assert.ok(samePhone("919876543210", "98765 43210"));
  assert.ok(!samePhone("919876543210", "9876543211"));
  assert.ok(!samePhone("", ""));
});

test("days, windows and callbacks", () => {
  assert.equal(localDay("2026-02-31"), null);
  assert.equal(localDay("2026-11-30")?.getHours(), 12);
  assert.equal(windowOf(new Date(2026, 10, 30, 10, 30)), "morning");
  assert.equal(windowOf(new Date(2026, 10, 30, 14, 0)), "afternoon");
  assert.equal(windowOf(new Date(2026, 10, 30, 18, 0)), "evening");
  assert.ok(validCallback("https://growth.nayaverse.in/api/connector/clinic/events?b=1"));
  assert.ok(!validCallback("http://growth.nayaverse.in/x"));
  assert.ok(!validCallback("https://evil.example/nayaverse.in"));
  assert.ok(!validCallback("https://nayaverse.in.evil.example/x"));
});
