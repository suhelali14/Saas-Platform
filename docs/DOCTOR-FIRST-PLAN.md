# Faster than a pen: the plan for the doctor's side

Written for: the owner. 25 November 2026. Branch `clinic-assistant`; nothing
here is merged or deployed.

## The problem, stated plainly

A doctor with a pen writes one sheet, top to bottom, in under a minute, and
most of it they have written a hundred times before. Software loses to that
sheet whenever it asks for more screens, more presses or more typing than
the pen does. The research below says the same thing from the other side:
the reason doctors give for staying on paper is time.

So the test for every feature on the doctor's side is one question: **is
this visit quicker to write here than on a pad?** A feature that does not
help answer yes is either finished properly or taken off the screen.

## What others sell (from their own pages and listings)

| Product | What it leads with | What it does not do |
|---|---|---|
| Zoho MedScribe | Listens and drafts the note and prescription; "nearly 97 languages"; ABDM; phone apps. In early access, no price. | No billing, queue, labs or pharmacy. It tells the clinic to keep its other software. |
| Eka Care | A one-page prescription pad per specialty, coded diagnoses, EkaScribe voice notes, ABDM. | Sold as records plus scribe; the desk's work is separate. |
| HealthPlix | Templates (a listing says about 650), suggestions by diagnosis, drug-interaction warnings since 2022, regional-language prescriptions. | Screen-and-dropdown entry is still the core. |
| TatvaCare, Doxper, WONDRx | Let the doctor keep handwriting: a stylus pad or a digital pen, turned into a record. | Handwriting stays handwriting; little is structured. |

Most of this is vendors describing themselves. None of it has been checked
by using the products.

What it tells us:

1. **Everyone is converging on one page.** A single prescription sheet is
   the thing a doctor is shown in every demo.
2. **Typing is avoided three ways:** listening, templates, and handwriting.
   A serious product needs all three, because doctors differ.
3. **ABDM is a checkbox** the big ones all tick and we do not.
4. **Nobody found sells the whole clinic with an assistant that does the
   desk's work.** That is still ours.

## What I found in our own screens

Walked through as a doctor on the test clinic, without using voice:

1. **A visit was four forms.** Note, Medicines, Tests and Certificate were
   four buttons, each opening its own form with its own Save. A visit with
   a prescription and a test was three saves and three scrolls.
2. **The writing area started a third of the way down.** A three-step
   explainer about listening sat above it on every visit.
3. **Tests could not be added to a drafted note**, only removed, and a
   medicine's name in the draft did not complete from the clinic's list.
4. **Vitals are asked for twice**: once in the side panel, once in the note.
5. **The right-hand column is mostly empty** while the left one scrolls.
6. **No warning for a medicine the patient is allergic to** at the moment
   it is written by hand (the listening draft does flag it).
7. **Nothing for a doctor who wants to draw or handwrite**: an eye, a
   tooth, a joint, a rash on a body outline.

## The plan

### Stage 1: one sheet for the whole visit (done in this change)

The sheet the assistant fills by listening is now also the sheet the doctor
writes by hand. "Write it myself" opens it empty.

- Complaint, history and findings, vitals, diagnosis, medicines, tests,
  advice and the follow-up date, on one page with **one Confirm**.
- A medicine's name completes from the clinic's list as it is typed.
- **Same as last time** adds this patient's last prescription in one press;
  the doctor's saved usual prescriptions are one press each.
- The diagnoses this doctor writes most are one press each.
- A test is added by typing a few letters; the follow-up is one press for
  3 days, 1 week, 2 weeks or 1 month.
- Typing the dose pattern (1-0-1) sets the frequency.
- A visit written half by voice and half by hand is still one note, one
  prescription and one lab order.
- The three separate forms are one press away for anyone who wants them,
  and remain the only way for a clinic without the assistant module.

Tested in a real browser on the test clinic: a complaint, a diagnosis, one
medicine from the list, one test, advice and a follow-up were saved with one
Confirm as one note, one prescription and one lab order. A script did it in
about two and a half seconds, so that is not a doctor's time; a doctor's
time has to be measured with a doctor.

### Stage 2: a doctor's own shortcuts (next)

- **Whole-visit templates.** "Viral fever" fills the complaint, the
  medicines, the tests and the advice in one press, and the doctor saves
  their own from any visit. Needs a new table, so it needs your yes before
  any database is touched.
- **Allergy and interaction warnings on the sheet** as a medicine is
  written, not only on a listened draft.
- **Vitals asked for once.** What the nurse recorded appears on the sheet.
- **The right-hand column put to work**: last visit's medicines and the
  patient's running problems beside the sheet, each line one press to copy.
- **Keyboard all the way**: Enter moves to the next medicine line.

### Stage 3: any specialty, and the pen itself

- **A drawing box on the sheet.** Finger or stylus on a tablet: handwrite,
  or draw on a body outline, an eye, a tooth chart. Saved with the visit as
  a picture. This is the honest answer to "any specialist, any diagnosis":
  what no form anticipates can still be drawn.
- **Specialty forms attached to the sheet**, not on a separate panel: the
  antenatal card, the growth chart, the eye examination open inside the
  visit they belong to.
- **A printed prescription that looks like the doctor's own pad.**

### Stage 4: what the market now expects

- **ABDM and ABHA.** A registration and certification process with the
  National Health Authority, not only code. Worth starting the paperwork
  early because it gates some buyers.
- **Reminders on WhatsApp.** The site says ours are in-app only.
- **Phone apps**, or at least an installable version of the web app.

## What I would not build

- More hospital modules. One clinic pays; the hospital classes are unused.
- A second note-writer feature to match "97 languages". Ours should be
  measured on Marathi and Hindi first (see `docs/ASSISTANT-REPORT.md`).

## How we will know it worked

One number, from a real doctor over a real week: **the share of visits
written in the software without a paper pad on the desk.** Nothing above
has been tried by a doctor yet.

## Sources

- [Zoho for Healthcare](https://www.zoho.com/healthcare/) and its MedScribe, CRM and Creator Plus pages
- [Eka Care: practice management for cardiologists](https://www.eka.care/eka-for-doctors/emr-ehr-medical-software/cardiologists)
- [NABH listing: Eka Care](https://nabh.co/software/eka-care/)
- [HealthPlix launches drug-drug interaction feature](https://theindianpractitioner.com/healthplix-emr-launches-interactive-drug-drug-interaction-ddi-feature-for-doctors/)
- [Techjockey: HealthPlix](https://www.techjockey.com/detail/healthplix)
- [TatvaCare TatvaPractice](https://tatvacare.in/products/tatvapractice)
- [YourStory: Doxper](https://yourstory.com/2017/05/doxper/)
- [Perceived benefits and barriers of EMR among doctors in an Indian private hospital (2025)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12087044/)
- [A comparison post on Indian prescription tools (secondary, unverified)](https://hackmd.io/@wondrx/HkhssLzKGx)
