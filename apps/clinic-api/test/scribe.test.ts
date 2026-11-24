/**
 * The assistant's own structuring layer (lib/scribe/structure.ts) and the
 * safety checks on a draft (lib/scribe/checks.ts).
 *
 * These rules decide what is offered to a doctor as a prescription line,
 * so the cases here are the ones where a careless rule writes something
 * that was never said: a medicine's strength read as a pulse, "do an ECG"
 * read as the number two, a course of tablets read as a follow-up date.
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  normaliseNumbers, readVitals, readSchedule, readDuration, readMedicines,
  readFollowUp, readLabTests, structureLocally,
} from "../src/lib/scribe/structure.js";
import { checkDraft, mergeMedicines, removeIdentifiers, type DraftMedicine } from "../src/lib/scribe/checks.js";

const LABS = ["Complete Blood Count (CBC)", "ECG", "Chest X-Ray", "HbA1c", "Blood Sugar - Fasting", "Thyroid Profile (T3, T4, TSH)"];

test("numbers are read in English, Hindi and Marathi", () => {
  assert.equal(normaliseNumbers("five days"), "5 days");
  assert.equal(normaliseNumbers("पांच दिन"), "5 दिन");
  assert.equal(normaliseNumbers("पाच दिवस"), "5 दिवस");
  assert.equal(normaliseNumbers("५ दिवस"), "5 दिवस");
});

test("'do' is two before a unit and an English verb everywhere else", () => {
  assert.equal(normaliseNumbers("do baar lena"), "2 baar lena");
  assert.equal(normaliseNumbers("do an ECG"), "do an ECG");
});

test("vitals are read with their numbers", () => {
  const { vitals } = readVitals("BP 130 by 80, pulse 88, temperature 99.4, SpO2 97, weight 72 kg");
  assert.deepEqual(vitals, { bp: "130/80", pulse: "88", temp: "99.4", spo2: "97", weight: "72" });
});

test("a medicine's strength is never recorded as a vital", () => {
  // The speech engine runs these together; 650 is not a pulse.
  assert.equal(readVitals("pulse Tab Dolo 650 twice a day").vitals.pulse, undefined);
  assert.equal(readVitals("temperature normal, give 500 mg").vitals.temp, undefined);
});

test("a schedule said as a pattern keeps the pattern", () => {
  assert.deepEqual(readSchedule("1-0-1 for 5 days"), { frequency: "BD", dosage: "1-0-1" });
  assert.deepEqual(readSchedule("one zero one"), { frequency: "BD", dosage: "1-0-1" });
  assert.deepEqual(readSchedule("1/2-0-1/2"), { frequency: "BD", dosage: "1/2-0-1/2" });
});

test("a schedule said in words becomes the pattern it means", () => {
  assert.deepEqual(readSchedule("twice a day"), { frequency: "BD", dosage: "1-0-1" });
  assert.deepEqual(readSchedule("दिन में तीन बार"), { frequency: "TDS", dosage: "1-1-1" });
  assert.deepEqual(readSchedule("दिवसातून दोन वेळा"), { frequency: "BD", dosage: "1-0-1" });
  assert.deepEqual(readSchedule("रात को सोते समय"), { frequency: "OD", dosage: "0-0-1" });
  assert.deepEqual(readSchedule("सुबह शाम"), { frequency: "BD", dosage: "1-0-1" });
});

test("as-needed is a frequency, not a pattern, and nothing is invented", () => {
  assert.deepEqual(readSchedule("if needed"), { frequency: "SOS", dosage: "" });
  assert.deepEqual(readSchedule("1-0-1 if needed"), { frequency: "SOS", dosage: "1-0-1" });
  assert.deepEqual(readSchedule("give it to him"), { frequency: "", dosage: "" });
});

test("durations come out in the form the pharmacy already reads", () => {
  assert.equal(readDuration("for five days"), "5 days");
  assert.equal(readDuration("1 week"), "1 week");
  assert.equal(readDuration("दो हफ्ते"), "2 weeks");
  assert.equal(readDuration("तीन दिवस"), "3 days");
  assert.equal(readDuration("until better"), "");
});

test("medicines are split, each with its own instructions", () => {
  const meds = readMedicines("Tab Dolo 650 twice a day for five days after food, Cap Pan 40 once daily before food for 2 weeks.");
  assert.equal(meds.length, 2);
  assert.deepEqual(
    { ...meds[0], source: undefined },
    { spoken: "Dolo 650", dosage: "1-0-1", frequency: "BD", duration: "5 days", instructions: "After food", source: undefined },
  );
  assert.equal(meds[1]!.spoken, "Pan 40");
  assert.equal(meds[1]!.frequency, "OD");
  assert.equal(meds[1]!.duration, "2 weeks");
  assert.equal(meds[1]!.instructions, "Before food");
});

test("a dose that was not said stays empty", () => {
  const [med] = readMedicines("Syrup Ascoril for cough");
  assert.equal(med!.spoken, "Ascoril");
  assert.equal(med!.dosage, "");
  assert.equal(med!.frequency, "");
  assert.equal(med!.duration, "");
});

test("a pattern right after the name is the dose, not the strength", () => {
  const [med] = readMedicines("Tab Pan 1-0-0 for 10 days");
  assert.equal(med!.spoken, "Pan");
  assert.equal(med!.dosage, "1-0-0");
});

test("a follow-up is read, and a course of tablets is not one", () => {
  assert.equal(readFollowUp("Come back after one week").days, 7);
  assert.equal(readFollowUp("पांच दिन बाद फिर से आना").days, 5);
  assert.equal(readFollowUp("Tab Dolo 650 for 5 days and review").days, null);
});

test("Hindi written in Latin letters, as a speech engine writes it, is read too", () => {
  const [med] = readMedicines("Tab Azithromycin 500 roz ek baar, teen din");
  // "roz" is "daily": the start of the instructions, not part of the name.
  assert.equal(med!.spoken, "Azithromycin 500");
  assert.equal(med!.frequency, "OD");
  assert.equal(med!.duration, "3 days");
  assert.equal(readFollowUp("Paanch din baad phir dikhaiye").days, 5);
});

test("tests are matched to the clinic's own list and never added to it", () => {
  assert.deepEqual(readLabTests("do a CBC and an ECG", LABS).sort(), ["Complete Blood Count (CBC)", "ECG"]);
  assert.deepEqual(readLabTests("get an MRI brain", LABS), []);
});

test("a dictated note that names its sections needs nothing else", () => {
  const draft = structureLocally(
    "Complaint fever and body ache for three days. Diagnosis viral fever. BP 120 by 80. " +
      "Tab Dolo 650 thrice a day for 3 days after food. Do a CBC. Review after 5 days.",
    LABS,
  );
  assert.equal(draft.chiefComplaint, "Fever and body ache for three days");
  assert.equal(draft.diagnosis, "Viral fever");
  assert.equal(draft.vitals.bp, "120/80");
  assert.equal(draft.medicines.length, 1);
  assert.deepEqual(draft.labTests, ["Complete Blood Count (CBC)"]);
  assert.equal(draft.followUpInDays, 5);
  assert.equal(draft.hasSections, true);
  assert.deepEqual(draft.leftover, []);
  assert.equal(draft.coverage, 1);
});

test("'no history of diabetes' is not the history section", () => {
  const draft = structureLocally("There is no history of diabetes in the family.");
  assert.equal(draft.hopi, "");
});

test("a conversation leaves its unplaced sentences for the model", () => {
  const draft = structureLocally(
    "Doctor saab teen din se bukhar hai aur khansi bhi hai. Raat ko zyada hota hai. BP 110 by 70.",
  );
  assert.equal(draft.hasSections, false);
  assert.equal(draft.leftover.length, 2);
  assert.ok(draft.coverage < 0.5);
});

// ── Checks on a draft ────────────────────────────────────────────────

const med = (over: Partial<DraftMedicine>): DraftMedicine => ({
  spoken: "dolo 650", drugId: "d1", drugName: "Dolo 650 Tablet", composition: "Paracetamol (650mg)", match: "catalogue",
  approximate: false, alternatives: [], dosage: "1-0-1", frequency: "BD", duration: "5 days", instructions: "",
  source: "Tab Dolo 650 twice a day for five days", notes: [], ...over,
});

test("a medicine the patient is allergic to is flagged, by brand or by salt", () => {
  const transcript = "Tab Dolo 650 twice a day for five days";
  const bySalt = checkDraft({ medicines: [med({})], transcript, allergies: "Paracetamol, dust" });
  assert.ok(bySalt.some((f) => f.kind === "allergy" && f.level === "danger"));
  const none = checkDraft({ medicines: [med({})], transcript, allergies: "Penicillin" });
  assert.ok(!none.some((f) => f.kind === "allergy"));
});

test("an allergy recorded as a family is flagged for a member of it", () => {
  const amoxy = med({ drugName: "Mox 500 Capsule", composition: "Amoxycillin (500mg)", spoken: "mox 500", source: "Cap Mox 500 thrice a day" });
  const flags = checkDraft({ medicines: [amoxy], transcript: "Cap Mox 500 thrice a day", allergies: "Penicillin" });
  assert.ok(flags.some((f) => f.kind === "allergy" && /may be related/.test(f.message)));

  const septran = med({ drugName: "Septran DS Tablet", composition: "Sulfamethoxazole (800mg) + Trimethoprim (160mg)", spoken: "septran", source: "Tab Septran twice a day" });
  assert.ok(checkDraft({ medicines: [septran], transcript: "Tab Septran twice a day", allergies: "Sulfa drugs" }).some((f) => f.kind === "allergy"));

  // "drugs" on the allergy line is not a substance: paracetamol is not flagged.
  assert.ok(!checkDraft({ medicines: [med({})], transcript: "Tab Dolo 650 twice a day for five days", allergies: "Sulfa drugs" }).some((f) => f.kind === "allergy"));
});

test("missing dose, unmatched name and a repeat are each said plainly", () => {
  const transcript = "Tab Dolo 650 twice a day for five days";
  const flags = checkDraft({
    medicines: [med({ dosage: "", frequency: "" }), med({ drugId: null, match: "none", spoken: "zerodol", drugName: "zerodol" }), med({})],
    transcript,
    allergies: null,
  });
  assert.ok(flags.some((f) => f.kind === "missing"));
  assert.ok(flags.some((f) => f.kind === "unmatched"));
  assert.ok(flags.some((f) => f.kind === "duplicate"));
});

test("a line whose source is not in the transcript is flagged as unverified", () => {
  const flags = checkDraft({ medicines: [med({ source: "Tab Crocin at night" })], transcript: "Tab Dolo 650 twice a day", allergies: null });
  assert.ok(flags.some((f) => f.kind === "unverified"));
});

test("the model's medicines and the rules' are merged, not doubled", () => {
  const merged = mergeMedicines(
    [{ spoken: "Dolo 650", dosage: "", frequency: "", duration: "", instructions: "", source: "Tab Dolo 650 twice a day for 5 days" }],
    [
      { spoken: "dolo 650", dosage: "1-0-1", frequency: "BD", duration: "5 days", instructions: "", source: "Tab Dolo 650 twice a day for 5 days" },
      { spoken: "Pan 40", dosage: "1-0-0", frequency: "OD", duration: "5 days", instructions: "Before food", source: "Cap Pan 40 once daily" },
    ],
  );
  assert.equal(merged.length, 2);
  // What the rules read exactly fills what the model left empty.
  assert.equal(merged[0]!.dosage, "1-0-1");
  assert.equal(merged[0]!.frequency, "BD");
  assert.equal(merged[1]!.spoken, "Pan 40");
});

test("the patient's name and phone are taken out before text leaves the clinic", () => {
  const out = removeIdentifiers("Ramesh Patil ji, aapka number 9876543210 hai na? Ramesh, baithiye.", { name: "Ramesh Patil", phone: "98765 43210" });
  assert.ok(!/ramesh/i.test(out));
  assert.ok(!/patil/i.test(out));
  assert.ok(!out.includes("9876543210"));
});
