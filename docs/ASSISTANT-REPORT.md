# The clinic assistant: where it stands, what it costs, and whether it will sell

Written for: the owner. 25 November 2026. Everything here is on the
`clinic-assistant` branch; nothing is merged or deployed.

## The short version

- **It works on a test clinic.** A whole clinic day was run through it in
  plain English, Hindi and Marathi, as a doctor, reception, a nurse and
  the pharmacist: 38 of 39 requests did the right thing, and the one
  miss is fixed.
- **It is not ready to sell yet.** Nothing has been tried in a real
  consulting room, on the live server, or with real Marathi speech at
  volume. Those three are the gap between "works" and "product".
- **Running it costs about ₹1.20 to ₹2.40 for each consultation it
  listens to.** Almost all of that is speech-to-text.
- **At today's speech price the margin is thin.** Competitors sell
  note-writing at ₹700 to ₹2,000 a doctor a month. A busy doctor using
  ours all day costs about ₹1,400 a month to serve. Either the plan is
  metered, or the speech engine gets cheaper.
- **Clinics do pay for this.** Several Indian products sell exactly the
  note-writing half at public prices. Nobody found sells the other
  half: an assistant that works the whole app by voice, inside each
  person's permissions. Whether clinics want that half is unproven.

## 1. What it does today

| | |
|---|---|
| Listens to a consultation and writes the note, medicines, tests and follow-up | Built, tested with typed and one spoken consultation |
| Does what it is asked from a bar on every screen | 48 things for the doctor's login, fewer for others |
| Remembers the conversation; takes corrections without a second record | Built, tested typed |
| Several instructions in one go; stays listening until told to stop | Built; several-in-a-row by live voice untested |
| Works inside each login's permissions | Tested: reception, nurse and pharmacist were each refused what is not theirs |
| Nothing is saved without a yes | Every change is a card first |
| A new feature can describe itself to the assistant | Built; three features work this way |

### How much of the app it covers

Counted from the code, not estimated. Of 99 things the app can change,
**23 can be done by voice.** The 76 that cannot are listed in
`apps/clinic-api/test/assistant-coverage.baseline.json`. A check now
fails the build if a new feature is added without saying whether the
assistant may use it, so this number can only go up.

Covered well: the queue, visits, prescriptions, tests and results,
bills and payments, booking requests, patient details.

Not covered at all: everything for hospitals (admissions, beds, wards,
operation theatre, radiology, claims, cash counter), staff logins,
settings, the website editor, file uploads.

So today it is an assistant for a **clinic**, not for a hospital.

## 2. Testing done

Nine rounds, each asking for features the way a person would and
confirming every change. Results are in
`docs/assistant-test-2026-11-25/qa/`.

| Round | What | Passed |
|---|---|---|
| 1 to 4 | Every feature, then in Hinglish and Marathi, then a whole visit | 129 of 151 over four rounds, each round fixing the last |
| 5 | Nurse, allergies, misheard words, role limits | 31 of 34 |
| 6, 7 | Several things in one sentence | 11 of 13, then 8 of 8 |
| 8 | Features that describe themselves | 12 of 12 |
| 9 | A whole clinic day, fresh patients, four logins | 38 of 39 |

Also 121 unit tests, all passing.

What these rounds do not prove: they were **typed**. Speech adds its own
mistakes, mostly in names and numbers.

## 3. What it costs to run

### Measured unit costs

| | Cost | How it was measured |
|---|---|---|
| Speech-to-text | ₹0.49 a minute of speech sent | Sarvam's published ₹30 an hour; silence is not sent |
| One request that needs the model | ₹0.02 | 20 requests on the test clinic, with the provider's caching counted |
| One request answered by rule | nothing | About a quarter of requests in the day-long test |
| One spoken consultation written up | about ₹1.10 | The owner's own, 110 seconds of speech |

The cost meter in the app was under-reporting model cost by about four
times (it ignored cached text). That is fixed; the ₹0.02 is the
corrected figure.

### By size

Assumptions, which are mine and not measured: two to four minutes of
actual speech in a consultation; 26 working days; every consultation
listened to; 15 spoken or typed requests a day for each member of staff.

| | Patients a day | Running cost a month |
|---|---|---|
| One doctor | 30 | ₹950 to ₹1,900 |
| Three doctors | 90 | ₹2,900 to ₹5,700 |
| Ten doctors (polyclinic) | 300 | ₹9,500 to ₹19,000 |
| 50-bed hospital, out-patients only | 400 | ₹12,500 to ₹25,000 |

If the doctor listens to only half the consultations, halve these. If
the staff only use typed and spoken commands and no listening, the cost
is under ₹150 a month for a whole clinic.

Server cost is not in these figures. The assistant adds no server of its
own; it runs inside the clinic's existing one.

### The same with a cheaper speech engine

Gemini's audio price appears to be about a quarter of Sarvam's (about
₹0.13 a minute, from third-party price trackers, not Google's own page).
If its Marathi is good enough, every figure above falls to roughly
40 percent. That accuracy is untested and is the single most valuable
thing to find out.

## 4. Will real clinics buy it

### What is sold in India now

| Product | What it is | Price |
|---|---|---|
| EkaScribe | Note-writing from a consultation | about ₹19,999 a doctor a year (aggregator listings) |
| Patient Square | The same | ₹1,599 a doctor a month |
| VivaLyn MedScribe | The same | ₹699 to ₹1,100 a month; the ₹1,100 plan is capped at 100 consultations |
| Augnito | Mostly dictation | ₹2,000 to ₹5,000 a month (a competitor's figure) |
| Clinic software (Practo Ray, Clinicea, and others) | Records, queue, billing | ₹999 to ₹3,000 a doctor a month |
| HealthPlix | Clinic software | Reported free, paid plans on request |

What this says:

- **There is a paying market** for the note-writing half at ₹700 to
  ₹2,000 a doctor a month. Eka Care says more than 1,000 private doctors
  use its scribe; that is the company's own number.
- **The price ceiling is low.** Free clinic software exists, and a
  competitor argues US prices of $200 to $400 a month are out of reach
  for Indian practices.
- **Nobody found sells "an employee inside your software"**: an
  assistant that registers the patient, takes the payment, enters the
  lab result and answers "who is next", each inside that person's
  permissions. That is either the opening or a sign nobody wants it.
  Searches cannot tell which. Only clinics can.

### Against a person

A medical receptionist in India earns roughly ₹15,000 to ₹18,000 a
month, and a medical scribe about ₹19,000 (small samples). The assistant
would be sold at about a tenth of that. It does not replace the
receptionist; it removes the typing from the doctor and the desk.

### Hospitals

Hospital software is sold by quotation, per module and per bed, and no
public price was found for voice documentation in it. Our assistant
covers none of the hospital modules today, so a hospital sale is not
something to plan on yet.

### What I could not find

No independent survey of what Indian doctors will pay, no count of
clinics using any scribe, and no reliable count of private clinics.
Most price figures above come from sellers' own pages or blogs.

## 5. What to charge

At Sarvam's speech price a doctor who uses listening for every patient
costs about ₹1,400 a month to serve. Selling that at ₹1,499 makes
nothing. Three ways through:

1. **Meter it.** A base of about ₹499 a month for the command bar
   (costs under ₹150 to serve), plus listening sold in packs: for
   example 300 consultations for ₹999. That is ₹3.30 a consultation
   against ₹1.20 to ₹2.40 of cost.
2. **Cut the speech cost first**, then sell flat. With Gemini at the
   price found, ₹1,499 a month unlimited would leave about 60 percent
   at full use.
3. **Bundle it** into the top clinic plan and let it be the reason to
   buy that plan, with a fair-use cap.

My recommendation: start with 1 on the live clinic, because it cannot
lose money, and move to 2 once the cheaper engine is proven.

## 6. What must happen before selling

In order:

1. **Rotate the two API keys.** They were pasted into a chat.
2. **Deploy to the demo clinic** and sign in as an admin and a doctor.
   The branch changes shared code that affects every clinic.
3. **A real doctor, a real room, one week.** Count how many notes are
   saved without correction. That number is the product.
4. **Measure Marathi and Hindi** on at least twenty real recordings,
   Sarvam against Gemini.
5. **Have the consent wording reviewed** against the DPDP rules.
6. **Decide the plan and price**, from section 5.

Not needed before the first sale: hospital modules, the remaining 76
actions, a separate product for other software makers.

## 7. Risks, plainly

- **Accuracy by voice is unproven.** Every strong number in this report
  is from typed tests.
- **Names of new patients will be misspelt** when spoken. They can now
  be corrected in one sentence or by typing over the card, and a
  correction never makes a second record. It will still happen.
- **Personal data does leave the clinic.** The speech service receives
  the audio as spoken. A request that names a patient reaches the model
  with the name in it. Records themselves do not.
- **One paying clinic.** Everything about demand above is from other
  companies' prices, not from our own customers.

## Sources

- [Capterra India: EkaScribe](https://www.capterra.in/software/1095338/EkaScribe)
- [Patient Square: scribe against transcription cost](https://patientsquare.com/in/blog/ai-medical-scribe-vs-transcription-cost-india/)
- [VivaLyn MedScribe pricing](https://www.vivalynlabs.com/medscribe/pricing)
- [VivaLyn: AI scribes in India](https://www.vivalynlabs.com/blog/best-ai-medical-scribe-software-india)
- [MedTech Spectrum: EkaScribe](https://medtechspectrum.com/news/16/24807/eka-cares-ai-powered-ekascribe-transforms-clinical-documentation-for-doctors-across-india.html)
- [Clinic software cost in India 2026 (codingclave)](https://codingclave.com/guides/clinic-management-software-cost-india-2026)
- [Clinic software for small clinics compared (cufront)](https://www.cufront.com/blog/best-clinic-management-software-small-clinics-india)
- [Clinic management software buyer's guide (ecybertech)](https://www.ecybertech.com/blog-clinic-management-software-guide)
- [Bain: AI in Indian healthcare delivery](https://www.bain.com/es/insights/ai-in-indian-healthcare-delivery/)
- [KLAS: India EMR 2025](https://klasresearch.com/report/india-emr-2025-an-initial-look-at-adoption-in-a-rapidly-evolving-market/3650)
- [Sarvam speech-to-text pricing (smallest.ai)](https://smallest.ai/blog/sarvam-ai-speech-to-text-pricing)
- [Gemini API pricing (Google)](https://ai.google.dev/gemini-api/docs/pricing)
- [Payscale: medical receptionist salary in India](https://www.payscale.com/research/IN/Job=Medical_Receptionist/Salary)
- [Indeed India: medical scribe salaries](https://in.indeed.com/salaries/medical-scribe-Salaries)
- [G2: Aarogya HIMS pricing](https://www.g2.com/products/dataman-hims-hospital-information-management-system/pricing)
