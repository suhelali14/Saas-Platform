# The clinic assistant

Written for: whoever switches the assistant on for a clinic, changes what
it can do, or has to explain what it costs. Current as of 25 November
2026, on the `clinic-assistant` branch.

It is two things that share one microphone and one bar on the screen:

1. **It listens to a consultation and writes the note.** The doctor taps
   once, talks to the patient, and the case sheet, prescription, tests
   and follow-up fill in on screen as they speak. The doctor checks it
   and confirms.
2. **It does what it is asked.** A line at the foot of every screen.
   Somebody types or says what they want ("who is next", "show her last
   prescription", "add his wife to the family", "give him sick leave for
   three days") and the app does it. They do not need to know where
   anything is.

Nothing it does changes a patient's record without a person pressing
Confirm on a card that says exactly what will be changed.

Test evidence, with screenshots: `docs/assistant-test-2026-11-25/`.
The original plan and cost reasoning: `docs/AI-ASSISTANT-PLAN.md`.

---

## 1. Switching it on for a clinic

The assistant is the `scribe` module. It is off unless the clinic's env
file names it.

| Setting | What it does | Without it |
|---|---|---|
| `CLINIC_FEATURES` includes `scribe` | Registers the assistant's routes and shows the bar | The assistant does not exist for that clinic: its routes 404 |
| `SARVAM_API_KEY` | Speech-to-text | No listening and no hold-to-talk. Typing still works. |
| `ANTHROPIC_API_KEY` | The language model | Only what the rules can read is filled in, and only requests a rule recognises are answered |

Optional, with their defaults:

| Setting | Default | Meaning |
|---|---|---|
| `SCRIBE_MODEL` | `claude-haiku-5-5` | The model for notes and for choosing actions |
| `SCRIBE_LANGUAGE` | `unknown` | Speech language. `unknown` detects it per piece. |
| `SCRIBE_MAX_MINUTES` | `30` | Longest one visit may be listened to |
| `SCRIBE_LIVE_SECONDS` | `40` | While listening, seconds of new speech between model passes. `0` uses the model only at the end. |
| `ASSISTANT_DAILY_AUDIO_MINUTES` | `600` | Clinic-wide ceiling on listening per day |
| `ASSISTANT_DAILY_MODEL_CALLS` | `3000` | Clinic-wide ceiling on model requests per day |

On the server these go in `/srv/clinic/env/<slug>.env`, with no quotes
around the values, followed by a restart of that clinic's container.
`CLINIC_FEATURES` is rewritten by the console when a plan is applied, so
switch the module on from the console rather than by hand.

**The migration `20261125090000_scribe_sessions` adds one table,
`ScribeSession`.** It is applied by the normal deploy.

---

## 2. How a request is handled

```
 what was typed or said
        │
        ▼
 RULE     lib/assistant/router.ts        free, a few milliseconds
        │  no rule recognised it
        ▼
 MODEL    lib/assistant/pick.ts          one short call, about a second
        │
        ▼
 CHECK    lib/assistant/ask.ts           is this action this person's to
        │                                use, are the parameters valid
        ▼
 DO       lib/assistant/actions.ts       a lookup or a screen runs now;
                                         a change comes back as a card
```

- **Rules first.** In the test run of 44 requests, 23 were answered by
  rule in under 150 ms at no cost, in English, Hindi and Marathi.
- **The model only chooses.** It is shown the list of actions the asker
  may use and the request. It is given no patient records. What it
  returns is validated against the action's own schema.
- **A change calls the app's own route**, from inside the server, with
  the asker's own sign-in. The role check, the validation and the audit
  entry are the ones the screen's own Save button gets.

### Adding something the assistant can do

Add one entry to `ACTIONS` in `lib/assistant/actions.ts`: a name, a
sentence describing it, who may use it, and a `run` function. For a
change, add a `preview` that returns the confirm card and make `run`
call the existing route with `context.call`. Nothing else changes. If
the request is common, add a pattern to `router.ts` so it costs nothing.

A clinic's specialty forms need no entry. `lib/assistant/forms.ts`
builds an action from each form's definition, so a form the clinic
creates later can be filled in by voice the same day.

### What it can do today

| Lookups | Screens | Changes (each confirmed) |
|---|---|---|
| Find a patient | Any screen by name | Add a family member |
| Patient in brief | | Record vitals |
| Last prescription | | Book a visit |
| Lab results | | Order lab tests |
| Past visits; a visit by its date | | Write a prescription |
| Vitals over time | | Add a charge to the bill |
| What the patient owes | | Issue a certificate |
| Family members | | Add to today's queue |
| Today's queue | | Register a patient |
| What needs attention | | Fill in a specialty form |
| Follow-ups due; who has stopped coming | | |
| The day's takings | | |
| The assistant's own usage and cost | | |

---

## 3. How a consultation becomes a note

```
 microphone (browser)
   cut at each pause in speech, 5 to 18 seconds a piece
   a piece with nobody speaking is not sent
        ▼
 speech-to-text, one piece at a time; the audio is not stored
        ▼
 the note so far is rebuilt after every piece
   RULES    lib/scribe/structure.ts   vitals, medicines, tests, follow-up
   MODEL    lib/scribe/model.ts       complaint and history, every
                                      SCRIBE_LIVE_SECONDS of new speech
   RESOLVE  each medicine against the doctor's own past prescriptions,
            then the catalogue
   CHECK    lib/scribe/checks.ts      allergy, same salt twice, missing
                                      dose, dose and frequency disagree,
                                      a line that cannot be traced
        ▼
 Stop: one last reading, then the doctor edits and confirms
```

The recorder lives in the portal's shell (`contexts/ScribeContext.tsx`),
so the doctor can open any other screen while it listens. Reloading or
closing the tab ends it; the browser warns first.

The engine in `lib/scribe/engine.ts` imports no database and no web
framework. It is given a host (`clinic-host.ts`) and a reader
(`model.ts`), so it can be run behind a different product by writing a
different host.

---

## 4. What it costs

Measured on the test clinic, 25 November 2026. Speech at Sarvam's
published ₹0.49 a minute; model at Claude Haiku 5.5's published rates,
₹88 to the dollar.

| | Measured |
|---|---|
| A request answered by rule | nothing |
| A request that needed the model | about ₹0.02 (21 requests cost ₹0.40) |
| A typed Hindi-English conversation turned into a note | about ₹0.08 |
| Speech-to-text | ₹0.49 for each minute of speech actually sent |
| The owner's own spoken consultation: 110 seconds of speech sent, model passes while listening | about ₹1.10 |

**Speech is the cost that matters.** A doctor seeing 40 patients a day
with two to four minutes of real speech in each would cost roughly
₹1,000 to ₹2,500 a month in speech-to-text. That figure is an estimate
from one spoken test, not a measurement of a real clinic.

What keeps it down:

- Silence is not sent. Pieces are checked for speech in the browser.
- Speaker labels are not used; they cost about 20% more on the published rate.
- Rules answer what they can before any model is called.
- The fixed list of actions is cached by the model provider.
- Daily ceilings stop a fault from running on.

An admin can ask the assistant "how much has the assistant cost" for
the count and the estimate. The providers' invoices are the exact
figures.

**Not yet done:** a second, cheaper speech engine. Gemini's audio price
appears to be about a third of Sarvam's; that price and its Marathi
accuracy are both unverified.

---

## 5. Privacy and safety

- **Audio is never stored.** It is transcribed and discarded. There is no
  column for it.
- **Consent per visit** is ticked before listening can start, stored on
  the session, and checked again by the server.
- **Before a model reads a consultation**, the patient's name, phone,
  address, email, file number and emergency contact, and the doctor's
  name, are removed, along with any email address or long run of digits.
  It cannot remove a name it was never told, such as a relative greeted
  in the room.
- **The speech service receives the raw audio**, including any name
  spoken. Audio cannot be cleaned before it is transcribed.
- **A typed or spoken request** is sent to the model as it was said when
  no rule recognises it. "Find patient Ramesh Joshi" is handled by rule
  and reaches no model; an unusual request that names a patient does.
- **The model is given no records.** Lookups are done by code.
- **Usage counters** hold numbers only. The server log records which
  action ran and how many tokens it used, never the words.
- **The transcript of a confirmed note is kept**, so the difference
  between what was drafted and what the doctor confirmed can be
  measured. A discarded session's transcript is deleted.

Most DPDP obligations for clinics start on 13 May 2027 according to the
sources found; confirm the date against the gazette and have the consent
wording reviewed before the first paying clinic uses listening.

---

## 6. What is not proven

- **A real consulting room.** Every spoken test so far was one person at
  a laptop, or a computer voice. No background noise, no second speaker.
- **Marathi and Hindi at volume.** One real mixed-language recording was
  transcribed accurately. One is not a measurement.
- **The model writing while listening**, watched in a browser on a real
  conversation. It is built and unit-tested.
- **A medicine said by its salt** ("Amoxicillin 500") is matched to one
  arbitrary brand. It is flagged and other brands are offered.
- **Load.** One clinic, one user at a time. Nothing has been run with
  several doctors recording at once.
- **The live server.** Nothing has been deployed. See section 7.

---

## 7. Before merging to master

Merging deploys to every clinic and runs the migration on every clinic's
database.

1. With the module off, the only effect on a live clinic is one new
   empty table and code that does not run. Confirm that by deploying to
   the demo clinic first and signing in.
2. This branch also changes shared code, which affects every clinic
   whether or not the assistant is on:
   - `app.ts` now reads the real client address behind nginx. Rate
     limits become per client address rather than shared by everyone,
     and the audit log records real addresses.
   - `app.ts` no longer swallows an error that follows a file upload.
3. Rotate the two API keys that were pasted into a chat during testing.
4. Decide the price. Section 4 is the cost floor.
