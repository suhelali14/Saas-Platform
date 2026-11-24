# The clinic assistant: plan

Written 2026-11-25. Covers what the assistant is, how it is built, what
it costs to run, whether it scales, and the order to build it in.

Nothing here is built yet. Prices and accuracy figures marked
*unverified* come from third-party pages or my own estimates and must be
checked in Phase 0 before any of them is quoted to a clinic.

---

## 1. What we are building

A doctor today types or clicks through a case sheet, a prescription, lab
orders, a follow-up date and the bill, for every patient, in a 7–10
minute consultation. The assistant takes that work.

It behaves like a junior person sitting in the room with a notebook:

| Moment | What the assistant does |
|---|---|
| Before the patient walks in | Gives a five-line brief: ongoing problems, current medicines, what changed last visit, what is overdue. Built from the patient's past case sheets. |
| During the consultation | Listens (full conversation) or takes the doctor's short spoken summary. Says nothing, interrupts nothing. |
| When the doctor taps Stop | Shows a filled draft: complaint, history, diagnosis, notes, vitals if spoken, prescription lines, lab tests, follow-up date. |
| Before the doctor confirms | Points at what it is unsure of ("I did not catch the dose for Azithral") instead of guessing. |
| After the doctor confirms | Saves through the existing routes, adds the spoken charges to the visit's bill, books the follow-up, prints patient instructions. |
| End of day | Lists what is left open: notes not confirmed, labs awaited, follow-ups due tomorrow. |

Three rules make it feel like a person and not a form-filler:

1. **It learns the doctor's habits.** Each doctor's own most-used
   medicines, usual doses and frequent diagnoses are read from their
   past prescriptions and given to the model. "Pan 40" resolves to the
   brand and dose this doctor always writes.
2. **It admits what it missed.** A blank with a question is better than
   a confident wrong dose.
3. **It never saves by itself.** The doctor confirms every note. This is
   product principle 3 in `PRODUCT.md` (clinical safety outranks
   convenience), and published studies of deployed scribes report about
   5% of notes with a significant error.

What it is called in the product is the owner's decision. This document
says "the assistant".

---

## 2. Two ways to capture, one pipeline

| Mode | What the doctor does | Audio per visit | Accuracy | Cost |
|---|---|---|---|---|
| **Dictate** | Speaks a 20–40 second summary after examining | ~0.5 min | Highest: one speaker, clear speech, medical words said deliberately | Lowest |
| **Listen** | Taps once at the start, once at the end | ~8 min | Lower: two speakers, mixed Marathi/Hindi/English, room noise | 10–15× Dictate |

Both feed the same pipeline. Dictate ships first because it is cheap,
accurate, and already removes the typing. Listen is switched on per
doctor once Phase 0 proves it is accurate and affordable.

---

## 3. Architecture

```
 Doctor's tablet / phone (clinic-web, Encounter screen)
   │  MediaRecorder → Opus, 16 kHz mono
   │  silence trimmed in the browser (voice activity detection)
   │  20–30 s chunks, kept in IndexedDB until the server acknowledges
   ▼
 clinic-api  (that clinic's own container)
   │  POST /api/clinic/scribe/sessions/:id/chunks   (doctor's login only)
   │  each chunk is forwarded to speech-to-text as it arrives;
   │  audio is never written to disk and never stored
   ▼
 Speech-to-text provider  →  transcript text, appended to the session
   ▼
 On Stop: the note is built in four steps
   1. EXTRACT   LLM reads the transcript + patient context + doctor's
                habits, returns JSON in a fixed schema. Every value
                carries the transcript sentence it came from.
   2. RESOLVE   each medicine mention is looked up, in this order:
                doctor's own formulary → clinic pharmacy stock →
                the 246k-row Drug table (existing trigram search).
   3. CHECK     plain code, no AI: is the quoted sentence really in the
                transcript? is the frequency one of OD/BD/TDS/QID/SOS/
                STAT? is a dose present? does a medicine match the
                patient's allergies? is a medicine listed twice?
   4. LEFTOVER  list what was said but not placed anywhere.
   ▼
 Draft shown on the Encounter screen
   │  doctor edits, taps Confirm
   ▼
 Existing routes, unchanged, under the doctor's own token:
   POST /case-sheets · POST /prescriptions · POST /lab-orders
   POST /invoices/:id/items · POST /appointments (follow-up)
```

### Why it lives inside clinic-api

- **One clinic, one database** stays true. The transcript and the draft
  are rows in that clinic's own Postgres. There is no shared store of
  consultations across clinics.
- The container does almost no work. It relays 100 KB chunks and makes
  API calls, so the 1 GB droplet and the per-container memory cap are
  not a constraint. No speech model runs on the droplet.
- It follows the pattern `lib/translate.ts` already uses: provider keys
  in the deployment's env, a master switch, a cost guard.

### New pieces

| Piece | Where | Notes |
|---|---|---|
| `scribe` module key | `config/features.ts` + provider-api `plans.ts` | Off by default; routes not registered when off, like every other module. |
| `ScribeSession` model | `schema.prisma` | appointmentId, doctorId, mode, status, transcript, draft JSON, confirmed JSON, audio seconds, consent time, provider cost. |
| `DoctorHabit` (or a computed view) | `schema.prisma` / query | Top medicines with usual dose/frequency/duration, top diagnoses, per doctor. Rebuilt nightly from prescriptions. |
| `lib/scribe/` | clinic-api | `stt.ts` (provider adapters), `extract.ts`, `resolve-drugs.ts`, `checks.ts`. |
| `routes/clinic-scribe.ts` | clinic-api | start, chunk, stop, draft, confirm, discard. `requireClinicalWriteAuth`: doctors only. |
| `ScribePanel` | clinic-web, Encounter | Record button, live timer, draft review with tap-to-see-source, Confirm. |
| Usage report | provider-api | Audio minutes and notes per clinic per month, for billing and for watching margin. |

### The draft schema maps onto what already exists

| Draft field | Existing destination |
|---|---|
| chiefComplaint, hopi, diagnosis, notes, followUpDate | `CaseSheet` |
| bp, temp, spo2, weight, pulse | `Appointment.vitals` |
| medicines: drugId, drugName, dosage, frequency, duration, instructions | `PrescriptionItem` |
| tests | `LabOrder` items, matched to `LabTest` |
| charges | `InvoiceItem`, matched to `ServiceItem` |
| specialty form values | `SpecialtyRecord`, using the clinic's own `ClinicForm` definition as the schema |

No existing table changes shape.

---

## 4. How accuracy is earned

Accuracy does not come from one good model. It comes from five layers,
each catching what the one before it missed.

1. **Better audio.** A ₹1,500–2,500 USB or Bluetooth desk microphone
   beats a tablet's built-in mic across a desk. Recommended, not
   required. Mode default is Dictate, which is the easy case for any
   speech engine.
2. **The right speech engine, chosen by test.** No public benchmark
   exists for mixed Marathi-Hindi-English medical speech, so Phase 0
   measures it on real consultations.
3. **Context in the prompt.** The patient's allergies, chronic
   conditions and last visit, plus this doctor's habits. A model that
   knows the doctor writes "Tab Dolo 650 TDS x 3 days" hears a noisy
   "dolo" correctly.
4. **Medicines resolved against the database, not trusted from the
   model.** The model proposes; the Drug table decides. A name with no
   match is shown as unmatched, never invented.
5. **Deterministic checks and a human.** Step 3 above is code. Then the
   doctor reads and confirms.

Missed information is the most common scribe error in the published
studies and the hardest for a doctor to notice, which is why the
LEFTOVER list exists.

**The system improves from use.** Every confirmed note stores the draft
and the final version. The difference, per field, is the accuracy
measure and becomes the test set for every later prompt or model change.

---

## 5. What it costs to run

Assumptions, all to be replaced by measured numbers: one busy doctor, 40
patients a day, 26 days a month = 1,040 consultations. ₹88 to the US
dollar.

### Speech-to-text (the cost that matters)

| Setup | Audio hours / month | Rate | Cost / doctor / month |
|---|---|---|---|
| Listen, Sarvam with speaker labels | 139 | ₹45/hr | ~₹6,200 |
| Listen, Sarvam plain | 139 | ₹30/hr | ~₹4,200 |
| Listen, plain + silence trimmed (assume 35% removed) | 90 | ₹30/hr | ~₹2,700 |
| Listen, Gemini Flash audio (*unverified*: $1 per million audio tokens; per-hour figure depends on a token rate I could not confirm, roughly ₹10/hr if 32 tokens/second holds) | 90 | ~₹10/hr | ~₹900 |
| **Dictate**, Sarvam plain, 40 s per visit | 11.5 | ₹30/hr | **~₹350** |
| Listen, self-hosted open model on a rented GPU (*unverified*: about ₹1/hr of compute for Whisper-class models; Marathi accuracy unknown) | 90 | ~₹1/hr + fixed GPU rent | only cheaper at scale |

Speaker labels are dropped on purpose. In a consultation the model can
tell doctor from patient by what is said, and labels cost 50% more.

### The language model (small)

Per note: about 6,000 tokens in, 1,500 out, in two calls.

| Model | Price per million tokens (in / out) | Cost / note | Cost / doctor / month |
|---|---|---|---|
| Claude Haiku 5.5 | $0.10 / $0.50 | ₹0.15–0.50 | ₹150–500 |
| Claude Sonnet 5.5 | $2 / $10 | ₹2.50–4 | ₹2,500–4,000 |

Plan: Haiku 5.5 for every note, Sonnet 5.5 only when the checks in step
3 fail or the transcript is long and messy. Phase 0 decides whether
Haiku alone is accurate enough; if it is not, the stronger model's cost
goes into the price. The stable part of the prompt (instructions and
schema) is cached.

### Against your prices

Your list price for the Clinic plan is ₹3,000 a month
(`docs/PRICING-RESEARCH.md`). The market reference for a scribe is
EkaScribe at ₹1,499 per doctor per month.

| Offer | Run cost / doctor / month | Room at ₹1,499 |
|---|---|---|
| Dictate + brief | ₹500–850 | 43–67% |
| Listen on Sarvam plain + trimming | ₹2,850–3,200 | **loss** |
| Listen on a cheaper engine, if Phase 0 shows it is accurate | ₹1,050–1,400 | 7–30% |

So:

- **Dictate is profitable today** as a paid add-on.
- **Listen cannot be included in the ₹3,000 plan and cannot be unlimited
  at ₹1,499 on Sarvam's rate.** It needs a cheaper engine, or a monthly
  allowance of listening hours with a charge beyond it, or a higher
  price.
- The price itself is the owner's decision and is not set here.

Every session records its audio seconds and provider cost, so margin per
clinic is a number on the console, not a guess.

---

## 6. Scalability

| Question | Answer |
|---|---|
| Load on the droplet | Negligible. Small chunks relayed, no model on the box. 50 doctors recording at once is a few hundred KB per second in total. |
| nginx limits | Chunks are ~100 KB against a 12 MB body cap; each request finishes in seconds against a 120 s timeout. No config change. |
| Database | One row per session, text only. A year of one doctor's transcripts is tens of MB. Transcripts older than a set period can be deleted, keeping the confirmed note. |
| Provider limits | The real ceiling. Each clinic uses keys in its own env; rate limits and retries are handled per clinic. |
| Draft speed | Chunks are transcribed while the doctor is still talking, so at Stop only the last chunk and the note-building remain. Target under 10 seconds; to be measured. |
| Speech provider down | Audio chunks stay in the browser and retry. The doctor types as they do today. The assistant never blocks care. |
| Growth past ~50 heavy-use doctors | Add one shared GPU transcription service: audio in, text out, nothing stored, no patient identifiers sent. Clinics' data still lives only in their own databases. |

---

## 7. Privacy and law

- **Consent per visit**, shown as a tick on the Encounter screen before
  recording can start, stored on the session and written to the audit
  log. A visible recording indicator stays on screen.
- **Audio is not stored.** Transcribed and discarded.
- **No identifiers go to the language model.** Name, phone, UHID and
  address are not in the prompt; the model sees "the patient".
- **India-hosted speech engine preferred**, which avoids the
  cross-border question for audio. Transcript text to a model hosted
  abroad is a transfer the clinic's privacy notice must state.
- Most DPDP obligations for clinics start 13 May 2027 per the sources
  found; the date should be confirmed against the gazette, and the
  consent wording reviewed by a lawyer before the first paid clinic.
- **Translation rule kept.** Patient instructions in Marathi are
  wording only; medicine names, doses and frequencies are printed
  exactly as the doctor confirmed them.

---

## 8. Feasibility: the real risks

| Risk | How bad | What we do |
|---|---|---|
| Speech accuracy on mixed Marathi-Hindi-English is unknown | Decides whether Listen ships at all | Phase 0 test on real consultations. Dictate does not depend on it. |
| Medicine names misheard | Patient safety | Database resolution, doctor's formulary, unmatched shown as unmatched, doctor confirms. |
| Listen costs more than the market price | Margin | Dictate first; cheaper engine or allowance for Listen. |
| Noisy OPD room, phone on the desk | Accuracy | Desk microphone; Dictate. |
| Doctor does not trust it | Adoption | Source sentence on every field; nothing saved without confirm; start with one doctor. |
| Phone screen locks and recording stops | Reliability | Screen wake lock while recording; chunks saved locally; tested on the actual tablet and phones in the clinic. |

---

## 9. Build order

| Phase | What | Time | Gate to pass |
|---|---|---|---|
| **0. Test** | Record 20–30 real consultations and 30 dictations at Vadgaonkar Clinic with consent. Run each through 2–3 speech engines and both models. A script scores medicine-name accuracy, field accuracy and cost. | ~1 week | A named engine and model, with measured accuracy and measured cost per note. |
| **1. Dictate + brief** | `scribe` module, session model, record button, draft review, confirm into case sheet and prescription, pre-visit brief, doctor habits, usage metering. | ~2 weeks | The clinic's doctor uses it for a full day and edits fewer fields than they would have typed. |
| **2. Listen** | Chunked upload, silence trimming, leftover list, consent flow. | ~2 weeks | Phase 0 accuracy holds in the live room; cost per note is inside the agreed price. |
| **3. Actions** | Lab orders, charges onto the bill, follow-up booking, specialty forms, Marathi patient instructions, end-of-day list. | ~2 weeks | Each action confirmed by the doctor, none automatic. |
| **4. Cost** | Only when volume justifies it: shared GPU transcription service. | later | Cheaper per hour than the API at current volume. |

Time estimates assume one developer and are guesses until Phase 0 is
done.

---

## 10. Decisions needed from the owner

1. May consultations be recorded at Vadgaonkar Clinic for the Phase 0
   test, with each patient's consent?
2. Is the assistant a paid add-on per doctor, and at what price? Section
   5 gives the cost floor for each option.
3. What is it called in the product?

---

## Sources

- EkaScribe pricing and languages: https://ekascribe.ai/ ,
  https://patientsquare.com/in/blog/india-ai-scribe-comparison/
- Sarvam speech-to-text pricing:
  https://smallest.ai/blog/sarvam-ai-speech-to-text-pricing ,
  https://apis.io/plans/sarvam/sarvam-plans-pricing/
- Sarvam Saaras V4:
  https://www.marktechpost.com/2026/09/26/sarvam-ai-releases-saaras-v4-a-speech-to-text-model-for-all-22-indian-languages-and-global-english/
- Gemini 2.5 Flash audio pricing (third-party listings):
  https://klymentiev.com/blog/gemini-api-pricing ,
  https://www.aipricing.guru/models/gemini-2-5-flash/
- Self-hosted Whisper cost: https://www.runpod.io/articles/guides/best-gpu-for-whisper
- Scribe error studies: https://escholarship.org/uc/item/9r89g3sp ,
  https://www.jmir.org/2025//e64993 , https://arxiv.org/pdf/2608.31017
- DPDP timeline: https://patientsquare.com/in/blog/dpdp-rules-2025-clinic-timeline/ ,
  https://verticomply.com/blog/dpdp-rules-2025-health-apps-india
- Claude model prices: Anthropic's published API rates as cached
  2026-10-06.
