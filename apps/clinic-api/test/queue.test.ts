/**
 * The visit-time rules in lib/queue.ts.
 *
 * These decide the waiting time on the front desk's screen, so the cases
 * that matter are the ones where a careless rule shows a wrong number: a
 * re-save that resets a wait, a skipped stage that leaves a time empty, an
 * undo that leaves a patient "arrived" who has gone home.
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { stampsFor } from "../src/lib/queue.js";

const blank = { status: "SCHEDULED", tokenNumber: null, checkedInAt: null, startedAt: null, completedAt: null };
const now = new Date("2026-11-09T10:15:00+05:30");
const earlier = new Date("2026-11-09T09:40:00+05:30");

test("checking in stamps arrival and asks for a token", () => {
  const s = stampsFor(blank, "CHECKED_IN", now);
  assert.equal(s.checkedInAt, now);
  assert.equal(s.needsToken, true);
  assert.equal(s.startedAt, undefined);
});

test("a visit that already has a token never gets a second one", () => {
  const s = stampsFor({ ...blank, tokenNumber: 4 }, "CHECKED_IN", now);
  assert.equal(s.needsToken, false);
});

test("calling a patient in keeps their arrival time", () => {
  const s = stampsFor({ ...blank, status: "CHECKED_IN", tokenNumber: 4, checkedInAt: earlier }, "IN_PROGRESS", now);
  assert.equal(s.checkedInAt, undefined, "arrival must not move");
  assert.equal(s.startedAt, now);
});

test("calling in someone never marked arrived records both", () => {
  const s = stampsFor(blank, "IN_PROGRESS", now);
  assert.equal(s.checkedInAt, now);
  assert.equal(s.startedAt, now);
  assert.equal(s.needsToken, true);
});

test("finishing records the end and leaves the start alone", () => {
  const s = stampsFor({ ...blank, status: "IN_PROGRESS", tokenNumber: 4, checkedInAt: earlier, startedAt: earlier }, "COMPLETED", now);
  assert.equal(s.completedAt, now);
  assert.equal(s.startedAt, undefined);
});

test("an undone check-in clears arrival but keeps the token", () => {
  const s = stampsFor({ ...blank, status: "CHECKED_IN", tokenNumber: 4, checkedInAt: earlier }, "SCHEDULED", now);
  assert.equal(s.checkedInAt, null);
  assert.equal(s.needsToken, false);
  assert.equal("tokenNumber" in s, false, "the token is not touched");
});

test("sending a patient back to wait clears the start, not the arrival", () => {
  const s = stampsFor({ ...blank, status: "IN_PROGRESS", tokenNumber: 4, checkedInAt: earlier, startedAt: earlier }, "CHECKED_IN", now);
  assert.equal(s.startedAt, null);
  assert.equal(s.checkedInAt, undefined);
});

test("cancelling or a no-show leaves every time as it was", () => {
  const existing = { ...blank, status: "CHECKED_IN", tokenNumber: 4, checkedInAt: earlier };
  for (const next of ["CANCELLED", "NO_SHOW"] as const) {
    const s = stampsFor(existing, next, now);
    assert.deepEqual(s, { needsToken: false });
  }
});

test("reopening a finished visit clears its end", () => {
  const s = stampsFor({ ...blank, status: "COMPLETED", tokenNumber: 4, checkedInAt: earlier, startedAt: earlier, completedAt: earlier }, "IN_PROGRESS", now);
  assert.equal(s.completedAt, null);
  assert.equal(s.startedAt, undefined, "the original start stays");
});
