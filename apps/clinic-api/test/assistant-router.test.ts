/**
 * The assistant's rule router (lib/assistant/router.ts).
 *
 * Every request a rule recognises is one that costs nothing and answers
 * at once. Every request a rule MIS-recognises is the assistant doing
 * something that was not asked for. So half of these check that the
 * everyday is caught, in three languages, and half that the near-misses
 * are let through to the model.
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readDate, route } from "../src/lib/assistant/router.js";

const today = new Date(2026, 10, 25, 12); // 25 November 2026
const onPatient = { today, hasPatient: true };
const noPatient = { today, hasPatient: false };

test("a screen is opened by its everyday names, in three languages", () => {
  assert.deepEqual(route("open billing", noPatient), { action: "open_screen", params: { screen: "billing" } });
  assert.deepEqual(route("go to the queue", noPatient), { action: "open_screen", params: { screen: "queue" } });
  assert.deepEqual(route("pharmacy kholo", noPatient), { action: "open_screen", params: { screen: "pharmacy" } });
  assert.deepEqual(route("लॅब उघडा", noPatient), { action: "open_screen", params: { screen: "labs" } });
  assert.deepEqual(route("show me the follow-ups", noPatient), { action: "open_screen", params: { screen: "reminders" } });
  assert.deepEqual(route("settings dikhao", noPatient), { action: "open_screen", params: { screen: "settings" } });
});

test("a long sentence that only contains a screen's name is not a request to open it", () => {
  assert.equal(route("can you open a new bill for the dressing we did and add the injection charge to it", noPatient), null);
});

test("questions about the patient on screen are answered about them", () => {
  assert.equal(route("show her last prescription", onPatient)?.action, "last_prescription");
  assert.equal(route("pichli dawai kya thi", onPatient)?.action, "last_prescription");
  assert.equal(route("मागची औषधे दाखवा", onPatient)?.action, "last_prescription");
  assert.equal(route("lab reports aaye kya", onPatient)?.action, "lab_results");
  assert.equal(route("any allergies?", onPatient)?.action, "patient_brief");
  assert.equal(route("give me a summary", onPatient)?.action, "patient_brief");
  assert.equal(route("BP trend", onPatient)?.action, "vitals_trend");
  assert.equal(route("how much does she owe", onPatient)?.action, "patient_dues");
  assert.equal(route("show past visits", onPatient)?.action, "visit_history");
});

test("the same questions with nobody on screen go to the model, which can ask who", () => {
  assert.equal(route("show her last prescription", noPatient), null);
  assert.equal(route("any allergies?", noPatient), null);
});

test("a visit is found by the day it happened", () => {
  assert.deepEqual(route("what happened on the visit of 12 October", onPatient), { action: "visit_on_date", params: { date: "2026-10-12" } });
  assert.deepEqual(route("12/10 ko kya prescription diya tha", onPatient), { action: "visit_on_date", params: { date: "2026-10-12" } });
  assert.deepEqual(route("yesterday's visit note", onPatient), { action: "visit_on_date", params: { date: "2026-11-24" } });
});

test("a date with no year is the most recent one that has happened", () => {
  assert.equal(readDate("12 October", today), "2026-10-12");
  // In November, "5 December" with no year is last December.
  assert.equal(readDate("5 December", today), "2025-12-05");
  assert.equal(readDate("March 3rd 2025", today), "2025-03-03");
  assert.equal(readDate("परवा", today), "2026-11-23");
  assert.equal(readDate("3 days ago", today), "2026-11-22");
  assert.equal(readDate("31 February", today), null);
  assert.equal(readDate("open billing", today), null);
});

test("questions about the day", () => {
  assert.equal(route("who is next", noPatient)?.action, "queue_summary");
  assert.equal(route("kitne patient baki hain", noPatient)?.action, "queue_summary");
  assert.equal(route("किती पेशंट आहेत", noPatient)?.action, "queue_summary");
  assert.equal(route("what needs my attention", noPatient)?.action, "needs_attention");
  assert.equal(route("follow-ups due today", noPatient)?.action, "followups_due");
  assert.equal(route("aaj ka collection kitna hua", noPatient)?.action, "todays_collection");
});

test("a patient is found by name, phone or file number", () => {
  assert.deepEqual(route("find patient Ramesh Joshi", noPatient), { action: "find_patient", params: { query: "Ramesh Joshi" } });
  assert.deepEqual(route("Sunita Patil ki file kholo", noPatient), { action: "find_patient", params: { query: "Sunita Patil" } });
  assert.deepEqual(route("ATC-00012", noPatient), { action: "find_patient", params: { query: "ATC-00012" } });
  assert.deepEqual(route("98220 41187", noPatient), { action: "find_patient", params: { query: "9822041187" } });
});

test("vitals said as numbers on an open visit are recorded by rule", () => {
  const onVisit = { today, hasPatient: true, hasVisit: true };
  assert.deepEqual(route("BP is 142 by 90 and weight 77", onVisit), { action: "record_vitals", params: { bp: "142/90", weight: "77" } });
  assert.deepEqual(route("temperature 100.4, pulse 96, SpO2 98", onVisit), { action: "record_vitals", params: { temp: "100.4", pulse: "96", spo2: "98" } });
  // A question about vitals is not a recording of them.
  assert.equal(route("show BP trend", onVisit)?.action, "vitals_trend");
  // A number that is not a vital means the remark says more than vitals.
  assert.equal(route("BP 142 by 90, give Amlodipine 5 for 30 days", onVisit), null);
  // With no visit open there is nowhere to record them.
  assert.equal(route("BP is 142 by 90", onPatient), null);
});

test("anything a rule does not recognise is left for the model", () => {
  assert.equal(route("add her husband Rajesh to the family, he has diabetes", onPatient), null);
  assert.equal(route("book her again after two weeks with Dr Meera", onPatient), null);
  assert.equal(route("which patients with diabetes have not come in three months", noPatient), null);
  assert.equal(route("", noPatient), null);
});
