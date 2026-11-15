# Plans, pricing and the hospital modules: research and decisions

Written for: whoever changes the plans, prices or invoicing in
`apps/provider-api` and `apps/clinic-api`, and wants to know why they are
the way they are. Researched 15 November 2026. Most market figures come
from vendors' own sites, so treat them as ranges, not facts.

## What the market charges (India, 2026)

| Customer | Subscription | One-time licence |
|---|---|---|
| Small clinic | ₹2,000–10,000 a month | ₹50,000–2,00,000 |
| Hospital, 20–50 beds | ₹15,000–35,000 a month (₹2–5 lakh a year) | ₹2–5 lakh |
| Hospital, 50–200 beds | ₹35,000–75,000 a month | ₹5–25 lakh |
| Multi-specialty, 200+ beds | ₹75,000–2,00,000 a month | quoted |

- Healthray publishes ₹1,299 per user per month for its hospital tier.
- Yearly maintenance (AMC) on a licence is 15–25% of the licence price.
- First-year extras for a 50-bed hospital: setup ₹50,000–1.5 lakh,
  training ₹25,000–75,000, data import ₹25,000–75,000.
- Buyers report paying 25–40% more than quoted, through per-user fees,
  modules sold separately and SMS charges.

## Decisions

**Four plans.** Clinic, Polyclinic, Hospital, Multi-specialty. The enum
keys stay BASIC, STANDARD, PREMIUM and ENTERPRISE, because every live
env file and the console's database already use them.

**Modules are enforced.** A module that is off is never registered by the
clinic API, so its routes 404. Clinics provisioned before this keep every
module they had (see `apps/clinic-api/src/config/features.ts`). The
patient list, queue, clinical records, certificates, website, audit log
and data export are in every plan and are never sold separately.

**Default payment: a one-time setup fee plus a yearly service fee.** We
host every clinic and pay for that every month, so "pay once, small AMC"
only works for software a hospital runs on its own server. Licence + AMC
and a monthly subscription are both available per deal.

**Bill yearly by default.** Under RBI's recurring-payment rules any
automatic debit above ₹15,000 needs the payer's OTP every time, so
monthly autopay does not work at hospital prices.

**List prices (before GST), a starting point for each deal:**

| Plan | Setup | Yearly | Monthly (subscription) | Logins |
|---|---|---|---|---|
| Clinic | ₹15,000 | ₹36,000 | ₹3,000 | 3 |
| Polyclinic | ₹25,000 | ₹84,000 | ₹7,000 | 10 |
| Hospital | ₹75,000 | ₹2,40,000 | ₹20,000 | 40 |
| Multi-specialty | ₹1,50,000 | ₹6,00,000 | ₹50,000 | unlimited |

A licence is priced at about 2.5 years of the yearly fee, with 20% AMC.

**GST.** 18%: CGST 9% + SGST 9% within the provider's own state, IGST 18%
anywhere else. Invoice numbers are PREFIX/FY/0001, consecutive within the
financial year and at most 16 characters. SAC codes on the invoice lines
are defaults to confirm with a CA, because published guidance disagrees
on which heading SaaS belongs under. E-invoicing is only mandatory above
roughly ₹5 crore turnover.

**Suspension is read-only, never a lock-out.** Records stay viewable and
exportable. A doctor who cannot see an allergy because an invoice is late
is a safety problem, not a billing lever.

## Hospital modules: what the research says they must do

- **Departments and service points.** Clinical departments (medicine,
  surgery, orthopaedics, gynaecology, paediatrics…) and service points
  (registration, cash counter, ward billing, insurance desk, scheme desk,
  pharmacy, lab, radiology, theatre, wards, ICU, medical records). Each
  person sees only the service points they work at.
- **Cash counter.** A cashier opens a counter and only they take payments
  on it. A deposit taken at admission is linked to the patient's account;
  interim bills, a top-up request when the bill passes the deposit; a
  final bill showing total, deposit, balance and refund; discounts above a
  set limit need approval, recorded; at day close, cash is counted against
  the counter's totals. Bills are prepared in one place and collected at
  another.
- **Government schemes.** PM-JAY runs on NHA's own claims portal (TMS):
  pre-approval within about 12 hours, claims with a document list per
  package, a photo of the patient in bed. No public connection for outside
  software was found, so hospitals keep using the portal. MJPJAY
  (Maharashtra): pre-approval after admission, valid 30 days at private
  hospitals, for the package rate or the remaining cover, whichever is
  lower. CGHS/ECHS: credit treatment at government package rates (CGHS
  revised 13 October 2025), no charging above them, no splitting bills,
  implants above the package at ceiling rates, ECHS bills monthly with
  documents. NHCX is not mandatory and adoption is low. What we build is a
  scheme desk that keeps the hospital's own record: scheme, beneficiary
  ID, package and rate, pre-approval number, status and expiry, the
  package's document checklist, claim status, settlement, ageing, and
  billing capped at the package.
- **ABDM.** M1 (create and link health IDs), M2 (share records out), M3
  (pull records in). The government incentive needs live approval for all
  three, which needs a third-party test and a CERT-In-empanelled security
  audit. The company has to register on the ABDM sandbox first.
- **NABH digital health standards (2024).** Role-based access, a
  time-stamped audit trail, records that cannot be edited later. The audit
  trail exists already.

## Sources

- Adrine, hospital software cost guide: https://www.adrine.in/blog/hospital-software-cost-india
- Healthray pricing: https://healthray.com/pricing/
- OneCity cost guide: https://onecity.co.in/blog/hospital-management-software-cost-india/
- Codingclave 2026 costs: https://codingclave.com/guides/hospital-management-software-cost-india-2026
- MedHive EMR cost: https://medhive.in/blog/cost-of-emr-in-india
- Business Today on the RBI e-mandate framework: https://www.businesstoday.in/personal-finance/news/story/rbi-caps-recurring-payments-at-rs15000-without-otp-under-new-e-mandate-framework-526759-2026-04-21
- India Briefing, GST for SaaS: https://www.india-briefing.com/news/gst-compliance-for-saas-and-cloud-computing-in-india-explained-39021.html
- NHA PM-JAY operations manual: https://nha.gov.in/img/resources/Operation%20Manual%20for%20AB%20PM-JAY.pdf
- CAG audit of PM-JAY: https://cag.gov.in/uploads/download_audit_report/2023/09_Chapter-V-064d22bab412c53.02505839.pdf
- HBP 2.2 manual: https://nha.gov.in/img/resources/HBP-2.2-manual.pdf
- MJPJAY adjudication guidelines: https://www.jeevandayee.gov.in/MJPJAY/RGJAYDocuments/Adjudication%20guidelines%20from%20MOU.pdf
- ECHS online bill processing SOP: https://www.echs.gov.in/assets/General%20SOP/SOP%20Online%20Bill%20Processing.pdf
- CGHS package rates: https://www.gconnect.in/orders-in-brief/cghs/cghs-package-rates-for-treatment-in-cghs-empanelled-private-hospitals.html
- NHCX status: https://nirmitee.io/blog/is-nhcx-mandatory-hospitals-hmis-2026/
- DHIS operational guidelines: https://abdm.gov.in:8081/uploads/Operational_Guidelines_DHIS_0500f58100.pdf
- NABH digital health FAQ: https://nabh.co/?p=168
- IPD deposits and settlement: https://mybillbook.in/blog/how-hospital-track-payments-deposits-dues/
- Hospital billing workflow: https://mocdoc.com/blog/hospital-management-software-billing-workflow
