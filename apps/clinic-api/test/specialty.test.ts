/**
 * Specialty records: the dates a pregnancy is run on, what a form accepts,
 * and the line that keeps fetal sex out of every record.
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { cleanData, cleanOwnFields, compute, describe, eddFromLmp, gestationalAge, isValidDay, pcpndtRefusal, reconcileFields } from "../src/lib/specialty-forms.js";
import { LIBRARY, LIBRARY_BY_KEY } from "../src/lib/specialty-library.js";

const form = (key: string) => LIBRARY_BY_KEY.get(key)!;

test("EDD is the LMP plus 280 days, across a year end", () => {
  assert.equal(eddFromLmp("2026-05-01"), "2027-02-05");
  assert.equal(eddFromLmp("2026-02-30"), null);
  assert.equal(eddFromLmp("not a date"), null);
});

test("weeks of pregnancy count from the LMP, or from a dating scan when there is one", () => {
  assert.equal(gestationalAge("2026-07-10", { lmp: "2026-05-01" })?.text, "10w 0d");
  assert.equal(gestationalAge("2026-07-13", { lmp: "2026-05-01" })?.text, "10w 3d");
  // The scan puts the pregnancy a week behind the LMP: its EDD wins.
  assert.equal(gestationalAge("2026-07-10", { lmp: "2026-05-01", usg_edd: "2027-02-12" })?.text, "9w 0d");
  assert.equal(gestationalAge("2026-04-01", { lmp: "2026-05-01" }), null, "before the LMP is not a pregnancy");
  assert.equal(gestationalAge("2027-06-01", { lmp: "2026-05-01" }), null, "past 45 weeks is a mistake, not a number");
});

test("an antenatal visit's weeks come from the pregnancy it belongs to", () => {
  const out = compute(form("antenatal").sections, { weight: 58 }, { recordedOn: "2026-10-23", episode: { lmp: "2026-05-01" } });
  assert.equal(out.ga, "25w 0d");
  assert.equal(out.weight, 58);
});

test("the pregnancy's own EDD and BMI are filled in", () => {
  const out = compute(form("pregnancy").sections, { lmp: "2026-05-01", pre_weight: 54, height: 155 }, { recordedOn: "2026-06-01" });
  assert.equal(out.edd, "2027-02-05");
  assert.equal(out.bmi, 22.5);
});

test("day of the cycle counts the first day of the period as day 1", () => {
  const out = compute(form("follicular").sections, { cycle_lmp: "2026-11-01" }, { recordedOn: "2026-11-12" });
  assert.equal(out.cycle_day, 12);
});

test("a child's age at a visit comes from the date of birth", () => {
  const out = compute(form("child_growth").sections, {}, { recordedOn: "2026-11-15", patient: { dob: "2025-02-20" } });
  assert.equal(out.age, "20 months");
  const older = compute(form("child_growth").sections, {}, { recordedOn: "2026-11-15", patient: { dob: "2019-08-01" } });
  assert.equal(older.age, "7 years 3 months");
});

test("a form keeps only what it asks for, in the shape it asks", () => {
  const { data, errors } = cleanData(form("antenatal").sections, {
    weight: "58.5", bp_systolic: 110, bp_diastolic: "70", oedema: "Feet", ifa: true,
    complaints: ["Headache", "Headache"], ga: "99w", hacked: "<script>",
  });
  assert.deepEqual(errors, []);
  assert.deepEqual(data, { complaints: ["Headache"], weight: 58.5, bp_systolic: 110, bp_diastolic: 70, oedema: "Feet", ifa: true });
});

test("out-of-range numbers, unknown choices and bad dates are refused with the field named", () => {
  const { errors } = cleanData(form("antenatal").sections, { weight: 900, oedema: "Everywhere", next_visit: "2026-13-01" });
  assert.equal(errors.length, 3);
  assert.match(errors.join(" "), /Weight must be between 25 and 200 kg/);
  assert.match(errors.join(" "), /Oedema/);
  assert.match(errors.join(" "), /Next visit is not a valid date/);
});

test("a table with fixed rows keeps each answer on its row, and drops empty rows", () => {
  const { data, errors } = cleanData(form("eye_exam").sections, {
    refraction: [{ row: "Left eye", sph: -1.5, axis: 90 }, { row: "Right eye" }, { row: "Third eye", sph: 2 }],
  });
  assert.deepEqual(errors, []);
  assert.deepEqual(data.refraction, [{ row: "Left eye", sph: -1.5, axis: 90 }]);
});

test("a vaccine table takes extra rows the clinic adds", () => {
  const { data } = cleanData(form("immunisation").sections, {
    doses: [{ row: "BCG (birth)", given_on: "2025-01-02" }, { row: "Rabies (pre-exposure)", given_on: "2026-03-01" }],
  });
  assert.deepEqual(data.doses, [{ row: "BCG (birth)", given_on: "2025-01-02" }, { row: "Rabies (pre-exposure)", given_on: "2026-03-01" }]);
});

test("a record reads back as one line, with blood pressure written the way it is on paper", () => {
  const line = describe(form("antenatal"), { ga: "24w 3d", weight: 58, bp_systolic: 110, bp_diastolic: 70, fundal_height: 24 });
  assert.equal(line, "24w 3d · Weight 58 kg · BP 110/70 mmHg · FH 24 cm");
});

test("summaries use the card's abbreviations, print dates as dates, and say yes or no plainly", () => {
  const preg = describe(form("pregnancy"), { lmp: "2026-02-14", edd: "2026-11-21", gravida: 2, para: 1, living: 1, abortions: 0, high_risk: true });
  assert.equal(preg, "LMP 14 Feb 2026 · EDD 21 Nov 2026 · G 2 · P 1 · L 1 · A 0 · High risk: yes");
  assert.equal(describe(form("immunisation"), { doses: [{ row: "BCG (birth)", given_on: "2025-01-02" }, { row: "OPV 0 (birth)", given_on: "2025-01-02" }] }), "2 doses recorded");
  assert.equal(describe(form("semen_analysis"), { count: 11, impression: "Low count (oligozoospermia)" }), "Count 11 million/mL · Low count (oligozoospermia)");
});

test("no built-in form asks for the sex of a fetus", () => {
  for (const f of LIBRARY) {
    for (const field of [...f.sections, ...(f.closeSections ?? [])].flatMap((s) => s.fields)) {
      for (const label of [field.label, ...(field.columns ?? []).map((c) => c.label)]) {
        assert.equal(pcpndtRefusal(label, f), null, `${f.key}.${field.key}: "${label}"`);
      }
    }
  }
});

test("a clinic cannot add a field that records the sex of a fetus", () => {
  const preg = form("pregnancy");
  assert.ok(pcpndtRefusal("Sex of baby", preg));
  assert.ok(pcpndtRefusal("Gender", preg), "any mention of sex on a pregnancy form");
  assert.ok(pcpndtRefusal("Fetal sex on scan", form("gynae_visit")));
  assert.ok(pcpndtRefusal("गर्भ लिंग"));
  assert.equal(pcpndtRefusal("Partner's occupation", preg), null);
  assert.equal(pcpndtRefusal("Gender identity", form("mental_health")), null, "elsewhere, sex alone is not about a fetus");
  const { errors } = cleanOwnFields([{ label: "Baby", type: "select", options: ["Boy", "Girl"] }], preg);
  assert.equal(errors.length > 0, true, "a choice list is checked too");
});

test("a clinic's own fields get stable keys that cannot collide with built-in ones", () => {
  const { fields, errors } = cleanOwnFields([
    { label: "Husband's education", type: "text" },
    { label: "Husband's education", type: "text" },
    { label: "Kept key", type: "number", unit: "cm", key: "c_kept" },
    { label: "No choices", type: "select" },
  ], undefined, [{ key: "c_kept", label: "Kept key", type: "number" }]);
  assert.deepEqual(fields.map((f) => f.key), ["c_husband_s_education", "c_husband_s_education_2", "c_kept"]);
  assert.equal(fields[2]!.unit, "cm");
  assert.equal(errors.length, 1);
});

test("every library form is well formed: unique keys, choices where needed, episodes linked to their visits", () => {
  const keys = new Set<string>();
  for (const f of LIBRARY) {
    assert.ok(!keys.has(f.key), `duplicate form ${f.key}`);
    keys.add(f.key);
    const fieldKeys = new Set<string>();
    for (const field of [...f.sections, ...(f.closeSections ?? [])].flatMap((s) => s.fields)) {
      assert.ok(!fieldKeys.has(field.key) || f.closeSections?.some((s) => s.fields.includes(field)), `${f.key}: duplicate field ${field.key}`);
      fieldKeys.add(field.key);
      if (field.type === "select" || field.type === "multi") assert.ok(field.options?.length, `${f.key}.${field.key} has no choices`);
      if (field.type === "computed") assert.ok(field.formula, `${f.key}.${field.key} has no formula`);
      if (field.type === "table") assert.ok(field.columns?.length, `${f.key}.${field.key} has no columns`);
    }
    for (const v of f.visitForms ?? []) assert.equal(LIBRARY_BY_KEY.get(v)?.episodeKey, f.key, `${f.key} lists ${v}`);
    if (f.episodeKey) assert.equal(LIBRARY_BY_KEY.get(f.episodeKey)?.kind, "episode");
  }
});

test("a clinic's edited questions never strand an old answer", () => {
  const before = [
    { key: "c_notes", label: "Notes", type: "text" as const },
    { key: "c_severity", label: "Severity", type: "select" as const, options: ["Mild", "Moderate", "Severe"] },
    { key: "c_gone", label: "Gone", type: "text" as const },
  ];
  // Notes becomes yes/no, Severity loses "Severe", Gone is left out.
  const { fields } = cleanOwnFields([
    { key: "c_notes", label: "Notes", type: "yesno" },
    { key: "c_severity", label: "Severity", type: "select", options: ["Mild", "Moderate"] },
  ], undefined, before);
  const out = reconcileFields(fields, before);
  const byKey = new Map(out.map((f) => [f.key, f]));
  assert.equal(byKey.get("c_notes")?.type, "text", "the old Notes keeps its key and type, retired");
  assert.equal(byKey.get("c_notes")?.retired, true);
  assert.equal(byKey.get("c_notes_2")?.type, "yesno", "the new Notes is a new key");
  assert.deepEqual(byKey.get("c_severity")?.retiredOptions, ["Severe"]);
  assert.equal(byKey.get("c_gone")?.retired, true);
  // An old record still saves.
  const { errors } = cleanData([{ title: "x", fields: out }], { c_notes: "free text", c_severity: "Severe", c_notes_2: true });
  assert.deepEqual(errors, []);
});

test("a new question never takes a key the form used before, even a retired one", () => {
  const before = [{ key: "c_notes", label: "Notes", type: "text" as const, retired: true }];
  const { fields } = cleanOwnFields([{ label: "Notes", type: "yesno" }], undefined, before);
  assert.equal(fields[0]!.key, "c_notes_2");
  const forged = cleanOwnFields([{ key: "c_someone_elses", label: "Forged", type: "text" }], undefined, before);
  assert.equal(forged.fields[0]!.key, "c_forged", "a key the form never had is not accepted from the client");
});

test("only real calendar days are dates", () => {
  assert.equal(isValidDay("2026-02-28"), true);
  assert.equal(isValidDay("2026-02-30"), false);
  assert.equal(isValidDay("2026-13-01"), false);
  assert.equal(isValidDay("2026-1-01"), false);
});
