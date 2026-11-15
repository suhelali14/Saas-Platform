import type { FormDef, FormField } from "./specialty-forms.js";

/**
 * The forms every clinic starts with.
 *
 * Fields follow what each specialty actually writes down: the antenatal
 * grid of the government's Mother and Child Protection card, the menstrual
 * history a gynaecologist takes, a couple's workup at a fertility clinic,
 * a child's growth and vaccines, each eye's vision and refraction. A clinic
 * can switch any of them off, add its own fields, or make forms of its own
 * (routes/clinic-specialty.ts).
 *
 * KEYS ARE PERMANENT. A record stores answers by key, so renaming one
 * strands every record made with it. To stop asking something, mark it
 * `retired`; to change what it means, add a new key. Bump `version` when
 * a form changes, so a record says which version it was made with.
 *
 * No form has a field for the sex of a fetus, and none may be added: the
 * PC-PNDT Act prohibits determining or disclosing it.
 */

// ── Field shorthands ───────────────────────────────────────────────────

const text = (key: string, label: string, x: Partial<FormField> = {}): FormField => ({ key, label, type: "text", ...x });
const long = (key: string, label: string, x: Partial<FormField> = {}): FormField => ({ key, label, type: "textarea", wide: true, ...x });
const num = (key: string, label: string, unit: string | undefined, min: number, max: number, x: Partial<FormField> = {}): FormField =>
  ({ key, label, type: "number", ...(unit ? { unit } : {}), min, max, ...x });
const date = (key: string, label: string, x: Partial<FormField> = {}): FormField => ({ key, label, type: "date", ...x });
const pick = (key: string, label: string, options: string[], x: Partial<FormField> = {}): FormField => ({ key, label, type: "select", options, ...x });
const many = (key: string, label: string, options: string[], x: Partial<FormField> = {}): FormField => ({ key, label, type: "multi", options, wide: true, ...x });
const yes = (key: string, label: string, x: Partial<FormField> = {}): FormField => ({ key, label, type: "yesno", ...x });
const calc = (key: string, label: string, formula: FormField["formula"], x: Partial<FormField> = {}): FormField => ({ key, label, type: "computed", formula, ...x });
const table = (key: string, label: string, columns: FormField[], x: Partial<FormField> = {}): FormField => ({ key, label, type: "table", columns, wide: true, ...x });

const DIP = ["Nil", "Trace", "+", "++", "+++"];
const SIDES = ["Right eye", "Left eye"];
const PAIN = (key: string, label: string) => num(key, label, "/10", 0, 10, { hint: "0 is no pain, 10 the worst imaginable" });
const BP = [num("bp_systolic", "BP, systolic", "mmHg", 50, 260), num("bp_diastolic", "BP, diastolic", "mmHg", 30, 160)];

const OBG = ["obstet", "gynae", "gynec", "obg", "obgy", "women", "maternity"];
const PAEDS = ["paed", "pediat", "child", "neonat"];

// ── Obstetrics ─────────────────────────────────────────────────────────

const pregnancy: FormDef = {
  key: "pregnancy",
  version: 1,
  title: "Pregnancy",
  specialty: "Obstetrics & Gynaecology",
  kind: "episode",
  tags: OBG,
  suggest: { category: "PREGNANT", gender: "Female" },
  visitForms: ["antenatal"],
  couple: true,
  note: "Fetal sex is never recorded: the PC-PNDT Act prohibits determining or disclosing it. An obstetric ultrasound also needs its Form F.",
  sections: [
    {
      title: "Dates",
      fields: [
        date("lmp", "LMP — first day of the last period", { hint: "शेवटची पाळी / आखिरी माहवारी" }),
        calc("edd", "EDD by dates", "edd", { hint: "LMP + 280 days" }),
        date("usg_edd", "EDD by dating scan", { hint: "If an early scan dates the pregnancy differently, the weeks are counted from this" }),
        pick("conception", "Conceived", ["Naturally", "Ovulation induction", "IUI", "IVF / ICSI"]),
      ],
    },
    {
      title: "Obstetric score",
      fields: [
        num("gravida", "Gravida (G)", undefined, 1, 20, { hint: "Pregnancies including this one" }),
        num("para", "Para (P)", undefined, 0, 20, { hint: "Deliveries after 28 weeks" }),
        num("living", "Living children (L)", undefined, 0, 20),
        num("abortions", "Abortions (A)", undefined, 0, 20),
        table("past", "Earlier pregnancies", [
          num("year", "Year", undefined, 1950, 2100),
          pick("outcome", "Outcome", ["Normal delivery", "Caesarean (LSCS)", "Assisted delivery", "Preterm delivery", "Abortion", "Ectopic", "Stillbirth", "Neonatal death"]),
          num("weeks", "Weeks", undefined, 4, 44),
          num("weight", "Baby's weight", "kg", 0.3, 6),
          text("notes", "Notes"),
        ]),
      ],
    },
    {
      title: "Before this pregnancy",
      fields: [
        num("pre_weight", "Weight at booking", "kg", 25, 200),
        num("height", "Height", "cm", 100, 210),
        calc("bmi", "BMI", "bmi"),
        yes("consanguinity", "Married to a relative"),
        text("medical", "Medical conditions", { hint: "Diabetes, thyroid, heart disease, epilepsy…" }),
      ],
    },
    {
      title: "Risk",
      fields: [
        many("risks", "Risk factors", [
          "Previous caesarean", "Age 35 or above", "Age under 18", "Height under 145 cm", "Anaemia", "Hypertension / PIH",
          "Diabetes / GDM", "Thyroid disorder", "Twins or more", "Rh negative", "Previous stillbirth or neonatal death",
          "Two or more abortions", "Heart disease", "Bad obstetric history",
        ]),
        yes("high_risk", "High-risk pregnancy"),
        long("risk_notes", "Notes on risk"),
      ],
    },
  ],
  closeSections: [
    {
      title: "Outcome",
      fields: [
        pick("outcome", "Outcome", ["Normal delivery", "Assisted delivery (forceps / vacuum)", "Caesarean (LSCS)", "Abortion", "Ectopic", "Molar pregnancy", "Care moved elsewhere"]),
        date("ended_on", "Date"),
        num("weeks_at_end", "Weeks", undefined, 4, 44),
        table("babies", "Babies", [num("weight", "Weight", "kg", 0.3, 6), pick("condition", "Condition", ["Live", "Stillborn"]), num("apgar", "APGAR at 5 min", undefined, 0, 10)]),
        text("place", "Where"),
        long("close_notes", "Notes"),
      ],
    },
  ],
  summary: ["lmp", "edd", "gravida", "para", "living", "abortions", "high_risk"],
};

const antenatal: FormDef = {
  key: "antenatal",
  version: 1,
  title: "Antenatal visit",
  specialty: "Obstetrics & Gynaecology",
  kind: "visit",
  tags: OBG,
  suggest: { gender: "Female" },
  episodeKey: "pregnancy",
  note: "Fetal sex is never recorded: the PC-PNDT Act prohibits determining or disclosing it.",
  sections: [
    {
      title: "Today",
      fields: [
        calc("ga", "Weeks of pregnancy", "ga"),
        many("complaints", "Complaints", [
          "None", "Bleeding", "Leaking fluid", "Pain in the abdomen", "Headache", "Blurred vision", "Swelling of face or hands",
          "Fewer baby movements", "Fever", "Burning urine", "Vomiting",
        ]),
      ],
    },
    {
      title: "Examination",
      fields: [
        num("weight", "Weight", "kg", 25, 200),
        ...BP,
        num("pulse", "Pulse", "/min", 30, 220),
        pick("pallor", "Pallor", ["None", "Mild", "Moderate", "Severe"]),
        pick("oedema", "Oedema", ["None", "Feet", "Up to the knees", "Generalised"]),
        yes("jaundice", "Jaundice"),
      ],
    },
    {
      title: "Abdomen",
      fields: [
        num("fundal_height", "Fundal height", "cm", 8, 50),
        pick("presentation", "Presentation", ["Not yet palpable", "Cephalic", "Breech", "Transverse", "Oblique"]),
        num("fhr", "Fetal heart rate", "/min", 60, 220),
        pick("movements", "Baby's movements", ["Felt well", "Reduced", "Not yet felt"]),
      ],
    },
    {
      title: "Tests",
      fields: [
        num("hb", "Haemoglobin", "g/dL", 2, 20),
        pick("urine_albumin", "Urine albumin", DIP),
        pick("urine_sugar", "Urine sugar", DIP),
        text("other_tests", "Other results", { hint: "Blood sugar, TSH, HIV, VDRL, HBsAg…" }),
        long("usg", "Ultrasound findings", { hint: "Weeks by scan, heartbeat, placenta, liquor, anomalies. Never the sex of the fetus." }),
      ],
    },
    {
      title: "Given and advised",
      fields: [
        pick("td", "Td vaccine", ["None today", "Td 1", "Td 2", "Td booster"]),
        yes("ifa", "Iron and folic acid given"),
        yes("calcium", "Calcium given"),
        long("advice", "Advice"),
        date("next_visit", "Next visit"),
      ],
    },
  ],
  summary: ["ga", "weight", "bp_systolic", "bp_diastolic", "fundal_height", "presentation", "fhr", "hb", "urine_albumin", "oedema"],
  trend: ["weight", "bp_systolic", "bp_diastolic", "fundal_height", "hb"],
};

// ── Gynaecology ────────────────────────────────────────────────────────

const menstrual: FormDef = {
  key: "menstrual",
  version: 1,
  title: "Menstrual history",
  specialty: "Obstetrics & Gynaecology",
  kind: "history",
  tags: OBG,
  suggest: { gender: "Female" },
  sections: [
    {
      title: "Periods (पाळी / माहवारी)",
      fields: [
        num("menarche", "Age at first period", "years", 7, 20),
        pick("regularity", "Cycle", ["Regular", "Irregular"]),
        num("cycle_length", "Cycle length", "days", 10, 120),
        num("period_days", "Bleeding lasts", "days", 1, 20),
        pick("flow", "Flow", ["Scanty", "Normal", "Heavy", "Heavy with clots"]),
        pick("pain", "Pain with periods", ["None", "Mild", "Moderate", "Severe"]),
        yes("intermenstrual", "Bleeding between periods"),
        yes("postcoital", "Bleeding after intercourse"),
        date("lmp", "Last period (LMP)"),
      ],
    },
    {
      title: "Later life and contraception",
      fields: [
        yes("menopause", "Periods have stopped (menopause)"),
        num("menopause_age", "Age at menopause", "years", 25, 65),
        pick("contraception", "Contraception", ["None", "Condoms", "Oral pills", "Copper-T (IUCD)", "Injectable", "Tubectomy", "Partner's vasectomy", "Natural methods"]),
        date("pap", "Last Pap smear"),
        long("notes", "Notes"),
      ],
    },
  ],
  summary: ["regularity", "cycle_length", "period_days", "flow", "lmp", "contraception"],
};

const gynaeVisit: FormDef = {
  key: "gynae_visit",
  version: 1,
  title: "Gynaecology visit",
  specialty: "Obstetrics & Gynaecology",
  kind: "visit",
  tags: OBG,
  suggest: { gender: "Female" },
  sections: [
    {
      title: "Today",
      fields: [
        date("lmp", "Last period (LMP)", { hint: "शेवटची पाळी / आखिरी माहवारी" }),
        calc("cycle_day", "Day of cycle", "cycle_day"),
        many("complaints", "Complaints", [
          "White discharge", "Irregular periods", "Heavy periods", "Painful periods", "Missed period", "Pain in the lower abdomen",
          "Itching", "Bleeding after menopause", "Lump in the breast", "Urinary complaints",
        ]),
        pick("upt", "Urine pregnancy test", ["Not done", "Negative", "Positive"]),
      ],
    },
    {
      title: "Examination",
      fields: [
        text("breast", "Breasts"),
        text("abdomen", "Abdomen"),
        text("ps", "Per speculum"),
        text("pv", "Per vaginum"),
        long("usg", "Ultrasound", { hint: "Uterus, endometrium, ovaries" }),
        long("notes", "Notes"),
      ],
    },
  ],
  summary: ["lmp", "cycle_day", "complaints", "upt"],
};

// ── Fertility ──────────────────────────────────────────────────────────

const FERTILITY = ["infert", "fertil", "ivf", "reproduct", "androl", ...OBG];

const infertility: FormDef = {
  key: "infertility",
  version: 1,
  title: "Infertility treatment",
  specialty: "Fertility",
  kind: "episode",
  tags: FERTILITY,
  // Not offered to someone who is already pregnant.
  suggest: { unlessOpen: ["pregnancy"] },
  couple: true,
  visitForms: ["follicular", "semen_analysis"],
  note: "A couple's record. Link the partner from Family, as a patient here or by their details, so the record shows on both files.",
  sections: [
    {
      title: "The couple",
      fields: [
        pick("treated", "Being treated", ["Wife", "Husband", "Both"]),
        pick("type", "Infertility", ["Primary (never conceived)", "Secondary (conceived before)"]),
        num("married_years", "Married for", "years", 0, 50),
        num("trying_years", "Trying for", "years", 0, 50),
        pick("frequency", "Intercourse", ["Daily", "2–3 times a week", "Once a week", "Less often"]),
        yes("consanguinity", "Married to a relative"),
      ],
    },
    {
      title: "Wife",
      fields: [
        pick("f_cycles", "Cycles", ["Regular", "Irregular", "Absent"]),
        yes("f_pcos", "PCOS"),
        num("f_amh", "AMH", "ng/mL", 0, 30, { step: 0.01 }),
        num("f_tsh", "TSH", "µIU/mL", 0, 100, { step: 0.01 }),
        num("f_prolactin", "Prolactin", "ng/mL", 0, 500),
        pick("f_hsg", "Tubes (HSG / laparoscopy)", ["Not tested", "Both open", "One blocked", "Both blocked"]),
        long("f_previous", "Treatment so far"),
      ],
    },
    {
      title: "Husband",
      fields: [
        many("m_habits", "Habits", ["None", "Smoking", "Alcohol", "Chewing tobacco"]),
        text("m_conditions", "Medical conditions", { hint: "Diabetes, mumps, surgery, varicocele…" }),
        long("m_previous", "Treatment so far"),
      ],
    },
    {
      title: "Plan",
      fields: [
        pick("plan", "Plan", ["Timed intercourse", "Ovulation induction", "IUI", "IVF / ICSI", "Donor programme", "Surgery first", "Other"]),
        long("plan_notes", "Notes"),
      ],
    },
  ],
  closeSections: [
    {
      title: "Outcome",
      fields: [
        pick("outcome", "Outcome", ["Pregnancy achieved", "Stopped — the couple's decision", "Referred elsewhere", "Other"]),
        date("ended_on", "Date"),
        long("close_notes", "Notes"),
      ],
    },
  ],
  summary: ["treated", "type", "trying_years", "plan"],
};

const follicular: FormDef = {
  key: "follicular",
  version: 1,
  title: "Follicle scan",
  specialty: "Fertility",
  kind: "visit",
  tags: FERTILITY,
  episodeKey: "infertility",
  sections: [
    {
      title: "This cycle",
      fields: [
        date("cycle_lmp", "Period started (this cycle)"),
        calc("cycle_day", "Day of cycle", "cycle_day"),
        text("drug", "Medicine and dose this cycle"),
      ],
    },
    {
      title: "Scan",
      fields: [
        num("endometrium", "Endometrium", "mm", 1, 30, { step: 0.1 }),
        pick("pattern", "Endometrial pattern", ["Trilaminar", "Homogeneous", "Other"]),
        table("follicles", "Follicles", [num("count", "Number", undefined, 0, 40), num("largest", "Largest", "mm", 1, 40, { step: 0.5 }), text("sizes", "Sizes")], { rows: ["Right ovary", "Left ovary"] }),
        yes("trigger", "Trigger given"),
        pick("procedure", "Done today", ["Nothing", "IUI", "Egg collection", "Embryo transfer"]),
        long("notes", "Notes"),
      ],
    },
  ],
  summary: ["cycle_day", "endometrium", "pattern", "trigger", "procedure"],
  trend: ["endometrium"],
};

const semen: FormDef = {
  key: "semen_analysis",
  version: 1,
  title: "Semen analysis",
  specialty: "Fertility",
  kind: "visit",
  tags: FERTILITY,
  episodeKey: "infertility",
  sections: [
    {
      title: "Result",
      fields: [
        num("abstinence", "Abstinence", "days", 0, 30),
        num("volume", "Volume", "mL", 0, 15, { step: 0.1 }),
        num("count", "Sperm concentration", "million/mL", 0, 500, { step: 0.1 }),
        num("motility", "Progressive motility", "%", 0, 100),
        num("morphology", "Normal forms", "%", 0, 100),
        pick("impression", "Impression", ["Normal", "Low count (oligozoospermia)", "Low motility (asthenozoospermia)", "Abnormal forms (teratozoospermia)", "No sperm (azoospermia)", "Other"]),
        long("notes", "Notes"),
      ],
    },
  ],
  summary: ["volume", "count", "motility", "morphology", "impression"],
  trend: ["count", "motility"],
};

// ── Children ───────────────────────────────────────────────────────────

const childGrowth: FormDef = {
  key: "child_growth",
  version: 1,
  title: "Growth visit",
  specialty: "Paediatrics",
  kind: "visit",
  tags: PAEDS,
  suggest: { maxAge: 17 },
  sections: [
    {
      title: "Measurements",
      fields: [
        calc("age", "Age", "age_at_visit"),
        num("weight", "Weight", "kg", 0.4, 150, { step: 0.01 }),
        num("height", "Length or height", "cm", 25, 200, { step: 0.1 }),
        num("head", "Head circumference", "cm", 20, 60, { step: 0.1, hint: "Measured until two years" }),
        num("muac", "Mid-upper arm", "cm", 5, 40, { step: 0.1 }),
        calc("bmi", "BMI", "bmi"),
      ],
    },
    {
      title: "Development",
      fields: [
        pick("milestones", "Milestones", ["As expected for age", "Delayed — see notes"]),
        pick("feeding", "Feeding", ["Breast milk only", "Breast milk and other milk", "Other milk only", "Family food"]),
        long("development", "Notes on development"),
        long("advice", "Advice"),
      ],
    },
  ],
  summary: ["age", "weight", "height", "head", "milestones"],
  trend: ["weight", "height", "head"],
};

const birthHistory: FormDef = {
  key: "birth_history",
  version: 1,
  title: "Birth history",
  specialty: "Paediatrics",
  kind: "history",
  tags: PAEDS,
  suggest: { maxAge: 12 },
  sections: [
    {
      title: "At birth",
      fields: [
        num("birth_weight", "Birth weight", "kg", 0.3, 6, { step: 0.01 }),
        num("gestation", "Born at", "weeks", 22, 44),
        pick("delivery", "Delivery", ["Normal", "Caesarean", "Assisted (forceps / vacuum)"]),
        yes("cried", "Cried at birth"),
        yes("nicu", "Needed NICU care"),
        text("nicu_reason", "Why, and for how long"),
        yes("jaundice", "Newborn jaundice"),
        long("mother", "Mother's pregnancy", { hint: "Illness, medicines, problems in pregnancy" }),
      ],
    },
  ],
  summary: ["birth_weight", "gestation", "delivery", "nicu"],
};

// IAP-style schedule as rows; a clinic adds rows for anything else it gives.
const VACCINES = [
  "BCG (birth)", "OPV 0 (birth)", "Hep B 1 (birth)",
  "DTwP/DTaP 1 (6 wk)", "IPV 1 (6 wk)", "Hib 1 (6 wk)", "Hep B 2 (6 wk)", "Rotavirus 1 (6 wk)", "PCV 1 (6 wk)",
  "DTwP/DTaP 2 (10 wk)", "IPV 2 (10 wk)", "Hib 2 (10 wk)", "Hep B 3 (10 wk)", "Rotavirus 2 (10 wk)", "PCV 2 (10 wk)",
  "DTwP/DTaP 3 (14 wk)", "IPV 3 (14 wk)", "Hib 3 (14 wk)", "Hep B 4 (14 wk)", "Rotavirus 3 (14 wk)", "PCV 3 (14 wk)",
  "Influenza 1 (6 mo)", "Influenza 2 (7 mo)", "Typhoid conjugate (6–9 mo)", "MMR 1 (9 mo)", "Hep A 1 (12 mo)",
  "PCV booster (12–15 mo)", "MMR 2 (15 mo)", "Varicella 1 (15 mo)", "DTwP/DTaP booster 1 (16–18 mo)", "Hib booster (16–18 mo)",
  "IPV booster (16–18 mo)", "Hep A 2 (18 mo)", "Varicella 2 (3–4 yr)", "DTwP/DTaP booster 2 (4–6 yr)", "MMR 3 (4–6 yr)",
  "Tdap (10–12 yr)", "HPV (9–14 yr)",
];

const immunisation: FormDef = {
  key: "immunisation",
  version: 1,
  title: "Vaccinations",
  specialty: "Paediatrics",
  kind: "history",
  tags: PAEDS,
  suggest: { maxAge: 17 },
  note: "Rows follow the IAP schedule. Check doses and timing against the current IAP or government (UIP) schedule; add a row for anything else given.",
  sections: [
    {
      title: "Given",
      fields: [
        table("doses", "Doses", [date("given_on", "Given on"), text("brand", "Brand"), text("batch", "Batch")], { rows: VACCINES, addRows: true }),
        long("notes", "Reactions and notes"),
      ],
    },
  ],
  summary: ["doses"],
};

// ── Medicine ───────────────────────────────────────────────────────────

const diabetes: FormDef = {
  key: "diabetes_review",
  version: 1,
  title: "Diabetes review",
  specialty: "Medicine",
  kind: "visit",
  // Offered by the patient's own conditions to any doctor, not to every
  // patient a general physician sees.
  tags: ["diabet", "endocrin"],
  suggest: { conditions: ["diabet", "sugar"] },
  sections: [
    {
      title: "Sugar",
      fields: [
        num("fbs", "Fasting sugar", "mg/dL", 20, 700),
        num("ppbs", "Sugar 2 h after food", "mg/dL", 20, 900),
        num("hba1c", "HbA1c", "%", 3, 20, { step: 0.1 }),
        yes("hypos", "Low-sugar episodes since last visit"),
        pick("adherence", "Taking medicines", ["As advised", "Missed some", "Mostly not"]),
      ],
    },
    {
      title: "Complications",
      fields: [
        num("weight", "Weight", "kg", 20, 250),
        ...BP,
        pick("feet", "Feet", ["Normal", "Reduced sensation", "Ulcer", "Not examined"]),
        date("eye_check", "Last eye check"),
        num("creatinine", "Creatinine", "mg/dL", 0.1, 20, { step: 0.01 }),
        text("lipids", "Lipids"),
        long("notes", "Notes"),
      ],
    },
  ],
  summary: ["fbs", "ppbs", "hba1c", "weight", "bp_systolic", "bp_diastolic", "feet"],
  trend: ["fbs", "ppbs", "hba1c", "weight"],
};

const cardiac: FormDef = {
  key: "cardiac_review",
  version: 1,
  title: "Heart and BP review",
  specialty: "Cardiology",
  kind: "visit",
  tags: ["cardio", "heart"],
  suggest: { conditions: ["hypertens", "heart", "cardiac", "angina"] },
  sections: [
    {
      title: "Today",
      fields: [
        ...BP,
        num("pulse", "Pulse", "/min", 20, 250),
        pick("rhythm", "Rhythm", ["Regular", "Irregular"]),
        pick("nyha", "Breathlessness (NYHA)", ["I — no limitation", "II — on ordinary effort", "III — on less than ordinary effort", "IV — at rest"]),
        yes("chest_pain", "Chest pain"),
        yes("oedema", "Swelling of feet"),
      ],
    },
    {
      title: "Tests",
      fields: [
        text("ecg", "ECG"),
        num("ef", "Ejection fraction (echo)", "%", 5, 90),
        text("lipids", "Lipids"),
        long("notes", "Notes"),
      ],
    },
  ],
  summary: ["bp_systolic", "bp_diastolic", "pulse", "rhythm", "nyha", "ef"],
  trend: ["bp_systolic", "bp_diastolic", "pulse"],
};

// ── Eyes, teeth, bones, skin, mind ─────────────────────────────────────

const eye: FormDef = {
  key: "eye_exam",
  version: 1,
  title: "Eye examination",
  specialty: "Ophthalmology",
  kind: "visit",
  tags: ["ophthal", "eye", "optom"],
  sections: [
    {
      title: "Vision and refraction",
      fields: [
        table("vision", "Vision", [text("unaided", "Unaided", { hint: "6/9" }), text("glasses", "With glasses"), text("pinhole", "Pinhole"), text("near", "Near", { hint: "N6" })], { rows: SIDES }),
        table("refraction", "Refraction", [
          num("sph", "Sphere", "D", -30, 30, { step: 0.25 }), num("cyl", "Cylinder", "D", -15, 15, { step: 0.25 }),
          num("axis", "Axis", "°", 0, 180), num("add", "Add", "D", 0, 4, { step: 0.25 }),
        ], { rows: SIDES }),
        table("iop", "Eye pressure", [num("iop", "IOP", "mmHg", 1, 80)], { rows: SIDES }),
      ],
    },
    {
      title: "Examination",
      fields: [
        long("anterior", "Anterior segment (slit lamp)"),
        long("fundus", "Fundus"),
        text("diagnosis", "Diagnosis"),
        long("advice", "Advice"),
      ],
    },
  ],
  summary: ["diagnosis"],
};

const dental: FormDef = {
  key: "dental_chart",
  version: 1,
  title: "Dental chart",
  specialty: "Dentistry",
  kind: "visit",
  tags: ["dent", "oral", "orthodont"],
  sections: [
    {
      title: "Teeth",
      fields: [
        text("complaint", "Complaint", { wide: true }),
        table("teeth", "Teeth", [
          text("tooth", "Tooth", { hint: "FDI number, e.g. 36" }),
          pick("finding", "Finding", ["Caries", "Missing", "Filled", "Root canal treated", "Crown", "Mobile", "Impacted", "Fractured", "Sensitive"]),
          pick("treatment", "Treatment", ["Watch", "Filling", "Root canal", "Extraction", "Crown", "Scaling", "Other"]),
          text("notes", "Notes"),
        ]),
        pick("hygiene", "Oral hygiene", ["Good", "Fair", "Poor"]),
        text("gums", "Gums"),
        text("xray", "X-ray"),
        long("plan", "Treatment plan"),
      ],
    },
  ],
  summary: ["complaint", "teeth", "hygiene"],
};

const ortho: FormDef = {
  key: "ortho_exam",
  version: 1,
  title: "Bone and joint examination",
  specialty: "Orthopaedics",
  kind: "visit",
  // "orthop", not "ortho": an orthodontist is not an orthopaedic surgeon.
  tags: ["orthop", "bone", "joint", "spine", "trauma"],
  sections: [
    {
      title: "Examination",
      fields: [
        pick("region", "Region", ["Neck", "Shoulder", "Elbow", "Wrist and hand", "Back", "Hip", "Knee", "Ankle and foot", "Other"]),
        pick("side", "Side", ["Right", "Left", "Both", "Not applicable"]),
        PAIN("pain", "Pain"),
        yes("swelling", "Swelling"),
        text("tenderness", "Tenderness"),
        text("rom", "Range of movement"),
        text("neuro", "Nerves and circulation"),
        text("xray", "X-ray"),
        pick("support", "Support", ["None", "Plaster", "Slab", "Brace", "Splint", "Traction"]),
        long("notes", "Notes"),
      ],
    },
  ],
  summary: ["region", "side", "pain", "support"],
  trend: ["pain"],
};

const physio: FormDef = {
  key: "physio_session",
  version: 1,
  title: "Physiotherapy session",
  specialty: "Physiotherapy",
  kind: "visit",
  tags: ["physio", "rehab", "orthop"],
  sections: [
    {
      title: "Session",
      fields: [
        num("session", "Session number", undefined, 1, 500),
        text("region", "Region"),
        PAIN("pain_before", "Pain before"),
        PAIN("pain_after", "Pain after"),
        many("treatment", "Treatment", ["Exercises", "IFT", "TENS", "Ultrasound therapy", "Hot pack", "Cold pack", "Traction", "Manual therapy", "Taping"]),
        text("rom", "Range of movement"),
        long("exercises", "Exercises taught"),
        long("home", "Home programme"),
      ],
    },
  ],
  summary: ["session", "pain_before", "pain_after", "treatment"],
  trend: ["pain_before", "pain_after"],
};

const skin: FormDef = {
  key: "skin_exam",
  version: 1,
  title: "Skin examination",
  specialty: "Dermatology",
  kind: "visit",
  tags: ["derma", "skin", "cosmet"],
  sections: [
    {
      title: "Lesions",
      fields: [
        text("site", "Where"),
        many("lesion", "Type", ["Macule", "Patch", "Papule", "Plaque", "Vesicle", "Pustule", "Nodule", "Scale", "Ulcer"]),
        pick("distribution", "Distribution", ["Localised", "Generalised", "Symmetrical", "Along a dermatome"]),
        text("duration", "For how long"),
        pick("itch", "Itching", ["None", "Mild", "Severe"]),
        pick("koh", "KOH mount", ["Not done", "Negative", "Positive"]),
        long("notes", "Notes"),
      ],
    },
  ],
  summary: ["site", "lesion", "distribution", "itch"],
};

const mind: FormDef = {
  key: "mental_health",
  version: 1,
  title: "Mental health review",
  specialty: "Psychiatry",
  kind: "visit",
  tags: ["psych", "mental"],
  sections: [
    {
      title: "Review",
      fields: [
        num("phq9", "PHQ-9 score", undefined, 0, 27, { hint: "Depression: 5 mild, 10 moderate, 15 moderately severe, 20 severe" }),
        num("gad7", "GAD-7 score", undefined, 0, 21, { hint: "Anxiety: 5 mild, 10 moderate, 15 severe" }),
        pick("sleep", "Sleep", ["Normal", "Reduced", "Excessive"]),
        pick("risk", "Risk of self-harm", ["None", "Thoughts only", "Plan or attempt — act today"]),
        long("mse", "Mental status examination"),
        long("plan", "Plan"),
      ],
    },
  ],
  summary: ["phq9", "gad7", "sleep", "risk"],
  trend: ["phq9", "gad7"],
};

/** The card's own abbreviations, used in summaries and table columns. */
const SHORT: Record<string, Record<string, string>> = {
  pregnancy: { lmp: "LMP", edd: "EDD", usg_edd: "EDD by scan", gravida: "G", para: "P", living: "L", abortions: "A", high_risk: "High risk" },
  antenatal: { ga: "Weeks", fundal_height: "FH", fhr: "FHR", hb: "Hb", urine_albumin: "Albumin", urine_sugar: "Sugar", movements: "Movements" },
  menstrual: { regularity: "Cycle", cycle_length: "Length", period_days: "Bleeds", lmp: "LMP" },
  gynae_visit: { lmp: "LMP", cycle_day: "Day", upt: "UPT", complaints: "" },
  infertility: { treated: "Treating", type: "", trying_years: "Trying", plan: "Plan" },
  follicular: { cycle_day: "Day", endometrium: "ET", pattern: "Pattern", trigger: "Trigger", procedure: "Done" },
  semen_analysis: { volume: "Volume", count: "Count", motility: "Motility", morphology: "Morphology", impression: "" },
  child_growth: { height: "Height", head: "HC", milestones: "Milestones" },
  birth_history: { gestation: "Born at", nicu: "NICU" },
  immunisation: { doses: "doses recorded" },
  diabetes_review: { fbs: "FBS", ppbs: "PPBS", hba1c: "HbA1c" },
  cardiac_review: { nyha: "NYHA", ef: "EF" },
  eye_exam: { diagnosis: "" },
  dental_chart: { complaint: "", teeth: "teeth noted", hygiene: "Hygiene" },
  ortho_exam: { region: "", side: "Side" },
  physio_session: { session: "Session", pain_before: "Pain before", pain_after: "after" },
  skin_exam: { site: "", lesion: "", itch: "Itch" },
  mental_health: { phq9: "PHQ-9", gad7: "GAD-7", risk: "Self-harm risk" },
};

export const LIBRARY: FormDef[] = [
  pregnancy, antenatal, menstrual, gynaeVisit,
  infertility, follicular, semen,
  childGrowth, birthHistory, immunisation,
  diabetes, cardiac,
  eye, dental, ortho, physio, skin, mind,
];

for (const f of LIBRARY) {
  for (const field of [...f.sections, ...(f.closeSections ?? [])].flatMap((sec) => sec.fields)) {
    const short = SHORT[f.key]?.[field.key];
    if (short !== undefined) field.short = short;
  }
}

export const LIBRARY_BY_KEY = new Map(LIBRARY.map((f) => [f.key, f]));
