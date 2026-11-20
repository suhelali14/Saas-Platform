# Day-One Profit Model — One District, Priced to Win

Written 2026-11-20. Scopes a single-district deal that is **profitable
from day one**, not a two-year investment. Three pieces:

1. The **maximum** we can honestly charge per district, with the
   anchoring data from the market.
2. The **minimum team** that can actually deliver it, with real-world
   per-person cost.
3. The **payment structure** on the first contract so cash lands
   before each delivery phase starts.

The earlier `COMPANY-FINANCIAL-PLAN.md` showed a growth model with
year-1 losses to be funded by savings or an angel round. This
document is the other way to run it: **close one real district
contract first, let it fund the team, scale from there.** Both work;
the founder picks.

---

## 1. Maximum per-district price — the realistic ceiling

Three pricing postures, from lowest-friction / lowest-rupee to
highest-value / highest-rupee. Numbers are per district.

### Posture A — DHO discretionary pilot (lowest friction, lowest ceiling)

The District Health Officer spends from the district's own budget,
no tender, signed as a direct engagement or under the ₹10-25 lakh
discretionary threshold. Fast but small.

| Line | Amount |
|---|---|
| Rollout to **5 PHCs** (not full district) | one-time ₹8-12L |
| Licences for those 5 PHCs for 12 months | ₹1.5-2L |
| Training + hand-holding | ₹2-3L |
| **Year 1 cash in** | **₹12-17 lakh** |
| Year 2+ recurring (same 5 PHCs + maybe 2 more) | ₹3-5 lakh/yr |

Used as a **proof point** to win a bigger district next year, not as
a standalone business. **Profit floor** at this scale.

### Posture B — Direct district contract, negotiated (medium ceiling)

DHO + CEO Zilla Parishad approve a full-district rollout as a
negotiated contract, under the state's e-governance programme or
PRAGATI pilot bucket. No formal tender; written agreement.

| Line | Amount |
|---|---|
| Central district data layer setup | ₹18-25L one-time |
| **45 PHCs** × (₹80k setup + ₹60k/yr licence) | Setup ₹36L, licence ₹27L/yr |
| **10 CHCs** × (₹2.5L setup + ₹1.5L/yr) | Setup ₹25L, licence ₹15L/yr |
| **7 Rural Hospitals** × (₹5L setup + ₹3L/yr) | Setup ₹35L, licence ₹21L/yr |
| **1 District Hospital** (200-bed) × (₹25L setup + ₹12L/yr) | Setup ₹25L, licence ₹12L/yr |
| Data migration (per facility, avg) | ₹8L total |
| Training — 4 role tracks × on-site weeks | ₹12L |
| ABDM onboarding + HFR/HPR registration | ₹8L |
| Project management + rollout labour | ₹15L |
| **Year 1 one-time + first year licence** | **₹2.37 crore** |
| Year 2+ recurring | **~₹75 lakh/yr** |

This is the realistic sweet spot. **Big enough to fund the team, small
enough that the DHO can defend the number.**

### Posture C — Formal RFP response (highest ceiling, longest wait)

Full tender under PRAGATI or state e-governance. Prime-contractor
pricing with bundled services. Realistic ceiling against similar
tenders (Odisha health RFP template, NHA Model RFP, state-level HMIS
tenders won by larger vendors).

| Line | Amount |
|---|---|
| Central data layer, DR, state integration | ₹35-50L one-time |
| 45 PHCs × ₹1.5L setup + ₹1L/yr licence | Setup ₹68L, licence ₹45L/yr |
| 10 CHCs × ₹5L setup + ₹2.5L/yr | Setup ₹50L, licence ₹25L/yr |
| 7 Rural Hospitals × ₹10L setup + ₹5L/yr | Setup ₹70L, licence ₹35L/yr |
| 1 District Hospital × ₹45L setup + ₹25L/yr | Setup ₹45L, licence ₹25L/yr |
| Data migration | ₹20L |
| Training (3 months, on-site, role tracks) | ₹30L |
| ABDM certification pass-through | ₹12L |
| Change management + consulting | ₹25L |
| Priority support bundled (first 2 yrs) | ₹20L one-time |
| Performance bank guarantee cost (if we arrange via bank) | ₹5-8L |
| Risk + overheads 15% | ~₹55L |
| **Year 1 TCV** (total contract value) | **~₹5 crore** |
| Year 2 onwards recurring | **~₹1.3-1.5 crore/yr** |

Takes 6-18 months from first contact to contract. Needs ₹25-50L of
EMD + bank guarantee locked up. Realistic for year 2-3 once Posture
B lands and we have a reference district.

---

## 2. Cost to actually deliver — the lean team that fits

To run **Posture B** (one district, ₹2.37 cr Y1 contract value), the
minimum delivery team:

| Role | Count | Months of involvement | Y1 cost |
|---|---|---|---|
| Founder / CEO (half time on this deal, half on growth) | 1 | 12 | ₹24L × 0.5 = ₹12L allocated |
| Tech lead (also builds) | 1 | 12 | ₹26L |
| Senior engineer (ABDM + integrations) | 1 | 12 | ₹18L |
| Mid engineer (deployment + ops) | 1 | 12 | ₹10L |
| Implementation lead (on-site rollout) | 1 | 12 | ₹12L |
| Field trainer (Marathi, travels to facilities) | 1 | 9 | ₹8L (9/12 of ₹11L) |
| Support (phone + WhatsApp, Marathi) | 1 | 10 | ₹5L (10/12 of ₹6L) |
| Admin / finance / PM | 0.5 | 12 | ₹3L |
| **Team subtotal** | **6.5 FTE** | | **₹94L** |

Add non-salary overhead (office, tools, insurance, legal, travel,
marketing): ~₹22L

### Total Year-1 team cost for a lean, delivery-focused shop: ~₹1.16 crore

### Y1 infra cost for the district

63 facilities × ₹32,000/facility/yr (from `COMPANY-FINANCIAL-PLAN.md`
infra breakdown) = **~₹20L**.

### Y1 total cost of doing business for this one district:

| Item | Amount |
|---|---|
| Team + overhead | ₹1.16 cr |
| Infra (dedicated DBs, hosting, backups, SMS/WA) | ₹20L |
| Field travel (on-site rollout across the district) | ₹6L |
| Hardware passthrough (if any — not recommended, resell at 0 margin) | 0 |
| **Y1 total cost** | **~₹1.42 crore** |

---

## 3. Day-one profit — the actual number

**Year 1 revenue (Posture B): ₹2.37 crore**
**Year 1 cost: ₹1.42 crore**
**Year 1 EBITDA: ~₹95 lakh. Gross margin ~40%, net ~₹95L on a
₹2.37 cr contract.**

### Year 2 steady-state

- Recurring from the first district: **₹75 lakh**
- Team drops to ~5 FTE after go-live (rollout ends): **~₹75L/yr team**
- Infra: ~₹20L
- Support labour already counted
- Add one more district Y2 at Posture B (₹2.37 cr Y1 inflow)
- Team grows to handle both: add 1 implementation, 1 field, 1 support
  = +₹25L

**Year 2 revenue: ₹75L (recurring) + ₹2.37 cr (new district) = ₹3.12 cr**
**Year 2 cost: ₹100L team + ₹40L infra (2 districts) = ₹1.4 cr**
**Year 2 EBITDA: ~₹1.7 crore**

This is the "profit from day one" shape. It **requires one real
district contract to land in month 1-3**. Without that, this model
collapses back to the loss-making bootstrap.

### Sensitivity — what if the district pays less?

| District Y1 price | Cost | Y1 profit | Viable? |
|---|---|---|---|
| ₹2.37 cr (Posture B as quoted) | ₹1.42 cr | +₹95L | Yes, comfortable |
| ₹1.80 cr (price cut to win) | ₹1.42 cr | +₹38L | Yes, tight |
| ₹1.50 cr (significant discount) | ₹1.30 cr (one fewer engineer, longer rollout) | +₹20L | Thin, risky |
| ₹1.20 cr (pilot-scale) | ₹1.10 cr (5-person team, 30 facilities only) | +₹10L | Only as foothold |
| ₹80L (DHO discretionary) | ₹80L (3-person team, 10 facilities) | 0 | Break-even |

**Don't sign below ₹1.5 cr Y1 for a full district.** Below that, the
lean team can't deliver on time and the deal becomes a liability.

---

## 4. The first-contract payment schedule — how we actually get paid

A ₹2.37 crore contract is nothing if payment lands 12 months in.
Three constraints:

- **Government payment cycles are 60-120 days post-invoice.** Plan
  the schedule around this.
- **We need cash at the START of each milestone**, not the end, to
  pay the team doing that milestone.
- **A performance bank guarantee (PBG) of 5-10% is standard.**
  That's ₹12-25 lakh locked up for the contract term. Factor the
  bank's commission (~1-1.5%/yr).

### Recommended milestone schedule (Posture B contract)

| Milestone | % of TCV | Rupees | Timing | What triggers |
|---|---|---|---|---|
| **M1 — Mobilization advance** | 20% | ₹47L | On contract sign | Signed agreement + PBG submitted |
| **M2 — Central layer + 5-PHC pilot live** | 20% | ₹47L | Month 2-3 | Pilot clinics running, acceptance letter |
| **M3 — 50% rollout** | 25% | ₹59L | Month 5-6 | ~32 facilities live |
| **M4 — 100% go-live** | 20% | ₹47L | Month 8-9 | All 63 facilities live, UAT signed |
| **M5 — Acceptance + first year licence invoice** | 10% | ₹24L | Month 10-11 | 60-day stability period cleared |
| **M6 — Retention** | 5% | ₹12L | Month 15 | Released after warranty / support period |
| **Total** | **100%** | **₹2.37 cr** | | |

**Why 20% advance is the first ask you make:** this funds the team
for the two months before any software is live. A tender often
limits advance to 10-15% — negotiate to 20%, settle at 15%.

**Why the retention tail matters:** ₹12-24L sitting with the govt for
a year is normal. Don't treat it as cash; treat it as a line of
credit against future revenue.

### Cash flow — does the team get paid on time?

Monthly team burn: ~₹97L/yr ÷ 12 = **~₹8L/mo**

| Month | Milestone cash in | Running balance (assuming ₹20L opening cash) |
|---|---|---|
| 0 | +₹47L (M1 advance) | ₹67L |
| 1 | -₹8L | ₹59L |
| 2 | -₹8L | ₹51L |
| 3 | +₹47L (M2) -₹8L | ₹90L |
| 4 | -₹8L | ₹82L |
| 5 | -₹8L | ₹74L |
| 6 | +₹59L (M3) -₹8L | ₹125L |
| 7 | -₹8L | ₹117L |
| 8 | -₹8L | ₹109L |
| 9 | +₹47L (M4) -₹8L | ₹148L |
| 10 | +₹24L (M5) -₹8L | ₹164L |
| 11 | -₹8L | ₹156L |
| 12 | -₹8L | ₹148L |

**Cash never dips below the opening ₹20L.** With a 60-day payment
delay added (invoices paid late), it would dip to ~₹35-40L in
months 4-5 — still positive, still viable.

**If the govt only agrees to 10% advance**, opening cash
requirement doubles: need ₹40-50L on hand before signing.

---

## 5. What the first proposal says

Not a quote — a proposal. The recipient (DHO or MHTM contact) reads
it in five minutes and either forwards it up the chain or doesn't.

**One-page structure:**

1. **One sentence.** "Nayaversse is an Indian-built, DPDP-compliant
   clinic management system running in Pune today. We can bring the
   same system to every PHC, CHC, Rural Hospital and the District
   Hospital in <District>, with ABDM alignment on day one, for
   ₹2.37 crore in year one and ₹75 lakh/year thereafter."

2. **What the district gets.**
   - EMR at every PHC, CHC, DH
   - OPD triage queue (emergency → pregnant → senior → child → general)
   - ABHA ID for every patient on first visit
   - Prescription on clinic letterhead, printed or WhatsApped
   - MJPJAY claim submission in-box (when ABDM/NHCX ships)
   - 12-language patient-facing site (Marathi default)
   - Append-only audit log for DPDP and NABH
   - One Postgres database per facility, no shared PHI pool
   - Marathi phone support, Mon-Sat 9-6

3. **Milestones + payment**
   The table above, condensed.

4. **The ask.** A 90-minute meeting with the DHO + CEO ZP. Not to
   sign — to walk through a live clinic (Vadgaonkar) on a video
   call and answer the question "could this work for us".

5. **Proof.** Vadgaonkar Clinic reference. GitHub / tech stack
   one-liner. Founder's background. Pilot success (once Posture A
   pilot lands anywhere).

---

## 6. Three things to say clearly to the founder

1. **Day-one profit is possible, but it is CONDITIONAL on one real
   district contract landing at or above ₹1.5 crore Y1.** The lean
   team cannot be hired without that, and if hired and the contract
   doesn't land, the losses in the broader plan reappear.

2. **The maximum the state will pay for a full district (Posture C /
   RFP) is ₹3-5 crore Y1, ~₹1.5 cr/yr recurring. The maximum a DHO
   will sign directly (Posture B) is ₹1.5-2.5 cr Y1, ~₹60-80L
   recurring. Posture A (the pilot) is ₹10-30 lakh Y1 and is a
   FOOTHOLD, not a business.** Pricing Posture B is the right
   first-contract target.

3. **Cash flow works if the advance is 15-20% and milestones are
   tight. The first thing to negotiate in any govt contract is the
   advance payment percentage and the bank guarantee amount.** Get
   those right and the team gets paid on time; get them wrong and
   you fund the delivery personally.

---

## Sources + caveats

- District facility counts (45 PHCs / 10 CHCs / 7 RH / 1 DH) are
  Maharashtra median — actual district counts vary ±30%.
- Government payment cycles reference: common 60-180 day post-invoice
  settlement observed across state health society contracts.
- PBG / EMD standards: Government Financial Rules + state tender
  manuals (not individually cited here; standard across state
  tenders).
- Practo Ray / DocEdge price benchmarks: from Clinic Feature Audit
  (vendor-published figures).
- Pricing bands at Posture C level derived from similar HMIS tenders
  won by Pracvai, Birlasoft, Wipro healthcare at state scale
  (reported in industry press, not individually verified).
- **Every number here is a planning figure. No contract has been
  signed at these prices. Real-world negotiation will move them,
  sometimes a lot.** The arithmetic is what makes the model
  falsifiable; the prices are what gets negotiated.
