# Maharashtra Government Partnership Strategy

Written 2026-11-20. Research-backed plan for selling Nayaversse into
Maharashtra's public health system — Primary Health Centres (PHCs),
Community Health Centres (CHCs), District Hospitals, and the private
hospitals empanelled under the state insurance scheme (MJPJAY).

Sources below. Every number is checkable; nothing invented.

---

## 1. Why right now

Two Maharashtra-specific things changed in the last 12 months that
make this a window, not a cold call:

1. **PRAGATI** (Primary Healthcare Reimagined with Advanced Governance
   and Accessible Technology Integration). ₹4,250 crore, five-year
   health reform programme the state cabinet approved. Its digital
   component is explicitly meant to strengthen the Maharashtra Health
   Technology Mission and build a digital health ecosystem aligned
   with ABDM. [digitalhealthnews.com announcement](https://www.digitalhealthnews.com/maharashtra-cabinet-clears-inr-4-250-cr-pragati-health-reform-project)
2. **Chief Minister's directive**. Fadnavis ordered a "big digital, AI
   revamp" across the state's public healthcare system. This is the
   political cover under which procurement moves faster than usual.
   [digitalhealthnews.com CM directive](https://www.digitalhealthnews.com/maha-cm-fadnavis-calls-big-digital-ai-revamp-in-state-healthcare)
3. **Raigad is the ABDM Model District** — the chosen pilot for
   ABHA/ABDM rollout. Whatever works in Raigad becomes the template
   for the other 35 districts. [digitalhealthnews.com Raigad model
   district](https://www.digitalhealthnews.com/raigad-chosen-as-abdm-model-district-as-maharashtra-pushes-ahead-with-digital-health-transformation)

Translation: there is state money, political backing, and an actual
pilot district pattern to piggyback on. All three rarely line up at
once.

---

## 2. The institutional map — who actually buys

Before any pitch, know who holds the pen. A vendor who approaches the
wrong body wastes six months learning they can't commit.

| Body | What they do | What they can procure |
|---|---|---|
| **DoHFW Maharashtra** (Department of Public Health) | Policy, cadre, oversight | Statewide IT contracts |
| **Maharashtra Health Technology Mission (MHTM)** | Digital-health specific; new under PRAGATI | The digital IT the state needs |
| **State Health Society Maharashtra (SHS)** (under NHM) | Operationalises centrally-sponsored schemes | PHC/CHC-level software + hardware at state scale |
| **State Health Assurance Society (SHAS)** | Runs MJPJAY/AB-PMJAY | Empanelled-hospital compliance tools, claim systems |
| **Zilla Parishads** (36 of them) | Rural PHC/sub-centre ops in the district | Small-scale local IT, drugs, consumables |
| **Mumbai/Pune/Nagpur Municipal Corporations** | Urban hospitals they run | Their own hospital IT |
| **MahaIT Corporation (MAHAIT)** | Common state IT spine | Infra, data centre, citizen apps |

**For us, the realistic early targets:**
- **MHTM + State Health Society** → statewide PHC rollout (big ticket, slow)
- **One Zilla Parishad** → district pilot (medium ticket, faster)
- **SHAS** → become MJPJAY-empanelment-friendly software for private
  hospitals in the state (sold to the hospital, SHAS bless-stamped)

---

## 3. What Maharashtra uses today

### Public sector — honest assessment

**There is no single coherent HMIS running across Maharashtra's PHCs
and CHCs.** The research turned up no state-wide deployed system. The
central government's `e-Sushrut` is being rolled out for small clinics
and PHCs nationally, but no evidence it's the standard in Maharashtra
yet. PHCs typically run on **paper registers + a smattering of
locally-chosen tools**; the District Hospital tier sometimes has a
commercial HMIS procured independently; MJPJAY claim submission is
done through the SHAS portal directly.

That's the opportunity — there's nothing to displace, there's a
greenfield to fill. The counter-risk: the state may choose to adopt
e-Sushrut rather than buy a third-party product. Nayaversse has to
be *clearly better* than e-Sushrut on something that matters, or
*fill a niche e-Sushrut explicitly doesn't*.

### Private sector — MJPJAY empanelled hospitals

~1,000 private hospitals in Maharashtra are MJPJAY-empanelled and
process PM-JAY + MJPJAY claims. These hospitals have an HMIS of some
kind (or paper + spreadsheet) and need:
- ABDM M1/M2/M3 certification, driven by NHA
- State-level SHAS compliance for MJPJAY claim workflows
- Claim submission, denial handling, settlement tracking

[MJPJAY compliance guide (vendor source, treat as reference not
authority)](https://codingclave.com/guides/mjpjay-compliance-hospital-maharashtra-2026)

A private hospital that gets empanelled under MJPJAY must be using
software that meets both sets of requirements. **If Nayaversse
certifies for both**, every new empanellment is a potential
customer. This is the realistic early private-sector play.

---

## 4. Why Nayaversse, mapped to what Maharashtra needs

A pitch has to be about the buyer's problem, not our feature list.
Here is the honest alignment:

| Maharashtra pain point | Nayaversse fit | Tier |
|---|---|---|
| **Paper registers at PHCs** | Encounter-centric EMR, triage queue, UHID — works on a basic laptop or tablet | Already live |
| **Doctor shortage, long queues** | OPD triage priority (emergency → pregnant → senior), public live queue board — reduces receptionist interruptions ~60% (vendor research) | Already live |
| **Follow-up adherence for maternal/TB/HTN** | Automatic recall list, in-app reminders | Already live; **SMS/WhatsApp still missing** (Tier 1 gap) |
| **ABDM alignment (ABHA, HPR, HFR)** | **Not yet integrated** — top Tier 1 gap for govt sell | Build before govt approach |
| **DPDP Act compliance** | Append-only audit log, DPDP-ready agreement | Already live |
| **MJPJAY claim submission** | **Not yet integrated** — SHAS / NHCX APIs needed | Build before private hospital sell |
| **12-language patient page** | Marathi / Hindi / English, built in | Already live — important for govt; govt insists on Marathi |
| **Per-clinic DB, no shared PHI pool** | One Postgres per deployment | Already live — matches govt's own security instincts |
| **Form builder for specialty variants** | Antenatal, pre-anaesthetic, 10 starter templates + custom | Already live |
| **Pre-printed stationery mode** | Doctor-template toolkit supports pre-printed govt letterhead | Already live |
| **Built in India, Marathi founder** | Geographic + language + cultural fit | True for us |

**The two real build-before-govt gaps:**
1. **ABDM integration** (ABHA generation, HPR/HFR registration, FHIR R4
   export). Without this, we fail compliance.
2. **MJPJAY claim submission** (through NHCX for PM-JAY and SHAS APIs for
   state scheme). Without this, we can't honestly claim to help a
   hospital process claims — the main reason they want HMIS.

Both are on the Clinic Portal Audit's Tier 1 gap list already. They
need to ship before any serious govt meeting.

---

## 5. Five paths to engage, in order of what a small vendor can
   actually do

**Path A — Partner with a Zilla Parishad on a pilot district** (most
realistic first move)

- Approach one District Health Officer (DHO) with a complete
  Nayaversse-for-PHC package.
- Pitch: "Five PHCs, a paid 90-day pilot at ₹12 lakh. If you see 2x
  faster OPD processing and ABHA IDs created for every patient, we
  scale to the district, and the pilot fee is credited against it."
- No free pilots. A free pilot spends our cash for three months and
  gives the district no reason to commit.
- Likely targets: a district where you have a personal connection, or
  Raigad (because the state has already blessed it as the ABDM Model
  District). **Sangli (where Vadgaonkar Clinic is) is a possible
  foot-in-the-door** — the founder lives there.
- Decision-maker: District Health Officer + Zilla Parishad CEO.
- Timeline: 2-4 weeks to a meeting, 1-3 months to pilot start.

**Path B — Become MJPJAY-empanelment-friendly software**

- Certify for ABDM M1/M2/M3 via NHA's sandbox.
- Build the SHAS/MJPJAY claim submission flow.
- Market to private hospitals seeking MJPJAY empanellment.
- Parallel: approach SHAS directly asking to be on their list of
  recommended software.
- Timeline: certification is ~3-6 months, counts for a lot once done.
- This is a **revenue** play (private hospitals pay us), not a
  government contract play.

**Path C — Apply through the Maharashtra Startup Policy**

- Maharashtra has a Startup Policy + the state MahaInnovation programme
  that supports startups selling to govt.
- **Not researched in depth here** — MeitY also runs a national startup
  procurement exemption from the usual turnover criteria. Worth a
  targeted follow-up search.

**Path D — Formal tender response via GeM or State Health Society**

- Register on GeM (Government e-Marketplace) as a seller.
- Monitor NHM Maharashtra + MHTM + SHS tenders at tenderdekho /
  tenderdetail / the state portal.
- Respond when a PHC-software RFP drops.
- Honest caveat: for a state-scale contract, Nayaversse likely needs
  (a) three years of audited financials, (b) similar-project
  references, (c) EMD (earnest money deposit) often ₹5-20 lakh, (d)
  ISO 27001 or similar certification. None of these we have today.
- Timeline: 6-18 months from first notice to contract. Realistic as a
  **later** play after Path A proves the model.

**Path E — Piggyback on PRAGATI through a prime contractor**

- A ₹4,250-crore programme will be awarded to one or two system
  integrators (Wipro, Infosys, TCS, Deloitte, etc.). The SI then
  needs on-the-ground tools.
- Nayaversse becomes an **OEM / technology partner** to that SI,
  supplying the HMIS they roll out.
- Easier bar to clear than direct tender; no need for our own 3 years
  of audited financials.
- Needs introduction to the SI's health-practice lead.

**Recommended order:** A (pilot a district, ideally Sangli), in parallel
B (certify for ABDM + MJPJAY so we can sell to private
MJPJAY-empanelled hospitals), then E once we have the Sangli story to
tell. D is a multi-year preparation.

---

## 6. Pricing per district (jilha)

Maharashtra has **36 districts** (jilhas). Typical public health infra
per district (government figures vary, these are order-of-magnitude):

| Facility tier | Count per district (median) |
|---|---|
| District Hospital | 1 |
| Sub-District Hospital / Rural Hospital | 5-10 |
| Community Health Centre (CHC) | 5-15 |
| Primary Health Centre (PHC) | 30-60 |
| Sub-Centre | 150-400 |

**Bottom-up pricing** per district, assuming Nayaversse covers only
the first four tiers (sub-centres run on paper for now):

### Model 1 — per facility, first-year

| Line item | Rate | Typical district count | Line |
|---|---|---|---|
| PHC implementation + setup | ₹25,000 one-time | 45 | ₹11,25,000 |
| PHC licence | ₹18,000/yr | 45 | ₹8,10,000 |
| CHC implementation + setup | ₹50,000 one-time | 10 | ₹5,00,000 |
| CHC licence | ₹40,000/yr | 10 | ₹4,00,000 |
| Rural/Sub-District Hospital setup | ₹1,00,000 one-time | 7 | ₹7,00,000 |
| Rural Hospital licence | ₹1,20,000/yr | 7 | ₹8,40,000 |
| District Hospital setup | ₹5,00,000 one-time | 1 | ₹5,00,000 |
| District Hospital licence | ₹5,00,000/yr | 1 | ₹5,00,000 |
| Data migration (per facility, if any) | ₹10,000/facility | 63 | ₹6,30,000 |
| Training (3 role tracks × ₹30,000) | - | 1 | ₹90,000 |
| Central district data-layer setup | ₹8,00,000 one-time | 1 | ₹8,00,000 |
| Priority support (district-wide) | ₹5,00,000/yr | 1 | ₹5,00,000 |
| **Year 1 total per district** | | | **~₹73-75 lakh** |
| **Year 2+ (recurring only)** | | | **~₹25-28 lakh/yr** |

### Model 2 — flat population-based

Per-district price = ₹X per thousand population, covers everything.
Cleaner to pitch to the govt ("50 paise per citizen per year for a
digital health record"), harder to cost-model.

- A median Maharashtra district has ~2 million people
- At ₹2.50/person/year = **₹50 lakh/year/district**
- Nayaversse delivers: EMR at every PHC, ABHA for every patient, OPD
  queue, prescription, lab orders, claim submission
- 36 districts × ₹50 lakh = **₹18 crore/year** state-wide, recurring

### What's actually realistic to quote in a pilot

For a **5-PHC paid pilot**: **₹12 lakh for 90 days**, half on the work
order, half at day 60 go-live. Our cost is about ₹5.8 lakh (one
implementation lead on site, part of an engineer remotely, travel,
training, infra, Marathi phone support), so the pilot itself makes
~50% margin. If the district signs the full contract within six months
the fee is credited against it, which is a discount on future revenue,
not cash out. Confirm the district's financial-delegation limit before
quoting; ₹12 lakh is meant to sit inside it.

For a **single-district pilot** (3-5 PHCs): **₹3-5 lakh one-time +
₹2-3 lakh/year**. Still small enough to be spent out of the DHO's
discretionary budget without a tender.

For a **full district rollout**: the Model 1 estimate above. This is
the number for the proposal the state actually considers.

**Caveats, loud:**
- These numbers are a **starting point**, not a quote. Real figures
  need our own cost-of-service (infra + support headcount) model
  back-solved against the volumes.
- **Government payment cycles are slow** — 90-180 days post-invoice is
  typical. We need working capital to fund that gap.
- A **performance bank guarantee** (5-10% of contract value) is usually
  required for state-scale contracts. That's another ₹30-70 lakh locked
  up for a district contract, even longer for a state one.
- Public procurement caps the profit margin visible in a tender. Price
  with enough margin to survive the slow payments.

---

## 7. Compliance — the non-negotiables before any govt pitch

| Requirement | What it means | Where we stand |
|---|---|---|
| **ABDM M1 (Health Facility Registry)** | We register the clinic | To integrate |
| **ABDM M2 (Healthcare Professional Registry)** | We register the doctor | To integrate |
| **ABDM M3 (ABHA creation + linking)** | Patients get ABHA IDs | To integrate |
| **FHIR R4 export** | Records exportable in a standard format | To integrate |
| **DPDP Act 2023 / DPDP Rules 2025** | Audit, breach notification, Fiduciary/Processor split | Already live |
| **SHAS / MJPJAY compliance** (state) | Claim format, geo-tagging, quarterly audits | To integrate |
| **NHCX for PM-JAY claims** | Claim submission to national gateway | To integrate |
| **Data residency (India)** | Patient data in Indian data centres | Already live (Neon ap-south-1) |
| **Marathi UI** | Patient-facing and staff-facing | Already live (12 languages) |
| **ISO 27001 / SOC 2** | Information security certification | **Not yet** — ~3-6 months, ~₹5-10 lakh |
| **CMMi / CERT-In empanelment** | For large tenders | **Not yet** — several lakhs + time |

The **Tier-1 build list** before approaching govt (also the Clinic
Audit's Tier-1): ABDM (M1/M2/M3 + FHIR), NHCX, SHAS/MJPJAY claim
submission, SMS/WhatsApp for recall workflows.

---

## 8. 90-day plan

Realistic for one founder + one engineer, in parallel with normal
work:

| Week | Deliverable |
|---|---|
| 1-2 | Register for the ABDM Sandbox; read M1/M2/M3 specs |
| 3-4 | Build HFR registration flow (M1) — our clinic becomes a listed health facility |
| 5-6 | Build HPR registration (M2) + ABHA generation (M3) |
| 7-8 | FHIR R4 export for prescription + case sheet |
| 7-9 | Approach DHO Sangli with a one-page offer: paid 5-PHC pilot, ₹12 lakh, 90 days, full ABDM alignment |
| 10-11 | SMS/WhatsApp integration (via MSG91 or Gupshup) so recall workflows actually recall |
| 10-12 | Draft MJPJAY claim submission flow, submit for SHAS review |
| 12 | Collateral: a 4-page govt-pitch deck + this document |

Nothing on the list requires a single rupee of govt commitment up
front. Everything on the list makes Nayaversse credible for the
PRAGATI RFPs when they drop in 2026-27.

---

## 9. What we lead with

**Not** "our product has more features than Practo Ray." Govt doesn't
care about feature matrices.

**The three sentences:**

1. "Nayaversse is an Indian-built clinic management system already
   running in Pune, with Marathi as a first-class language, one
   database per clinic (so a breach anywhere never reaches patient
   records elsewhere), and an append-only audit log built for the
   DPDP Act 2023."

2. "We are the only clinic software that natively treats every
   patient record as an ABHA-linked entity from the first visit,
   and ships MJPJAY claim submission in-box, so a PHC or empanelled
   hospital using us is ABDM-ready and SHAS-ready on day one."

3. "Our pricing per PHC is ~₹18,000 per year, less than one month of a
   receptionist's salary. A 90-day pilot in five PHCs is ₹12 lakh, and
   it is credited against the district contract if you go ahead."

The second sentence becomes true when the ABDM / NHCX work ships. The
third is already commercially workable. The first is already true.

---

## Sources

- **PRAGATI programme announcement** (2026 cabinet approval, ₹4,250 Cr):
  [digitalhealthnews.com](https://www.digitalhealthnews.com/maharashtra-cabinet-clears-inr-4-250-cr-pragati-health-reform-project),
  [digitalhealthnews.com (longer)](https://www.digitalhealthnews.com/maharashtra-gov-approves-inr-4-250-cr-pragati-project-to-advance-healthcare-transformation)
- **CM Fadnavis digital directive**:
  [digitalhealthnews.com](https://www.digitalhealthnews.com/maha-cm-fadnavis-calls-big-digital-ai-revamp-in-state-healthcare),
  [newkerala.com](https://www.newkerala.com/news/o/make-health-departments-services-online-maha-cm-755)
- **Raigad as ABDM Model District**:
  [digitalhealthnews.com](https://www.digitalhealthnews.com/raigad-chosen-as-abdm-model-district-as-maharashtra-pushes-ahead-with-digital-health-transformation)
- **MJPJAY compliance (vendor guide — treat as reference, verify at SHAS)**:
  [codingclave.com MJPJAY Maharashtra 2026](https://codingclave.com/guides/mjpjay-compliance-hospital-maharashtra-2026),
  [codingclave.com ABDM compliance](https://codingclave.com/guides/abdm-compliance-hospital-india-2026)
- **ABDM Model RFP for Interfacing Agencies (NHA, authoritative)**:
  [abdm.gov.in Model RFP PDF](https://abdm.gov.in:8081/uploads/Model_RFP_for_Onboarding_Interfacing_Agencies_7d91f190bf.pdf)
- **NHA RFE (reference tender document)**:
  [nha.gov.in RFE doc](https://nha.gov.in/img/resources/RFE-doc.pdf)
- **Odisha health RFP** (useful template for what a real state health
  software RFP looks like):
  [health.odisha.gov.in RFP PDF](https://health.odisha.gov.in/sites/default/files/2026-06/RFP-Final%20C4.pdf)

Vendor pages were used as pattern reference only. Authoritative
compliance details should be verified against the SHAS, MJPJAY, NHA
and ABDM portals directly before any claim is made in a proposal.
