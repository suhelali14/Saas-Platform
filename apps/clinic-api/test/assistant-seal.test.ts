/**
 * The seal on a confirm card (lib/assistant/seal.ts).
 *
 * A card says "Write this prescription for Ramesh Joshi?". These check
 * that pressing Confirm can only ever do that: not the same thing to the
 * patient who is on screen by then, not a different thing to the same
 * patient, and not by somebody else.
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";

process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/unused";
process.env.JWT_SECRET ??= "test-secret-not-used-for-anything-real-0000";
process.env.REDIS_URL ??= "redis://127.0.0.1:6399";

const { seal, sealIsValid } = await import("../src/lib/assistant/seal.js");

const card = {
  action: "write_prescription",
  params: { medicines: [{ name: "Dolo 650 Tablet", dosage: "1-0-1", frequency: "BD", duration: "3 days" }] },
  patientId: "patient-ramesh",
  appointmentId: "visit-1",
  userId: "doctor-1",
};

test("a card confirmed exactly as it was shown is accepted", () => {
  assert.equal(sealIsValid(card, seal(card)), true);
});

test("the order its details come back in does not matter", () => {
  const reordered = {
    userId: card.userId,
    appointmentId: card.appointmentId,
    patientId: card.patientId,
    params: { medicines: [{ duration: "3 days", frequency: "BD", dosage: "1-0-1", name: "Dolo 650 Tablet" }] },
    action: card.action,
  };
  assert.equal(sealIsValid(reordered, seal(card)), true);
});

test("a card drawn up for one patient cannot be confirmed for another", () => {
  // The doctor asked on Ramesh's visit, opened the next patient, and
  // pressed Confirm on the card still showing.
  assert.equal(sealIsValid({ ...card, patientId: "patient-next", appointmentId: "visit-2" }, seal(card)), false);
  assert.equal(sealIsValid({ ...card, appointmentId: null }, seal(card)), false);
});

test("a card whose details were changed is refused", () => {
  const stronger = { ...card, params: { medicines: [{ name: "Dolo 650 Tablet", dosage: "2-2-2", frequency: "TDS", duration: "30 days" }] } };
  assert.equal(sealIsValid(stronger, seal(card)), false);
  assert.equal(sealIsValid({ ...card, action: "issue_certificate" }, seal(card)), false);
});

test("a card drawn up for one person cannot be confirmed by another", () => {
  assert.equal(sealIsValid({ ...card, userId: "reception-1" }, seal(card)), false);
});

test("no seal, or a made-up one, is refused", () => {
  assert.equal(sealIsValid(card, undefined), false);
  assert.equal(sealIsValid(card, ""), false);
  assert.equal(sealIsValid(card, "not-a-seal"), false);
});
