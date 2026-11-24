# Clinic assistant: test run, 25 November 2026

A full run of the assistant in a real Chrome browser, against the real
speech service (Sarvam Saaras v4) and the real language model (Claude
Haiku 5.5), on a throwaway local database with made-up patients.

The raw numbers behind everything below are in [results.json](results.json).

## What was tested, and how

| | |
|---|---|
| Browser | Chrome, driven by a script, desktop (1280 px) and phone (390 px) |
| Microphone | Chrome's test microphone, fed a 25-second recording of a computer voice reading a dictation in English, followed by silence |
| Database | A local Postgres made for this test: 14 invented patients, the 246,068-medicine catalogue, 23 lab tests |
| Automated tests | 91 in the clinic API (38 of them for the assistant), all passing |

## 1. Listening: the note writes itself while the doctor talks

The doctor ticks consent, taps **Start listening** and talks. The speech
is cut at each pause and sent, so the note on screen fills in a few
seconds after each thing is said.

| When | What was heard | What appeared on screen |
|---|---|---|
| 6 s | "Complaint fever and dry cough for 3 days. Diagnosis viral fever." | Complaint, Diagnosis |
| 15 s | "BP 130 by 80. Tablet Dolo 650, twice a day, for five days, after food." | BP 130/80, Dolo 650 Tablet · 1-0-1 · BD · 5 days · After food |
| 21 s | "Capsule PAN 40, once daily, before food, for 2 weeks." | PAN 40 Tablet · 1-0-0 · OD · 2 weeks · Before food |
| 29 s | "Do a CBC review after one week." | CBC ordered, follow-up in 7 days |

Every word was heard correctly. The silence after the dictation was not
sent to the speech service, so it was not paid for.

Before starting:

![The visit before the assistant is used](03-visit-before.png)

Ten seconds in:

![Listening, 10 seconds](05-listening-10s.png)

### The doctor can leave the visit and it keeps listening

Mid-recording, the test opens **All patients**, as a doctor would to look
something up. The listening does not stop. A bar at the bottom of every
screen shows who is being listened to, for how long, what is being
written and how much speech has been heard, with a Stop button.

![Still listening on another screen](06-listening-while-on-another-screen.png)

Tapping the bar goes back to the visit, where the note has kept filling
in while the doctor was away:

![Back on the visit](07-listening-back-on-the-visit.png)

The timings in the table above are from an earlier run of the same
recording; this run's are in results.json and differ by a second or two.

## 2. Stop: the note becomes the doctor's to check

On **Stop and check the note** the same note opens as an editable form.
Each medicine shows the words it was heard in. When the rules alone can
read the whole note this takes under half a second and costs nothing in
language-model fees; in the last run the microphone clipped the first
word, the rules could not place the complaint, and the language model
read it through instead, which took 6.7 seconds.

![The draft after listening](08-draft-from-listening.png)

## 3. Confirm: the visit's records are written

**Confirm and save** wrote the case sheet, the prescription (2 medicines)
and the lab order together, and marked the visit as seen. A second
confirm of the same note was refused.

![The visit after saving](09-visit-after-saving.png)

## 4. A Hindi-English conversation, and an allergy

A typed conversation in Hindi and English, on a patient whose file lists
a penicillin allergy. The doctor in the conversation prescribes
amoxicillin.

![The conversation as typed](10-typed-conversation.png)

The language model wrote the note in 6.7 seconds:

- Complaint: Sore throat x 4 days with fever
- History: Sore throat x 4 days, fever, painful swallowing. Mild cough. No ear pain. On examination: tonsils swollen and red.
- Diagnosis: Acute tonsillitis
- Vitals: BP 126/82, temperature 101, pulse 96
- Medicines: amoxycillin 500 mg 1-1-1 for 5 days after food; Dolo 650 1-1-1 for 3 days
- Tests: CBC. Follow-up: 5 days.

The amoxycillin line carries a red warning: the patient's file lists an
allergy to penicillin and this medicine may be related to it. The draft
was discarded, and nothing was saved.

![The draft with the allergy warning](11-draft-with-allergy-warning.png)

## 5. On a phone

A dictated children's note at 390 px wide, read by rule in 0.15 seconds.
No part of the page scrolls sideways.

![The visit on a phone](12-phone-visit.png)

![The draft on a phone](13-phone-draft.png)

## What this run does not show

- **Real Hindi or Marathi speech.** The laptop has only English computer
  voices, so the spoken test was in English. The Hindi-English
  conversation was typed, not spoken.
- **A real consulting room.** No background noise, no second speaker, no
  phone lying on a desk.
- **The language model writing while listening.** The dictation named its
  own sections, so the rules were enough and the model was not called
  during listening. The mid-consultation model pass is built and unit
  tested, and has not been watched in a browser.
- **A real doctor's speed of speech and habits.**

## Faults this run found

| Fault | State |
|---|---|
| Every file upload in the app could hang for ever when an error followed the upload | Fixed |
| The note only appeared after Stop, not while talking | Fixed: it now fills in at each pause |
| A dose was left blank for "din mein teen baar" | Fixed |
| "Tab Azithromycin 500 roz" was read with "roz" in the name | Fixed |
| An allergy written as a family ("Penicillin", "Sulfa drugs") did not flag a member of it | Fixed for penicillins, sulfa drugs, NSAIDs, cephalosporins, quinolones |
| Vitals in the draft had no labels once filled in | Fixed |
| Leaving the visit screen stopped the recording | Fixed: the recorder lives above the screens and a bar follows the doctor |
| A refused save looked like a save that never finished: the reason was shown a screen above the button | Fixed: the reason is beside the button and the line at fault is outlined |
| A warning about a medicine stayed after the doctor typed a different name over it | Fixed |
| "Dolo 650 tablet करू" put "करू" on the prescription | Fixed |
| Only the patient's name and phone were removed before the language model read the text | Fixed: address, email, file number, emergency contact and the doctor's name are removed too |
| A medicine said by its salt ("Amoxicillin 500", "Zinc 20") is matched to one arbitrary brand | Open. It is flagged as a close match and other brands are offered, but the first pick is not meaningful. |

## What it cost

| | |
|---|---|
| Speech-to-text, 25 seconds | about ₹0.20 at ₹0.49 a minute |
| Language model, one conversation | about 2,500 tokens in and 1,300 out on Claude Haiku 5.5: roughly 8 paise |
| A dictated note with named sections | nothing beyond the speech-to-text |
