import type { FormField } from "./specialty-forms.js";

/**
 * Starter templates the clinic can begin a new form from, instead of a
 * blank page. Each one is a short, opinionated draft that covers the
 * usual questions for that use-case; the clinic edits, adds and removes
 * from there as any other form.
 *
 * Chosen to complement what is already in specialty-library.ts rather
 * than duplicate it:
 *   - the library covers pregnancy, fertility, menstrual, gynae visit,
 *     child growth, birth history, immunisation, diabetes, cardiac,
 *     eye, dental, ortho, physio, skin, mental health;
 *   - this file adds the next-common clinic needs that are NOT in the
 *     library -- allergy consult, pre-employment, PAC, respiratory,
 *     consent, discharge summary, procedure note, medico-legal.
 *
 * Each template is a flat field list exactly as the editor's Draft[]
 * uses, so no translation is needed on either side -- the editor
 * loads the fields straight in.
 */

export interface FormTemplate {
  id: string;
  title: string;
  specialty: string;
  kind: "visit" | "history";
  summary: string;
  fields: Partial<FormField>[];
}

export const TEMPLATES: FormTemplate[] = [
  {
    id: "allergy-consult",
    title: "Allergy consultation",
    specialty: "Allergy",
    kind: "visit",
    summary: "Food, drug and seasonal allergies, with trigger history and skin-test readings.",
    fields: [
      { label: "Chief complaint", type: "textarea", required: true, wide: true, section: "History" },
      { label: "Known allergens", type: "multi", options: ["Pollen", "Dust mite", "Pet dander", "Mold", "Nuts", "Shellfish", "Dairy", "Egg", "Penicillin", "Sulfa"], section: "History" },
      { label: "Age at onset (years)", type: "number", unit: "years", section: "History" },
      { label: "Seasonal pattern?", type: "yesno", section: "History" },
      { label: "Which months worst", type: "text", section: "History", showIf: { field: "c_seasonal_pattern", equals: true } },
      { label: "Previous skin test done?", type: "yesno", section: "Examination" },
      { label: "Positive allergens", type: "text", section: "Examination", showIf: { field: "c_previous_skin_test_done", equals: true } },
      { label: "Rhinoscopy findings", type: "textarea", section: "Examination" },
      { label: "Peak flow (L/min)", type: "number", unit: "L/min", section: "Examination" },
      { label: "Plan", type: "textarea", required: true, wide: true, section: "Plan" },
      { label: "Follow-up (weeks)", type: "number", unit: "weeks", section: "Plan" },
    ],
  },
  {
    id: "pre-employment",
    title: "Pre-employment medical",
    specialty: "Occupational health",
    kind: "visit",
    summary: "Fitness-for-work certification: demographics, past history, vitals, exam.",
    fields: [
      { label: "Employer / position", type: "text", required: true, wide: true, section: "Context" },
      { label: "Nature of work", type: "select", options: ["Desk / sedentary", "Standing / retail", "Manual / labour", "Shift / night work", "Driving", "Heights / confined space", "Food handling"], section: "Context" },
      { label: "Past medical history", type: "textarea", wide: true, section: "History" },
      { label: "Current medication", type: "textarea", wide: true, section: "History" },
      { label: "Smoker?", type: "yesno", section: "History" },
      { label: "Cigarettes a day", type: "number", section: "History", showIf: { field: "c_smoker", equals: true } },
      { label: "Height (cm)", type: "number", unit: "cm", section: "Examination" },
      { label: "Weight (kg)", type: "number", unit: "kg", section: "Examination" },
      { label: "BMI", type: "computed", formula: "bmi", section: "Examination" },
      { label: "BP", type: "text", section: "Examination" },
      { label: "Vision (right / left)", type: "text", section: "Examination" },
      { label: "Colour vision normal?", type: "yesno", section: "Examination" },
      { label: "Hearing", type: "select", options: ["Normal", "Impaired left", "Impaired right", "Impaired both"], section: "Examination" },
      { label: "Fitness decision", type: "select", options: ["Fit", "Fit with restrictions", "Temporarily unfit", "Unfit"], required: true, section: "Decision" },
      { label: "Restrictions / notes", type: "textarea", wide: true, section: "Decision", showIf: { field: "c_fitness_decision", equals: "Fit with restrictions" } },
      { label: "Reason unfit", type: "textarea", wide: true, section: "Decision", showIf: { field: "c_fitness_decision", equals: "Unfit" } },
    ],
  },
  {
    id: "pre-anaesthetic",
    title: "Pre-anaesthetic checkup (PAC)",
    specialty: "Anaesthesia",
    kind: "visit",
    summary: "Before a planned surgery: history, airway, investigations, ASA grading.",
    fields: [
      { label: "Proposed surgery", type: "text", required: true, wide: true, section: "Context" },
      { label: "Planned date", type: "date", section: "Context" },
      { label: "Previous anaesthesia reaction?", type: "yesno", section: "History" },
      { label: "What happened", type: "textarea", wide: true, section: "History", showIf: { field: "c_previous_anaesthesia_reaction", equals: true } },
      { label: "Family history of anaesthesia problems", type: "yesno", section: "History" },
      { label: "Comorbidities", type: "multi", options: ["Hypertension", "Diabetes", "IHD", "COPD / Asthma", "CKD", "Thyroid", "Sleep apnoea", "Obesity", "Pregnancy"], section: "History" },
      { label: "Current medications", type: "textarea", wide: true, section: "History" },
      { label: "Allergies", type: "text", section: "History" },
      { label: "Mallampati grade", type: "select", options: ["I", "II", "III", "IV"], required: true, section: "Airway" },
      { label: "Mouth opening (cm)", type: "number", unit: "cm", section: "Airway" },
      { label: "Neck extension", type: "select", options: ["Normal", "Restricted"], section: "Airway" },
      { label: "Loose / artificial teeth", type: "yesno", section: "Airway" },
      { label: "Hb (g/dL)", type: "number", unit: "g/dL", section: "Investigations" },
      { label: "RBS (mg/dL)", type: "number", unit: "mg/dL", section: "Investigations" },
      { label: "ECG findings", type: "textarea", wide: true, section: "Investigations" },
      { label: "ASA grade", type: "select", options: ["I", "II", "III", "IV", "V"], required: true, section: "Grade" },
      { label: "Fit for surgery?", type: "yesno", required: true, section: "Grade" },
      { label: "Conditions / optimisation needed", type: "textarea", wide: true, section: "Grade", showIf: { field: "c_fit_for_surgery", equals: false } },
    ],
  },
  {
    id: "respiratory-review",
    title: "Asthma / COPD review",
    specialty: "Respiratory",
    kind: "visit",
    summary: "Control, inhaler technique, PEFR, escalation plan.",
    fields: [
      { label: "Diagnosis", type: "select", options: ["Asthma", "COPD", "Overlap"], required: true, section: "Baseline" },
      { label: "Pack years (if smoker)", type: "number", section: "Baseline" },
      { label: "Exacerbations in last 12 months", type: "number", section: "Current" },
      { label: "Nocturnal symptoms", type: "yesno", section: "Current" },
      { label: "Reliever uses per week", type: "number", section: "Current" },
      { label: "Peak flow (L/min)", type: "number", unit: "L/min", section: "Examination" },
      { label: "Predicted PEFR", type: "number", unit: "L/min", section: "Examination" },
      { label: "Chest exam", type: "textarea", wide: true, section: "Examination" },
      { label: "SpO2", type: "number", unit: "%", section: "Examination" },
      { label: "Current inhaler technique correct?", type: "yesno", section: "Plan" },
      { label: "Step change", type: "select", options: ["Continue", "Step up", "Step down"], required: true, section: "Plan" },
      { label: "Rescue plan explained?", type: "yesno", section: "Plan" },
    ],
  },
  {
    id: "procedure-consent",
    title: "Procedure consent",
    specialty: "Procedures",
    kind: "visit",
    summary: "Informed consent record for a minor OPD procedure or surgery.",
    fields: [
      { label: "Procedure name", type: "text", required: true, wide: true, section: "Procedure" },
      { label: "Indication", type: "textarea", wide: true, section: "Procedure" },
      { label: "Risks explained", type: "textarea", required: true, wide: true, section: "Consent" },
      { label: "Benefits explained", type: "textarea", required: true, wide: true, section: "Consent" },
      { label: "Alternatives explained", type: "textarea", wide: true, section: "Consent" },
      { label: "Patient understood (interpreter?)", type: "select", options: ["Understood directly", "Via family member", "Via interpreter"], section: "Consent" },
      { label: "Consent given by", type: "select", options: ["Patient", "Guardian / parent", "Spouse", "Other relative"], required: true, section: "Consent" },
      { label: "Witness name", type: "text", section: "Consent" },
      { label: "Time of signing", type: "text", section: "Consent" },
    ],
  },
  {
    id: "discharge-summary",
    title: "Discharge summary",
    specialty: "IPD",
    kind: "visit",
    summary: "The one document every admitted patient leaves with.",
    fields: [
      { label: "Admission diagnosis", type: "textarea", required: true, wide: true, section: "Admission" },
      { label: "Date of admission", type: "date", required: true, section: "Admission" },
      { label: "Date of discharge", type: "date", required: true, section: "Discharge" },
      { label: "Final diagnosis", type: "textarea", required: true, wide: true, section: "Discharge" },
      { label: "Course in hospital", type: "textarea", required: true, wide: true, section: "Course" },
      { label: "Procedures done", type: "textarea", wide: true, section: "Course" },
      { label: "Investigations (summary)", type: "textarea", wide: true, section: "Course" },
      { label: "Condition at discharge", type: "select", options: ["Improved", "Status quo", "Deteriorated", "DAMA", "Expired"], required: true, section: "Discharge" },
      { label: "Discharge medications", type: "textarea", wide: true, section: "At home" },
      { label: "Diet / activity advice", type: "textarea", wide: true, section: "At home" },
      { label: "Follow-up on", type: "date", section: "At home" },
      { label: "Return if", type: "textarea", wide: true, section: "At home" },
    ],
  },
  {
    id: "medico-legal",
    title: "Medico-legal / wound report",
    specialty: "Medico-legal",
    kind: "visit",
    summary: "Standard MLC format: brought by police, injury description, nature, opinion.",
    fields: [
      { label: "MLC number", type: "text", required: true, section: "Formal" },
      { label: "Brought by", type: "select", options: ["Police", "Relative", "Bystander", "Ambulance", "Self"], required: true, section: "Formal" },
      { label: "Police station (if applicable)", type: "text", section: "Formal" },
      { label: "Alleged incident", type: "textarea", required: true, wide: true, section: "History" },
      { label: "Date / time of incident", type: "text", section: "History" },
      { label: "Place of incident", type: "text", section: "History" },
      { label: "Weapon alleged", type: "text", section: "History" },
      { label: "Injuries (describe each)", type: "textarea", required: true, wide: true, section: "Examination" },
      { label: "Nature of injury", type: "select", options: ["Simple", "Grievous", "Dangerous to life", "Fatal"], required: true, section: "Opinion" },
      { label: "Age of injury", type: "select", options: ["Fresh", "Few hours", "1-2 days", "Older"], section: "Opinion" },
      { label: "Manner", type: "select", options: ["Blunt force", "Sharp", "Firearm", "Burn", "Chemical", "Other"], section: "Opinion" },
      { label: "Opinion", type: "textarea", required: true, wide: true, section: "Opinion" },
    ],
  },
  {
    id: "ivf-cycle",
    title: "IVF cycle visit",
    specialty: "Fertility",
    kind: "visit",
    summary: "One follicle-tracking or stimulation visit inside an infertility episode.",
    fields: [
      { label: "Cycle day", type: "number", required: true, section: "Timing" },
      { label: "Protocol", type: "select", options: ["Natural", "Letrozole", "Clomiphene", "Gonadotropin", "Antagonist", "Long agonist"], section: "Timing" },
      { label: "E2 (pg/mL)", type: "number", unit: "pg/mL", section: "Labs" },
      { label: "LH (mIU/mL)", type: "number", unit: "mIU/mL", section: "Labs" },
      { label: "P4 (ng/mL)", type: "number", unit: "ng/mL", section: "Labs" },
      { label: "Follicles right", type: "text", section: "Ultrasound" },
      { label: "Follicles left", type: "text", section: "Ultrasound" },
      { label: "Endometrium (mm)", type: "number", unit: "mm", section: "Ultrasound" },
      { label: "Trigger given?", type: "yesno", section: "Plan" },
      { label: "Trigger", type: "select", options: ["hCG 5000", "hCG 10000", "GnRH agonist", "Dual trigger"], section: "Plan", showIf: { field: "c_trigger_given", equals: true } },
      { label: "Retrieval / insemination date", type: "date", section: "Plan" },
      { label: "Notes", type: "textarea", wide: true, section: "Plan" },
    ],
  },
  {
    id: "paediatric-developmental",
    title: "Paediatric developmental screening",
    specialty: "Paediatrics",
    kind: "visit",
    summary: "Milestone check: gross motor, fine motor, language, social-emotional.",
    fields: [
      { label: "Age (months)", type: "number", unit: "months", required: true, section: "Baseline" },
      { label: "Gestational age at birth (weeks)", type: "number", unit: "weeks", section: "Baseline" },
      { label: "Birth weight (kg)", type: "number", unit: "kg", section: "Baseline" },
      { label: "Head control", type: "select", options: ["Age-appropriate", "Delayed", "Not applicable"], section: "Gross motor" },
      { label: "Sitting", type: "select", options: ["Age-appropriate", "Delayed", "Not applicable"], section: "Gross motor" },
      { label: "Walking", type: "select", options: ["Age-appropriate", "Delayed", "Not applicable"], section: "Gross motor" },
      { label: "Pincer grasp", type: "select", options: ["Age-appropriate", "Delayed", "Not applicable"], section: "Fine motor" },
      { label: "First words age (months)", type: "number", unit: "months", section: "Language" },
      { label: "Current vocabulary (rough count)", type: "number", section: "Language" },
      { label: "Social smile age (months)", type: "number", unit: "months", section: "Social" },
      { label: "Stranger anxiety age (months)", type: "number", unit: "months", section: "Social" },
      { label: "Red flags noted", type: "textarea", wide: true, section: "Assessment" },
      { label: "Referral needed?", type: "select", options: ["No", "Developmental paed", "Audiology", "Speech therapy", "Occupational therapy"], section: "Plan" },
    ],
  },
  {
    id: "mental-health-intake",
    title: "Mental health intake (PHQ-9 + GAD-7)",
    specialty: "Mental health",
    kind: "visit",
    summary: "Self-reported depression and anxiety scoring on the two commonest scales.",
    fields: [
      { label: "Presenting concern", type: "textarea", required: true, wide: true, section: "Context" },
      { label: "First episode?", type: "yesno", section: "Context" },
      { label: "PHQ-9 total", type: "number", min: 0, max: 27, required: true, hint: "Patient's self-rated depression score, 0-27", section: "Scores" },
      { label: "GAD-7 total", type: "number", min: 0, max: 21, required: true, hint: "Patient's self-rated anxiety score, 0-21", section: "Scores" },
      { label: "Self-harm risk", type: "select", options: ["None", "Passive thoughts", "Active plan"], required: true, hint: "If 'Active plan', do not let the patient leave alone.", section: "Risk" },
      { label: "Substance use", type: "select", options: ["None", "Alcohol", "Tobacco only", "Cannabis", "Opioids", "Other"], section: "Risk" },
      { label: "Social support", type: "select", options: ["Good", "Limited", "None"], section: "Context" },
      { label: "Sleep hours per night", type: "number", unit: "hrs", section: "Current" },
      { label: "Plan", type: "textarea", required: true, wide: true, section: "Plan" },
      { label: "Follow-up (weeks)", type: "number", unit: "weeks", section: "Plan" },
    ],
  },
];

/** Shallow list for the dropdown — no fields, saves bandwidth. */
export function listTemplates(): Array<Pick<FormTemplate, "id" | "title" | "specialty" | "kind" | "summary">> {
  return TEMPLATES.map((t) => ({ id: t.id, title: t.title, specialty: t.specialty, kind: t.kind, summary: t.summary }));
}

export function findTemplate(id: string): FormTemplate | null {
  return TEMPLATES.find((t) => t.id === id) ?? null;
}
