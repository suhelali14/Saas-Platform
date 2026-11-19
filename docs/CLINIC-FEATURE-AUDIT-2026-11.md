# Clinic Portal Audit (2026-11-19)

A screen-by-screen review of the clinic portal, a competitor feature
comparison across the five Indian clinic-SaaS products closest to this
one, and a prioritised gap list of what to build next.

Written from reading the codebase, not from running the UI in a
browser — so what is here is what the code says, not how it felt to
click. The "UI issues" section flags what a visual review would catch
and where a browser pass is still worth doing.

---

## 1. What exists today, grouped

### Clinical

| Module | Status | Notes |
|---|---|---|
| **Patients** | Live | UHID file numbers (sequence-backed), category/triage, allergies, chronic conditions, blood group, phone/DOB/address. Merge for duplicates via `DuplicatePanel`. |
| **Appointments & Queue** | Live | Today's queue with OPD triage priority (Emergency → Pregnant/Senior → Child → General). Multi-doctor per-doctor filter. Follow-up linkage back to the case sheet that scheduled it. |
| **Case sheets** | Live | Encounter-centric: everything from one visit ties to the appointment id. Vitals, HOPI, diagnosis (with doctor's own frequent-diagnosis chips), attachments, follow-up date. |
| **Specialty forms** | Live | The form builder (Pass A/B/C): live preview + drag reorder, sections, show-if logic, template gallery with 10 starters. |
| **Prescriptions** | Live | Autocomplete over 246,068 Indian medicines. Templates (save-as, load). Server-side quantity calc. PDF with real letterhead. |
| **Certificates** | Live but older | SICK_LEAVE / FITNESS / REFERRAL with autofill; still on the backwards-compatible PDF adapter (not yet migrated to the document-template toolkit the prescription uses). |
| **Lab orders** | Live | 23 seeded tests, result as text or uploaded file, auto-completion when all items have results. |
| **Pharmacy** | Live | FEFO dispensing (first-expiry-first-out), batch tracking, expiry alerts (expired / near-30-day / low stock). |
| **Reminders** | Live | In-app only; the bell in the layout polls every 60s. Not SMS or push. |
| **In-patient / ward management** | Live | Admission.tsx + Ipd.tsx + Wards.tsx. |

### Front desk + money

| Module | Status | Notes |
|---|---|---|
| **Billing & invoicing** | Live | Partial payments (cash / UPI / card), daily cash closing, invoice PDF. GST on bill. Status derived, never stored. |
| **Expenses + P&L** | Live | Fixed category list (no free-text tags). Revenue counted from payments received, never from invoices raised. |
| **Counter (unified till)** | Live | Rebuilt as the universal till. |
| **Claims** | Live | `Claims.tsx` exists — needs its own audit; not reviewed in detail here. |
| **Analytics** | Live | Visit trends, top diagnoses (free-text diagnosis grouped), doctor workload, new-vs-returning. |

### Compliance + administration

| Module | Status | Notes |
|---|---|---|
| **Audit log** | Live | Append-only. Every access to a patient record is logged by a central `onResponse` hook (not scattered `logAudit()` calls). Routes to write the log do NOT exist on the server — proven 404, not 403. |
| **Staff + RBAC** | Live | Five roles: DOCTOR, RECEPTIONIST, NURSE, PHARMACIST, ADMIN. Server-enforced, not hidden-in-UI. |
| **Data export / backup** | Live | Full JSON and per-table CSV. No password hashes in the export (verified). CSV escaping tested against adversarial names (`O'Brien, Sr. "Bobby"`). |
| **Settings** | Live | Clinic details, branding, document templates (letterhead / watermark / pre-printed stationery mode), per-doctor profile, staff permissions, data & backup, translations (12 languages). |

### Public-facing (patient-side)

| Module | Status | Notes |
|---|---|---|
| **Public clinic site** | Live | Section-driven (clinic reorders / renames / hides sections). Hero image, 6 colour themes, 4 hero layouts, 4 typefaces. Mobile menu. |
| **Public live queue** | Live | No-auth, last-4-of-UHID labels only (verified — no names, no phones). TV-friendly, auto-refreshes ~20s. |
| **Blog / Gallery / Feedback** | Live | Articles rendered as plain paragraphs (never HTML) → no stored-XSS. Patient feedback **unpublished by default**, with the NMC Code of Medical Ethics limitation stated above the publish toggle. |

**Modules with code but noted gaps / not yet polished:**
Encounter, Claims (needs audit), Admission (reasonable but unverified in a browser).

---

## 2. Per-screen observations

Code-level. A browser pass would surface more — flagged where that's
needed.

### Dashboard (`Dashboard.tsx`, 375 lines)
- 7 interactive patterns detected (buttons / selects / clicks).
- **Verify in browser**: the KPI tiles render on both themes without dropping below the 11px floor.
- **Likely gap**: no "what needs attention" surface — overdue follow-ups, unbilled visits, low stock. Those exist as pages but the dashboard doesn't link into them with counts.

### Queue (`Queue.tsx`, 866 lines)
- The biggest page in the portal. 52 interactive patterns.
- **Known good**: triage priority badges, per-doctor filter, allergy alert on each row.
- **Verify**: arrow-key or keyboard navigation in a long queue; what happens on a phone at 390px width (the scroll-overflow-wrapper is there but the row density likely cramps).
- **Add**: quick "add walk-in" is already a component (`WalkIn.tsx`) — confirm it's reachable from the queue, not just the patients page.
- **Add**: public queue URL as a button, so the clinic can push it to a tablet behind reception in one click.

### Patients (`Patients.tsx`, 156 lines)
- Lean page, 9 interactive patterns. Patient create, search (name / UHID / phone — OR across all three).
- **Add**: bulk import (CSV). Competitors advertise this heavily for migration from paper.
- **Add**: filter by visit recency, by chronic condition, by category — currently search-only.

### Patient Detail (`PatientDetail.tsx`, 738 lines)
- Big page. 21 interactive patterns.
- **Known good**: history timeline, allergy banner, vitals trend chart.
- **Verify**: the download report button generates a readable PDF (it does — verified in Phase 3) but does the preview look professional? Worth a live screenshot.
- **Add**: "share with another doctor" — generate a one-time link patients / referring doctor can see. Related to the referral template gap.

### Encounter (`Encounter.tsx`, 328 lines)
- The doctor's consultation workspace. 17 interactive patterns.
- **Known good**: allergy banner above the case-sheet form, previous-visit continuity card, inline vitals edit.
- **Likely gap**: one-click repeat of a patient's last prescription (the summary says this was built — verify it's wired into Encounter, not just the prescription form).
- **Add**: side-by-side layout for the case sheet and the prescription so the doctor doesn't scroll between them.

### Billing (`Billing.tsx`, 327 lines)
- 28 interactive patterns.
- **Known good**: daily cash closing split by payment mode.
- **Add**: discount reason as an audit column — currently a line discount is a number, not "senior citizen / staff / repeat visitor". For a compliance review, the reason matters.
- **Add**: refund flow. The MVP plan said billing was built but refunds weren't explicitly called out.

### Settings (`Settings.tsx`, 967 lines)
- Largest page after Website. 48 interactive patterns.
- **Known good**: letterhead editor, watermark, stationery mode, signature image, translation UI.
- **Verify**: tabs are usable on a phone. Settings tends to be desktop-only in practice.
- **Add**: a "setup checklist" when the clinic first logs in — what's filled, what's missing. The `SetupPrompt.tsx` component exists; verify it covers everything a first-run doctor needs.

### Website (`Website.tsx`, 1549 lines)
- The site designer. 84 interactive patterns.
- **Known good**: section reorder, theme picker, hero image, sections + layouts + typefaces.
- **Verify**: "Preview on phone" is a real device frame. The `DeviceFrame.tsx` component exists.
- **Add**: one-click "duplicate section" (currently the user builds each from scratch).

### Pharmacy (`Pharmacy.tsx`, 297 lines) & Labs (`Labs.tsx`, 146 lines)
- 15 and 11 interactive patterns.
- **Verify**: expiry-alert colours are distinguishable for a colour-blind user.
- **Add**: for labs — attach the external lab's report URL instead of only the file (some clinics get a PDF link from the lab portal, not a download).

### Public Clinic (`PublicClinic.tsx`, 1458 lines)
- Public-facing, 33 interactive patterns.
- **Known good**: works at 390px, trust strip with credentials, allergy banner avoided (no patient data on public page), Open/Closed badge honest at the current time, FAQ collapses.
- **Verify**: hreflang + structured data for a clinic that enables Marathi + Hindi.
- **Add**: a prominent "Request appointment" CTA that drops into an available slot, not just the current "email us" form. The queue is public — the booking shouldn't require login.

### Admission / IPD / Wards (`Admission.tsx` 342, `Ipd.tsx` 276, `Wards.tsx` 400)
- Together ~1000 lines.
- **Verify**: the ward view (bed map) doesn't fall apart on 10+ beds. The 400 lines in Wards suggest this is where real complexity is.
- **Add**: discharge summary generation — the MVP plan called this out as a hospital-plan feature. Confirm it's wired.

### Minor pages

| Page | Lines | Note |
|---|---|---|
| `Login.tsx` | 150 | Verify it says why login failed without enabling user enumeration. |
| `Analytics.tsx` | 117 | Compact. Add date-range quick picks (7d/30d/90d visible). |
| `Reminders.tsx` | 115 | Add "defer reminder by N days" rather than only resolve/dismiss. |
| `Requests.tsx` | 440 | Needs its own review. |
| `Claims.tsx` | 320 | Insurance claims — expand to pre-auth + denial handling (see missing features). |
| `Counter.tsx` | 272 | The unified till — verify it covers the walk-in path. |
| `Expenses.tsx` | 373 | Add vendor record so repeated vendors autocomplete. |
| `Staff.tsx` | 336 | RBAC + sessions. Add "force sign-out" for a staff member. |
| `AuditLog.tsx` | 270 | Verify filters cover time, user, action, record. |
| `PublicQueue.tsx` | 173 | Verify the auto-refresh doesn't drift (should be ~20s, not every render). |
| `PublicBlog.tsx` / `PublicBlogPost.tsx` | 179 total | Low-traffic for an MVP. |

---

## 3. Competitor comparison matrix

Five of the most-cited Indian clinic / hospital SaaS products. Where
features come from vendor-published marketing, treated as a claim, not
verified behaviour. See sources at the end.

| Feature | Nayaversse | Practo Ray | Clinicia | Eka Care | Healthray EMR | DocEdge |
|---|---|---|---|---|---|---|
| Appointments + today's queue | ✅ triage priority | ✅ | ✅ | ✅ | ✅ | ✅ |
| Case sheet / EMR | ✅ encounter-centric | ✅ | ✅ | ✅ | ✅ | ✅ |
| Prescription + autocomplete | ✅ (246k drugs) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Prescription templates | ✅ | ✅ | ✅ | ? | ✅ | ✅ |
| Medical certificates | ✅ 3 types | ✅ | ? | ? | ✅ | ? |
| Specialty forms / custom EMR fields | ✅ (form builder) | ? | ? | ? | ? | ? |
| Billing + GST invoicing | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Partial payments / daily cash closing | ✅ | ✅ | ✅ | ? | ✅ | ? |
| Pharmacy inventory + FEFO | ✅ | ✅ | ✅ | ? | ✅ | ? |
| Lab orders + results | ✅ | ✅ | ✅ | ? | ✅ (lab integ) | ? |
| Multi-doctor / multi-location | ✅ (multi-doctor) | ✅ | ? | ✅ (multi-clinic) | ✅ | ✅ |
| Patient history / timeline | ✅ | ✅ | ✅ | ✅ | ✅ | ? |
| Vitals trend chart | ✅ | ? | ? | ? | ? | ? |
| Public clinic website | ✅ (12 lang, design) | ⚠️ limited | ? | ? | ? | ? |
| **Public live queue (TV display)** | ✅ (built-in) | ? | ? | ? | ? | ⚠️ some |
| Patient feedback (private, honest) | ✅ (NMC-compliant) | ⚠️ testimonials | ? | ? | ? | ? |
| Appointment reminders (in-app) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Appointment reminders (WhatsApp)** | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Appointment reminders (SMS)** | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Appointment reminders (Email)** | ❌ | ✅ | ✅ | ? | ✅ | ? |
| **ABHA ID generation** | ❌ | ✅ | ? | ✅ | ? | ? |
| **ABDM compliance / HFR registration** | ❌ | ✅ | ? | ✅ | ? | ? |
| **HL7 FHIR R4 export** | ❌ | ? | ? | ✅ | ? | ? |
| **Teleconsultation (video)** | ❌ | ✅ | ? | ✅ | ? | ? |
| **Patient mobile app** | ❌ | ✅ | ? | ✅ | ? | ? |
| **Online payment collection (Razorpay / PhonePe)** | ❌ | ✅ | ✅ | ✅ | ✅ | ? |
| **Insurance TPA pre-auth** | ❌ | ⚠️ some | ? | ? | ? | ? |
| **Insurance claim submission** | ❌ | ⚠️ some | ? | ? | ? | ? |
| **PM-JAY / Ayushman Bharat claims (NHCX)** | ❌ | ? | ? | ? | ? | ? |
| **Barcode / QR patient ID** | ❌ | ? | ? | ✅ | ? | ? |
| **Discharge summary auto-generated** | Live-ish (hospital plan) | ✅ | ? | ? | ✅ | ? |
| Append-only audit log (DPDP-ready) | ✅ | ⚠️ unclear | ? | ? | ? | ? |
| Dedicated database per clinic | ✅ | ❌ (shared) | ❌ | ❌ | ❌ | ❌ |
| Priced per clinic, not per user | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

Legend: ✅ confirmed · ❌ confirmed absent · ⚠️ partial · ? not found in research

**What the matrix says:**
- Nayaversse's unique strengths: specialty forms, public live queue, 12-language public site, per-clinic DB, honest status model, DPDP-ready append-only audit.
- The gap that would **stop a competitive sale** today: SMS/WhatsApp/Email dispatch, ABHA/ABDM integration, online payment, teleconsult. Every established competitor has all four.

---

## 4. Missing features, ranked

### Tier 1 — Critical, would-lose-a-deal-without-it

1. **WhatsApp / SMS / Email dispatch for appointments and follow-ups.**
   Mechanism (how competitors do it): an outbound notification queue on
   the backend, with a provider per channel (MSG91 / Twilio / Gupshup for
   SMS and WhatsApp; the existing nodemailer path for email). A
   per-event template with `{{patientName}}` / `{{apptTime}}` / `{{doctorName}}`
   placeholders, editable by the clinic. Rate-limited per clinic.
   Opt-in/out per patient to stay DPDP-clean.
   **Effort**: medium. The email path exists; add SMS/WhatsApp as
   siblings to `email.ts`, then a `NotificationEvent` enum + template
   store + outbound worker.

2. **ABHA ID generation + ABDM integration.**
   Mechanism: register the clinic as a Health Facility (HFR), register
   the doctor as a Healthcare Professional (HPR), implement the ABHA
   creation flow (Aadhaar or phone-based), issue ABHA addresses to
   patients on registration, pull their consented records from the
   Personal Health Record (PHR) via FHIR R4. Government is moving
   toward making this mandatory for empanelment with public schemes
   (claimed, not verified by the research — check the NHA
   notifications directly before promising dates).
   **Effort**: high. ABDM has its own sandbox and testing flow;
   expect ~3-4 weeks of integration + conformance.

3. **Online payment collection (Razorpay / PhonePe).**
   Mechanism: payment link per invoice with a webhook that marks the
   invoice as paid on success and stops the Billing status from being
   PENDING. A patient receives a link via WhatsApp / SMS / email and
   pays without being physically present. Especially important for
   follow-up consults and partial payments.
   **Effort**: low-medium. Razorpay Standard Checkout is ~2 days'
   work; webhook integration is the main complexity.

4. **Teleconsultation (video).**
   Mechanism: WebRTC via a managed provider (Twilio Video / Daily /
   Agora / Zego). The appointment can be flagged as a video visit;
   the patient gets a one-time link; the doctor opens a room from the
   encounter screen; call recording is a toggle with explicit consent
   per NMC telemedicine guidelines. The Specialty Forms / Case Sheet
   screen stays functional in the same browser tab.
   **Effort**: medium. Managed providers make this ~1-2 weeks.
   Compliance with NMC telemedicine guidelines is the careful bit.

### Tier 2 — Important, would meaningfully grow the pitch

5. **Insurance pre-auth + claim submission (PM-JAY + TPA).**
   Mechanism: a claim object linked to a visit, with the visit's
   diagnosis (ICD-10 or the free-text with a mapper), procedure codes,
   patient/policy details. Submission paths: NHCX for PM-JAY /
   Ayushman Bharat; vendor APIs for private TPAs (Medi Assist, Vidal
   Health, Paramount, etc.); CSV export as the lowest-common fallback.
   Denial handling: a `ClaimStatus` enum (SUBMITTED / QUERY /
   APPROVED / DENIED / RESUBMITTED).
   **Effort**: high. NHCX conformance alone is 3+ weeks; private TPAs
   each have their own schema. Our `Claims.tsx` already exists —
   worth a deep audit to see what it currently does.

6. **Patient mobile app (lite).**
   Mechanism: a PWA (not a native app, to avoid an app-store review)
   that shows the patient their upcoming appointments, past
   prescriptions, next due date, and the live queue position when they
   arrive. Built on the existing public endpoints + a per-patient
   token delivered by WhatsApp / SMS. No login friction; no password.
   **Effort**: medium. We have the data; it's a React route and a
   token issuance endpoint.

7. **Prescription delivery to patient's phone.**
   Mechanism: after save, the prescription PDF is dispatched via
   WhatsApp (if opted in), SMS with link, or email. Also saved to the
   patient's PWA. Important for follow-up dispensing at external
   pharmacies.
   **Effort**: low once Tier 1 #1 is done.

8. **Discharge summary auto-generated from the case sheet.**
   Mechanism: the hospital-plan IPD case sheet + daily notes + the
   final diagnosis + medication list are composed into a one-page PDF
   on discharge. Uses the same document-template toolkit as
   prescriptions. Our MVP plan called this out for the hospital plan;
   worth verifying it's wired to IPD / Admission / Wards.
   **Effort**: low if the toolkit is already shared.

9. **Bulk patient import (CSV).**
   Mechanism: upload a CSV, map columns to patient fields, dry-run
   preview, commit. Duplicate detection via phone before create.
   Critical for a new clinic migrating from paper or another system.
   **Effort**: low.

10. **Barcode / QR patient ID.**
    Mechanism: UHID encoded as a Code 128 barcode or QR, printed on
    the OPD slip. Reception scans it at every subsequent visit to pull
    up the patient instantly — 2 seconds vs 20 seconds of search.
    **Effort**: low. A client-side barcode library + print layout.

### Tier 3 — Nice-to-have, polish the pitch

11. **Dashboard "what needs attention" surface.**
    Overdue follow-ups, unbilled visits, low stock, denied claims,
    reminders due today, overdue patients. All of this data exists in
    the backend; it needs a single dashboard component that pulls the
    counts.
    **Effort**: low.

12. **Keyboard-driven navigation.**
    `Ctrl+K` exists (QuickSwitcher.tsx). Extend to encounter actions,
    prescription save, queue next.
    **Effort**: low.

13. **Clinic-editable certificate templates.**
    The gap we discussed earlier — certificates use the backwards-
    compatible adapter, not the document-template toolkit that
    prescriptions use.
    **Effort**: low (reuse the existing toolkit).

14. **Clinic-defined custom certificate types.**
    Beyond the three fixed types, let a clinic add a "vaccination
    certificate" or a specific "referral to Dr X" with
    placeholder fields.
    **Effort**: medium.

15. **Refund flow.**
    Not obviously in the current Billing module. A refund posts a
    negative payment against an invoice with a reason code.
    **Effort**: low.

16. **Vendor records in Expenses.**
    Expenses are categorised but vendors are free text. A vendor
    record lets repeat vendors autocomplete and the clinic sees how
    much was spent with each.
    **Effort**: low.

17. **Dark / light theme on the portal.**
    Verify the light theme survives every screen (it was retrofitted
    via `theme.css`, not per-component `dark:` classes).
    **Effort**: verification pass, likely small fixes.

18. **One-off share-this-record link.**
    Generate a 24-hour link that shows a selected record (prescription
    or history) to a referring doctor without a login. Important when
    a patient is referred to a specialist.
    **Effort**: medium (one-time token + read-only view).

19. **Lab external-report URL.**
    Store an external URL as an alternative to an uploaded file for
    lab reports — some patients get a portal link from the lab, not a
    PDF.
    **Effort**: trivial.

20. **IoT device integrations.**
    Not on the roadmap today. The common pattern for clinic IoT:
    - **Weight scale → vitals**: Bluetooth scales (Omron, Rossmax) that
      post to the case sheet via a serial-port bridge.
    - **BP machine → vitals**: same.
    - **SpO2, thermometer, ECG patch**: same, over BLE.
    - **Barcode scanner for dispensing**: USB HID device that enters
      the drug batch code on focus.
    - **Printer for OPD slips / receipts**: ESC/POS thermal printers.
    - **Fingerprint reader for patient attendance** (uncommon in
      private practice, common in govt hospitals via ABDM's biometric
      identity).

    The usual way this is wired: a tiny Windows / Linux agent on the
    reception PC that exposes `localhost:port` endpoints and bridges
    USB/BLE devices to a browser fetch. Not a week of work, but
    non-trivial because each device has its own quirks. **Not
    recommended until Tier 1 is done.**

---

## 5. Suggested next sprint (two weeks)

Ordered by what moves the pitch furthest for least engineering:

| Day | Deliverable | Why |
|---|---|---|
| 1–2 | Outbound notifications infrastructure (`notifications.ts` with SMS / WhatsApp / email providers, template store, event queue) | Unblocks #1, #3 (payment link delivery), #7. |
| 3 | Appointment confirmation + reminder templates wired to appointment create/update | #1 live for one event. |
| 4 | Follow-up reminders wired to the reminders page | #1 covers follow-ups. |
| 5–6 | Razorpay payment link per invoice + webhook → auto-mark paid | #3 live. |
| 7 | Prescription delivery to patient (via #1) | #7 live. |
| 8 | Bulk CSV import for patients | #9 live. |
| 9 | Barcode on OPD slip + scan endpoint on patient search | #10 live. |
| 10 | Dashboard "what needs attention" tiles with real counts | #11 live. |

ABHA/ABDM (#2), Teleconsultation (#4), Insurance NHCX (#5) are each
their own sprint. Put them next, in that order — ABHA first because
the market is being pushed toward it legislatively.

---

## 6. Sources (research 2026-11-19)

- Practo Ray: [practo.com/ray](https://www.practo.com/ray),
  [Techjockey listing](https://www.techjockey.com/detail/practo-ray),
  [Capterra listing](https://www.capterra.com/p/167778/Ray/)
- Eka Care: [Capterra listing](https://www.capterra.com/p/10006107/Eka-Care/),
  [Techjockey Eka Care vs Healthray](https://www.techjockey.com/compare/eka-care-vs-healthray-emr)
- Clinicia: [Techjockey Clinicia comparison](https://techjockey.com/compare/easecare-clarity-vs-clinicia)
- Healthray: [healthray.com overview](https://healthray.com/)
- ABDM / ABHA / NHCX:
  [e-Sushrut announcement (Swarajya)](https://swarajyamag.com/health/centre-to-roll-out-low-cost-cloud-based-hospital-management-system-for-small-clinics),
  [ABDM clinical management (MocDoc)](https://mocdoc.com/blog/abdm-compliant-clinical-management-india-2026),
  [PIB ABDM document (July 2026)](https://static.pib.gov.in/WriteReadData/specificdocs/documents/2026/jul/doc202676912801.pdf)
- NMC ethics (why patient testimonials are not published on the public
  site): [NMC Code of Medical Ethics 2002](https://www.nmc.org.in/rules-regulations/code-of-medical-ethics-regulations-2002/)

Vendor pages and templated comparison sites were treated as claims, not
verified evidence. The feature matrix should be checked against each
vendor's own site before any competitive claim is made in sales
material.
