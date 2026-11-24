/**
 * The assistant's engine (lib/scribe/engine.ts), with a stand-in host and
 * a stand-in language model.
 *
 * The questions that matter are about money and about safety: is the
 * model left alone when the rules were enough, does a draft still come
 * out when the model is down, and does a medicine reach the doctor
 * matched, checked and honest about where its dose came from.
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { buildDraft, type AssistantHost, type Habit, type ModelNote, type ModelReader } from "../src/lib/scribe/engine.js";

const HABITS: Habit[] = [
  { drugId: "d-dolo", drugName: "Dolo 650 Tablet", composition: "Paracetamol (650mg)", dosage: "1-1-1", frequency: "TDS", duration: "3 days", count: 40 },
  { drugId: "d-azee", drugName: "Azee 500 Tablet", composition: "Azithromycin (500mg)", dosage: "1-0-0", frequency: "OD", duration: "3 days", count: 12 },
];

function host(searched: string[] = []): AssistantHost {
  return {
    labCatalogue: async () => ["Complete Blood Count (CBC)", "ECG"],
    habits: async () => HABITS,
    searchMedicine: async (spoken) => {
      searched.push(spoken);
      return /pan/i.test(spoken)
        ? { hits: [{ id: "d-pan", name: "Pan 40 Tablet", composition: "Pantoprazole (40mg)" }], approximate: false }
        : { hits: [], approximate: false };
    },
  };
}

const emptyNote: ModelNote = {
  chiefComplaint: "", hopi: "", diagnosis: "", advice: "",
  vitals: { bp: "", temp: "", spo2: "", weight: "", pulse: "" },
  medicines: [], labTests: [], followUpInDays: 0, unplaced: [],
};

function reader(note: Partial<ModelNote>, calls: { transcript: string }[] = []): ModelReader {
  return {
    model: "test-model",
    read: async (input) => {
      calls.push({ transcript: input.transcript });
      return { note: { ...emptyNote, ...note }, usage: { model: "test-model", inputTokens: 100, outputTokens: 50 } };
    },
  };
}

const patient = { name: "Ramesh Patil", phone: "9876543210", age: 42, gender: "Male", allergies: null, chronicConditions: null };

test("a dictated note that names its sections never reaches the model", async () => {
  const calls: { transcript: string }[] = [];
  const { draft, usage } = await buildDraft({
    transcript: "Complaint fever for three days. Diagnosis viral fever. Tab Dolo 650 thrice a day for 3 days. Review after 5 days.",
    patient, host: host(), reader: reader({}, calls),
  });
  assert.equal(calls.length, 0);
  assert.equal(usage, null);
  assert.equal(draft.engine.model, null);
  assert.equal(draft.diagnosis, "Viral fever");
  assert.equal(draft.medicines[0]!.drugId, "d-dolo");
  assert.equal(draft.followUpInDays, 5);
});

test("a conversation goes to the model with the patient's name and phone removed", async () => {
  const calls: { transcript: string }[] = [];
  const transcript = "Ramesh ji kya takleef hai. Teen din se bukhar hai doctor. Mera number 9876543210 hai. Theek hai Dolo 650 lijiye.";
  const { draft, usage } = await buildDraft({
    transcript, patient, host: host(),
    reader: reader({ chiefComplaint: "Fever x 3 days", medicines: [{ spoken: "Dolo 650", dosage: "", frequency: "", duration: "", instructions: "", quote: "Theek hai Dolo 650 lijiye" }] }, calls),
  });
  assert.equal(calls.length, 1);
  assert.ok(!/ramesh/i.test(calls[0]!.transcript));
  assert.ok(!calls[0]!.transcript.includes("9876543210"));
  assert.equal(usage?.model, "test-model");
  assert.equal(draft.chiefComplaint, "Fever x 3 days");
});

test("a dose that was not heard is the doctor's usual, and says so", async () => {
  const { draft } = await buildDraft({
    transcript: "Teen din se bukhar hai. Theek hai Dolo 650 lijiye.",
    patient, host: host(),
    reader: reader({ medicines: [{ spoken: "Dolo 650", dosage: "", frequency: "", duration: "", instructions: "", quote: "Theek hai Dolo 650 lijiye" }] }),
  });
  const med = draft.medicines[0]!;
  assert.equal(med.match, "habit");
  assert.equal(med.dosage, "1-1-1");
  assert.equal(med.frequency, "TDS");
  assert.ok(med.notes.some((n) => /your usual/.test(n)));
  // Filled from habit, so it is a note on the line and not a "not heard" flag.
  assert.ok(!draft.flags.some((f) => f.kind === "missing"));
});

test("a field the model left empty is read from the model's own quote", async () => {
  const { draft } = await buildDraft({
    transcript: "Teen din se bukhar hai doctor. Tab Pan 40 likh raha hoon, din mein teen baar, khane ke baad, teen din ke liye.",
    patient, host: host(),
    reader: reader({ medicines: [{ spoken: "Tab Pan 40", dosage: "", frequency: "TDS", duration: "", instructions: "", quote: "Tab Pan 40 likh raha hoon, din mein teen baar, khane ke baad, teen din ke liye" }] }),
  });
  const med = draft.medicines[0]!;
  // Looked up without its form word, so it matches by name.
  assert.equal(med.drugId, "d-pan");
  assert.equal(med.dosage, "1-1-1");
  assert.equal(med.frequency, "TDS");
  assert.equal(med.duration, "3 days");
  assert.ok(!draft.flags.some((f) => f.kind === "missing"));
});

test("when the model and the rules disagree on a medicine, the draft says so", async () => {
  const { draft } = await buildDraft({
    transcript: "Teen din se bukhar hai doctor. Tab Pan 40 twice a day for 5 days.",
    patient, host: host(),
    reader: reader({ medicines: [{ spoken: "Pan 40", dosage: "", frequency: "TDS", duration: "5 days", instructions: "", quote: "Tab Pan 40 twice a day for 5 days" }] }),
  });
  // The model said three times a day; the rules read "twice a day" in the
  // same sentence. Both are shown, and the disagreement is flagged.
  assert.equal(draft.medicines.length, 1);
  assert.equal(draft.medicines[0]!.frequency, "TDS");
  assert.equal(draft.medicines[0]!.dosage, "1-0-1");
  assert.ok(draft.flags.some((f) => f.kind === "conflict" && f.medicine === 0));
});

test("a dose that WAS heard is never replaced by the usual one", async () => {
  const { draft } = await buildDraft({
    transcript: "Complaint fever. Diagnosis viral fever. Tab Dolo 650 twice a day for 5 days.",
    patient, host: host(), reader: null,
  });
  const med = draft.medicines[0]!;
  assert.equal(med.dosage, "1-0-1");
  assert.equal(med.frequency, "BD");
  assert.equal(med.duration, "5 days");
  assert.deepEqual(med.notes, []);
});

test("a different strength is not this doctor's usual medicine", async () => {
  const searched: string[] = [];
  const { draft } = await buildDraft({
    transcript: "Complaint fever. Diagnosis viral fever. Tab Dolo 500 twice a day for 5 days.",
    patient, host: host(searched), reader: null,
  });
  assert.equal(draft.medicines[0]!.match, "none");
  assert.deepEqual(searched, ["Dolo 500"]);
  assert.ok(draft.flags.some((f) => f.kind === "unmatched"));
});

test("a medicine named without 'tab' is still found from the doctor's habits", async () => {
  const { draft } = await buildDraft({
    transcript: "Complaint throat pain. Diagnosis pharyngitis. Azee 500 once daily for 3 days.",
    patient, host: host(), reader: null,
  });
  assert.equal(draft.medicines.length, 1);
  assert.equal(draft.medicines[0]!.drugId, "d-azee");
});

test("an allergy on file is flagged on the draft", async () => {
  const { draft } = await buildDraft({
    transcript: "Complaint fever. Diagnosis viral fever. Tab Dolo 650 twice a day for 5 days.",
    patient: { ...patient, allergies: "Paracetamol" }, host: host(), reader: null,
  });
  assert.ok(draft.flags.some((f) => f.kind === "allergy" && f.level === "danger" && f.medicine === 0));
});

test("when the model is down the rules' reading still comes back, and says why", async () => {
  const broken: ModelReader = { model: "test-model", read: async () => { throw new Error("the provider returned 529"); } };
  const { draft, usage } = await buildDraft({
    transcript: "Teen din se bukhar hai doctor. BP 130 by 80. Tab Pan 40 once daily before food for 2 weeks.",
    patient, host: host(), reader: broken,
  });
  assert.equal(usage, null);
  assert.equal(draft.vitals.bp, "130/80");
  assert.equal(draft.medicines[0]!.drugId, "d-pan");
  assert.ok(draft.flags.some((f) => f.kind === "engine" && /529/.test(f.message)));
});

test("a test the model names that the clinic cannot order is not ordered", async () => {
  const { draft } = await buildDraft({
    transcript: "Teen din se bukhar hai doctor, khansi bhi hai, raat ko zyada hota hai.",
    patient, host: host(),
    reader: reader({ labTests: ["Complete Blood Count (CBC)", "MRI Brain"], followUpInDays: 7 }),
  });
  assert.deepEqual(draft.labTests, ["Complete Blood Count (CBC)"]);
  assert.equal(draft.followUpInDays, 7);
});

test("a number the rules read exactly is not overwritten by the model's", async () => {
  const { draft } = await buildDraft({
    transcript: "Teen din se bukhar hai doctor, khansi bhi hai. BP 130 by 80 hai aapka.",
    patient, host: host(),
    reader: reader({ vitals: { bp: "180/30", temp: "", spo2: "", weight: "", pulse: "92" } }),
  });
  assert.equal(draft.vitals.bp, "130/80");
  assert.equal(draft.vitals.pulse, "92");
});
