# Specialty records

One engine for every specialty's records, instead of a screen per specialty.
A gynaecologist asks about the last period (पाळी) at every visit; an antenatal
clinic keeps weight, BP, fundal height and Hb for nine months; a fertility
clinic works up a couple, and either or both may be the patient; an eye clinic
records each eye. All of it is the same thing underneath: a form, filled in,
belonging to a patient and sometimes to a stretch of care.

## What the research said

- **Indian clinic software ships specialty case sheets.** MocDoc advertises 15+
  specialty case sheets, Drlogy 23+ specialties, and ClinicOS runs obstetrics,
  gynaecology and ophthalmology on one shared "specialty engine" with a deeper
  paediatrics module. That is the model here: a shared engine, with the
  specialty in the data.
- **The antenatal grid comes from the government's MCP card**: date,
  complaints, weeks of pregnancy, weight, pulse, BP, pallor, oedema, jaundice,
  Hb, abdominal examination and investigations. The antenatal form follows it.
- **PC-PNDT Act.** Sex selection is prohibited and so is disclosing fetal sex;
  Form F is required for every obstetric ultrasound of a pregnant woman, kept
  two years, with a printed copy when records are electronic. So no form has a
  field for fetal sex, a clinic cannot add one (the server refuses the label or
  the choices), and the pregnancy forms remind the user about Form F. Form F
  itself is not generated here.
- **ART (Regulation) Act 2021.** ART clinics must keep records of patients,
  donors, gametes, embryos and outcomes; donor-related records for at least ten
  years. The infertility record keeps the couple's workup and treatment; donor
  and embryo registers are not built.
- **FHIR's model fits**: a versioned form definition (Questionnaire), a filled
  form stored against it (QuestionnaireResponse), a stretch of care
  (EpisodeOfCare), and people related to the patient (RelatedPerson).
- **Vaccines** follow the IAP schedule (birth; 6, 10, 14 weeks; 6–7 months
  influenza; 9 months MMR …). Schedules differ between IAP and the government
  UIP and change, so the vaccine form says to check against the current one and
  lets a clinic add rows.

Sources: [MocDoc EMR](https://mocdoc.com/hospital-emr-ehr-software),
[Drlogy](https://drlogy.com/plus),
[ClinicOS specialties](https://clinicos-frontend-xqmq.onrender.com/specialties),
[MCP card, NHM](https://nhm.gov.in/New_Updates_2018/NHM_Components/Immunization/Guildelines_for_immunization/MCP_Card_English_version.pdf),
[PC-PNDT Form F guidance](https://caho.in/files/PCPNDT%20(1).pdf),
[ART Act s.23](https://www.advocatekhoj.com/library/bareacts/assistedreproductive2021/23.php),
[FHIR QuestionnaireResponse](https://hl7.org/fhir/R4/questionnaireresponse.html),
[IAP schedule summary](https://www.diginerve.com/blogs/iap-immunization-schedule-for-routine-use/).

## How it works

| Piece | Where | What |
|---|---|---|
| Form definitions | `apps/clinic-api/src/lib/specialty-library.ts` | 18 built-in forms across 11 specialties |
| Engine | `apps/clinic-api/src/lib/specialty-forms.ts` | cleaning answers, computed values, one-line summaries, the PC-PNDT guard, a clinic's own fields |
| Routes | `apps/clinic-api/src/routes/clinic-specialty.ts` | library, family links, episodes, records |
| Renderer | `apps/clinic-web/src/components/SpecialtyForm.tsx` | draws any form; knows no specialty |
| Patient and consultation views | `apps/clinic-web/src/components/CareRecords.tsx` | episodes as cards with a row per visit, histories, other forms |
| Settings | `apps/clinic-web/src/components/SpecialtySettings.tsx` | switch forms off, add questions, make forms |

Three kinds of form:

- **history** — one per patient, kept up to date (menstrual history, birth
  history, vaccines);
- **visit** — one per visit (gynaecology visit, eye examination, growth visit);
- **episode** — a stretch of care with a start and an end (pregnancy,
  infertility treatment). Its visit forms (antenatal visit; follicle scan,
  semen analysis) are recorded within it and build its card.

Family links (`PatientRelation`) are either a patient here or just a person's
details. A couple's episode is kept on one partner's record and links the
other; if the other is also a patient here it shows on both files, and a test
done on them (a semen analysis) can be recorded from their own file.

Computed values — EDD (LMP + 280 days), weeks of pregnancy (from a dating
scan's EDD when there is one, else the LMP), BMI, day of cycle, a child's age —
are worked out by the server on save. The web shows a live preview while
typing; the server's answer is the one stored.

## Rules for changing a form

- **Never rename or reuse a field key.** Records store answers by key. To stop
  asking something, mark it `retired`; to change its meaning, add a new key.
- **Bump `version`** when a form changes; each record keeps the version it was
  made with.
- A clinic's own fields get a key from their label (`c_…`) once, and never
  again. A field a clinic removes is kept, hidden, so old records still read.

## Who can do what

| | Read | Fill forms | Open / close an episode | Family details | Form library |
|---|---|---|---|---|---|
| Doctor | yes | yes | yes | yes | if admin |
| Nurse | yes | yes | — | yes | if admin |
| Reception | yes | — | — | yes | if admin |
| Pharmacist, lab, radiographer | yes | — | — | — | if admin |
| Cashier, billing clerk | — | — | — | — | if admin |

A record can be removed by a doctor only on the day it was made; after that it
is corrected, not erased. Every request is in the audit log.

## Not built

Form F generation, donor and embryo registers for ART clinics, WHO growth-chart
percentiles, a graphical tooth chart, and a printed antenatal card of its own
(the records are on the patient report, one entry per visit). Each is a
reasonable next step on the same engine.
