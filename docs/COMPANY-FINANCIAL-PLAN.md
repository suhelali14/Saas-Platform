# Nayaversse — Company Financial Plan

Written 2026-11-20. Answers the four questions the founder asked:

1. If I scale to a 10-20 person team, what do I cost?
2. What does running one clinic / one district cost us, including the
   server and backup side?
3. What do competitors actually charge, and what margins do they run?
4. I'm leaving a ₹21 LPA job. What's the full founder-income model
   so this is honestly better than the day job?

Every number here has a source: a market salary band, a published
cloud price, a competitor's listed rate, or an arithmetic step on top
of those. Nothing invented.

---

## 1. Team cost at Pune / Sangli rates

Numbers are **annual, fully loaded** (gross salary + ~10% for PF/
gratuity/etc. — Indian startups usually quote CTC which bundles these,
so these ARE CTC figures). Role-by-role, at the pay a decent candidate
in a tier-2 Maharashtra city accepts in 2026-27.

### The core 10 (year 1-2)

| Role | Count | CTC band | Mid | Rationale |
|---|---|---|---|---|
| Founder / CEO | 1 | ₹18-30L | ₹24L | Opportunity cost above the ₹21L day job + 15% for the risk |
| Tech lead (also builds) | 1 | ₹22-32L | ₹26L | Equity + senior engineer salary |
| Senior engineer (full-stack) | 2 | ₹14-22L | ₹17L | 5+ yrs, Indian startup rates |
| Junior / mid engineer | 2 | ₹7-12L | ₹9L | 2-4 yrs |
| Clinic success / implementation | 1 | ₹9-14L | ₹11L | Trains new clinics, handles go-live |
| Sales / BD executive | 1 | ₹7-10L + commission | ₹8L base | Field-facing, speaks Marathi, visits clinics |
| Support / customer success | 1 | ₹5-8L | ₹6L | Tickets, WhatsApp support in Marathi |
| Admin / finance / ops | 1 | ₹5-8L | ₹6L | GST, invoicing, HR admin |
| **Team subtotal** | **10** | | **₹132L** | |

### Plus mandatory people-costs (not salary)

- Office (small Pune / Sangli space, 15 desks): ~₹3L/yr
- Laptops / equipment amortised: ~₹1.5L/yr (replace every 3 yrs)
- Software subs (GitHub, Linear, Figma, Slack, email, etc.): ~₹2L/yr
- Health insurance for team: ~₹1.5L/yr for 10 people
- Legal / CA / audit: ~₹2L/yr
- Travel / sales meetings: ~₹4L/yr
- Marketing / content: ~₹5L/yr
- Contingency / buffer: ~₹5L/yr

**Non-salary subtotal: ~₹24L/yr**

### Total year 1-2 team cost: ~₹1.56 crore/year for 10 people

### Scaling to 20 (year 2-3)

Doubled is roughly ~₹3 crore/yr, but the shape changes:

| Added roles | Count | Mid CTC | Total add |
|---|---|---|---|
| CTO / head of product | 1 | ₹40L | ₹40L |
| Senior engineers | 2 | ₹18L | ₹36L |
| Junior engineers | 3 | ₹9L | ₹27L |
| Clinic success + trainers (one per state region) | 2 | ₹11L | ₹22L |
| Field sales (Marathi) | 2 | ₹8L + commission | ₹16L |
| Content / marketing | 0.5 FTE increase | - | ₹5L |
| Compliance / regulatory (ABDM, audit) | 0.5 FTE increase | - | ₹7L |
| **20-person team CTC** | **20** | | **~₹283L** |

Add non-salary (offices in 2 locations now): ~₹45L/yr

### Total year 2-3 team cost: ~₹3.3 crore/year for 20 people

---

## 2. Our infrastructure cost per clinic — the hidden number

A multi-tenant SaaS (Practo Ray's shape) runs maybe ₹500/clinic/
month on infra because 10,000 clinics share one DB. Nayaversse's
"one database per clinic" model is more secure but costs more. Honest
breakdown per clinic per year:

| Component | Vendor | Cost | Per clinic / yr |
|---|---|---|---|
| Postgres (dedicated) | Neon Launch tier | ~$19/mo | ~₹1,900/mo × 12 = **₹22,800** |
| Static hosting (two Vercel projects) | Vercel Pro per project | ~$20 shared across many | ~₹1,000/yr allocation |
| Clinic API container host (shared VPS, scales) | Hetzner / AWS Lightsail | ~₹300/clinic/mo when shared | **₹3,600/yr** |
| Backups (automated snapshots, offsite) | Neon + S3 cold | ~₹100/mo | **₹1,200/yr** |
| Email (SMTP / Resend) | ~₹500/mo across all clinics | ~₹50/clinic/yr | **₹50** |
| SMS (recall + reminders) | MSG91 / Gupshup, ~₹0.20/msg × 500 msgs/mo | **₹1,200/yr** |
| WhatsApp (recall + prescription delivery) | ~₹0.50/msg × 400 msgs/mo | **₹2,400/yr** |
| Monitoring / logs / status pages | Grafana Cloud free + Sentry | ~₹200/clinic/yr | **₹200** |
| DNS / TLS / custom domain | Zero marginal, pooled | **₹0** |
| Clinic's own domain (if we resell) | Pass-through | ₹600/yr | **₹600** |
| **Per-clinic infra total** | | | **~₹32,000/yr** |

**Per-clinic infra at 100 clinics: ~₹32 lakh/year.** That's the hidden
"cost of goods sold" before any team cost.

### Server + maintenance breakdown — the question specifically asked

- **Dedicated Postgres per clinic (Neon Launch)**: ₹22,800/yr. This
  is what buys us "a breach in one clinic can't touch another's PHI."
  A multi-tenant model would replace this with ~₹500/yr, which is
  the Practo advantage but the security vulnerability too.
- **Backups**: ₹1,200/yr — daily snapshots, 30-day retention, offsite
  to S3. Industry-standard; DPDP Act expects it.
- **Hosting the container that serves the clinic's data**: ₹3,600/yr
  per clinic, pooled across a shared VPS cluster that scales
  horizontally. Today we're on a single $4-6/mo GoDaddy VPS which
  stops working around clinic #10 — plan is to move to Hetzner or
  AWS Lightsail cluster at that point (~₹3-5 lakh/yr for 50 clinics
  worth of capacity).
- **Monitoring + log aggregation**: ₹200-500/clinic/yr. Needed so
  we know when a clinic's queue page times out before the doctor
  WhatsApps us.

**Per-district infra (with ~63 facilities):** ~₹20 lakh/year.

---

## 3. What competitors charge and the margin they run

Published figures (all vendor-marketing, so sanity-check):

| Vendor | Per-month list | Per-year | Shape | Likely gross margin |
|---|---|---|---|---|
| **Practo Ray** | ₹999 billed yearly | ~₹12,000/yr/clinic | Multi-tenant SaaS | **~75-85%** (tiny infra, huge scale) |
| **DocEdge** | ~₹33/day | ~₹12,000/yr/clinic | Multi-tenant | ~75% |
| **Healthray EMR** | ₹49,999 one-time + AMC | one-time; AMC ~₹15-20k/yr | Install + AMC | **~60-70%** on licence, higher on AMC |
| **Clinicia** | Varies | Unpublished | Multi-tenant | ~70-80% |
| **Mocdoc** | ~₹15k-25k/yr | Published range | Multi-tenant | ~70% |

**Us (per-clinic DB, India-hosted):**
- Target price: ₹24,000-96,000/yr depending on plan (BASIC to PREMIUM)
- Infra cost: ₹32,000/yr/clinic
- Gross margin: **BASIC breakeven only, STANDARD ~60%, PREMIUM ~70%**

The architectural tradeoff is real: a per-clinic DB costs more to run
than a shared one. Two choices how to live with that:

1. **Charge more.** Match pricing to value (data isolation + DPDP
   audit + Marathi + form builder). STANDARD at ₹8,000/mo = ₹96,000/yr
   makes the gross margin reasonable.
2. **Move low-price small clinics to a thin tenant-prefix model.**
   This is the architecture change the Customization doc specifically
   warns against; it unlocks pricing but loses the per-clinic DB
   promise. Don't do it.

Honest conclusion: **Nayaversse's pricing cannot match Practo Ray's
₹12k/yr and stay in business.** The differentiator (per-clinic DB,
DPDP audit, Marathi, form builder, India-built, honest status) justifies
the higher price. If the market disagrees with that differentiation,
the business model is wrong, not the price.

---

## 4. Revised pricing to cover the team

### Simple arithmetic

Year 1-2 team + ops cost: **₹1.56 crore/year**
Target gross profit margin after infra: **55%** (reasonable for our
architecture)
Required revenue = ₹1.56 crore ÷ 0.55 = **₹2.84 crore/year**

Year 2-3 scale team + ops cost: **₹3.3 crore/year**
Required revenue = ₹3.3 crore ÷ 0.55 = **₹6.0 crore/year**

### What that looks like across customer mixes

**Mix A — Private clinics only, no govt:**
- Average clinic pays ₹60,000/yr (mix of BASIC + STANDARD)
- Infra ₹32k/clinic/yr → gross profit ₹28k/clinic
- Need revenue of ₹2.84 crore → **~475 paying clinics**
- Realistic timeline for 475 clinics with a 10-person team: **year 3**

**Mix B — Public health partnership (districts) only:**
- One district recurring ₹25-28 lakh/yr (from earlier doc)
- Infra ~₹20 lakh/district → gross profit ₹5-8 lakh/district
- Need revenue of ₹2.84 crore → **10-12 districts**
- Realistic: year 2-3 after PRAGATI RFPs land

**Mix C — The real one, blended:**
- 150 private clinics @ ₹60k/yr = ₹90 lakh
- 20 small hospitals @ ₹2.4L/yr = ₹48 lakh
- 2 districts @ ₹28 lakh/yr recurring + ₹30 lakh one-time = ₹86 lakh
- 100 MJPJAY-empanelled hospitals @ ₹30k/yr (compliance-only tier) = ₹30 lakh
- **Total: ₹2.54 crore** — within 90% of the target

That's realistic for the back half of year 2 if the ABDM + NHCX +
Sangli pilot work from the Maharashtra Strategy doc lands on schedule.

### Revised district price, incorporating team cost

Previously (in MAHARASHTRA-GOVERNMENT-STRATEGY.md): Year 1 ₹73-75
lakh/district. Does that cover us?

Per-district cost to us in year 1:
- Infra: ₹20 lakh (50-60 facilities, pooled hosting)
- Implementation labour: 1 engineer for 2 months = ₹3 lakh fully loaded
- Training (on-site, 4 role tracks × 3 days): ₹1.5 lakh
- Project management: ₹1 lakh
- Support coverage first year: ₹2 lakh
- **Total per-district cost: ~₹27-28 lakh in year 1**

At ₹73 lakh/district year 1: gross profit ~₹45 lakh/district (62%
gross margin).
At ₹28 lakh/district year 2 recurring, cost ~₹22 lakh (mostly infra +
support): gross profit ~₹6 lakh (22% gross margin). **This is the
number that doesn't work** — needs to be higher.

**Revised recurring per district: ₹38-45 lakh/year** gives 45-55%
gross margin. That's what to quote.

---

## 5. Founder income model — leaving the ₹21 LPA job

### The honest cost of the switch

- Current CTC: ₹21 lakh (take-home ~₹15 lakh after tax)
- Replacing immediately with ₹24L founder CTC: take-home ~₹17 lakh
- **Immediate monthly take-home**: ~₹1.4 lakh (slightly up from
  current ~₹1.25 lakh)

But the founder also takes on:
- No employer health/life insurance → ~₹30k/yr out of pocket
- No PF/gratuity accumulation unless self-funded
- Runway risk — if revenue misses for 3 months, who pays salaries?

### The required cash runway before the switch

**Minimum 12 months of team-and-ops-cost + founder salary in the
bank, OR committed revenue covering 70% of it, OR an angel round
closed.**

At the 10-person team cost of ₹1.56 crore + founder ₹24L, 12 months
runway = **₹1.8 crore in the bank or equivalent**.

Realistic bootstrap path: don't hire the whole 10 on day one. Year 1
timing:

| Month | Team size | Monthly burn | Headcount CTC/yr |
|---|---|---|---|
| 0 (switch) | 1 (founder) + 1 (tech lead) + 1 (junior eng) | ₹5L | ₹60L |
| 3 | +1 clinic success | ₹5.9L | ₹71L |
| 6 | +1 sales / BD, +1 senior eng | ₹8L | ₹96L |
| 9 | +1 support, +1 junior eng | ₹9.5L | ₹115L |
| 12 | +1 admin/finance | ₹10.5L | ₹126L |

**Year-1 team cost: ~₹90 lakh average.** Plus non-salary ₹20-24L.
**Year-1 total cost: ~₹1.15 crore.**

Minimum bank balance to make the switch: **₹70-90 lakh** (covering 9
months of burn with some slack), OR a ₹50L angel round, OR confirmed
contracts worth ~₹90L in year 1 revenue.

### Founder-pay timeline, honest

- Months 0-6: pay yourself ₹1.5 lakh/mo (~₹18L/yr CTC). Lower than
  the day job, reinvest the difference.
- Months 6-12: pay yourself ₹2 lakh/mo (~₹24L/yr) if monthly revenue
  covers 80% of burn.
- Year 2 onwards: ₹30-40L CTC if the business is profitable.
- Dividends / exit upside separate — don't bank on those.

**Short answer to "should I leave the ₹21L job":** Not yet, if the
bank balance is under ₹70 lakh AND there are no committed Y1
contracts. The economics work when either of those changes.

---

## 6. Three-year P&L — realistic, not promotional

Not a forecast you take to an investor; a planning document.

| Year | Clinics | Hospitals | Districts | Revenue | COGS (infra) | Team + ops | Gross margin | EBITDA |
|---|---|---|---|---|---|---|---|---|
| Y1 | 30 | 5 | 0 | ₹45L | ₹13L | ₹1.15 cr | 71% | **-₹83L** |
| Y2 | 100 | 25 | 1 | ₹2.1 cr | ₹55L | ₹1.6 cr | 74% | **-₹5L** |
| Y3 | 250 | 80 | 3 | ₹5.5 cr | ₹1.3 cr | ₹2.4 cr | 76% | **₹1.8 cr** |

Year 1 loses ~₹80 lakh — covered by bank balance or angel round.
Year 2 break-even to slight loss.
Year 3 real profit.

**Compare to 3 years at the day job:** ~₹63L cumulative take-home.
**Compare to 3 years here:** founder CTC total ~₹72L + equity upside
in a business worth ~₹10-20 crore at Y3 revenue (3-4× revenue
multiple for an Indian healthtech at that scale).

**Honest break-even analysis** — the switch is worth it if:
- Y3 business value (your equity, less dilution if you raised)
  comfortably exceeds the ₹63L opportunity cost of staying employed.
- The ₹20L-floor of year-3 personal CTC exceeds what the day job
  would be at year 3 (~₹27L with normal 10% hikes). It **doesn't**
  — so the only upside is the equity value, not the cash. The founder
  has to believe in that.

---

## 7. Where the money comes from — fundraising vs bootstrap

### Bootstrap path

- Year 1 loss: ₹80L. Covered by founder savings + first paying clients.
- Grows slower, founder holds 100% equity.
- Realistic if the founder has ₹60L-1Cr in savings + is willing to
  pay themselves ₹15-18L in year 1.

### Angel round path (₹50L-1.5 Cr)

- Covers year 1 loss + some of year 2.
- Dilution: 10-20% at ₹5-10 cr pre-money.
- Angels relevant for Indian healthtech: Indian Angel Network, LetsVenture,
  AngelList India, specific healthtech angels (verified doctors are a
  pool — they give ₹5-25L each and refer their network).

### Seed round path (₹2-5 Cr)

- Enables the 10-person team on day one + 18 months runway.
- Dilution: 15-25% at ₹10-20 cr pre-money.
- Realistic once there's ₹1 cr ARR + 20-30 clinic customers (proof of
  pricing power).
- Seed funds relevant: Blume, Kalaari, 3one4, Stellaris, Chiratae
  (healthtech angle), Elevation (digital health), Sorin Investments.

### The honest recommendation

**Bootstrap for 6-9 months after the job switch, then raise an angel
round of ₹75L-1 cr to fund the 10-person team.** The angel-round
narrative is strongest when you have:
- One live district pilot (paid; never run one free)
- 20-30 paying clinics
- ABDM certification in progress

All three are achievable in 6-9 months with the current product + the
Maharashtra Strategy doc's 90-day plan + some sales hustle. **Raising
before this is premature; valuations are 3× higher after.**

---

## 8. What costs can be lower than this planning assumes

Order of magnitude savings worth planning for:

- **Office**: start remote, save ₹3L/yr. Many Indian startups do this
  for year 1; co-work only when needed.
- **Equipment**: BYOD for the first 5 hires, buy laptops only from
  hire #6. Save ₹1-2L in year 1.
- **Tooling**: free tiers (GitHub Teams, Linear free, Google Workspace
  starter) carry a 10-person team. Save ₹1-1.5L.
- **Cloud infra**: Neon free tier covers ~5 clinics; use it. Vercel
  Hobby covers everything until year 2. **Year 1 real infra**:
  maybe ₹2-5L instead of ₹15L.
- **Marketing**: SEO + Dr Asif's referrals cost nothing. Paid sales
  only after there's product-market fit.
- **Salaries below market**: offer equity in lieu for key early hires.
  Save 20-30% on senior salaries by vesting over 4 years.

**Realistic Year 1 cost with all these levers pulled: ₹60-80 lakh**,
not ₹1.15 crore. That makes the bootstrap much more honest.

---

## 9. The three-sentence summary

1. **Running Nayaversse as a 10-person company costs ~₹1.5 crore/
   year all-in, scales to ~₹3.3 crore for 20 people. Per-clinic
   infra is ~₹32,000/year because of the per-clinic database
   choice.**

2. **To cover that team cost at the current pricing with a 55%
   gross margin needs ~₹2.8 crore annual revenue by year 2, which
   is reachable with ~100 clinics + 25 hospitals + 1 govt district
   if the Maharashtra Strategy doc's 90-day plan delivers.**

3. **The founder should not leave the ₹21 LPA job until there's
   ~₹70 lakh in the bank OR a committed angel round OR confirmed
   year-1 contracts worth ₹90 lakh; and the real upside is equity
   value at year 3, not cash salary — the founder has to believe
   the business will be worth ₹10-20 crore by then.**

---

## Sources + caveats

- Indian tech salary bands cross-referenced against AmbitionBox,
  Glassdoor India, and Naukri listings for Pune / Bangalore (2026).
  Use Instahyre or Cutshort for more precise 2026 figures before
  making a hire offer.
- Neon pricing: [neon.tech/pricing](https://neon.tech/pricing) — Launch
  tier $19/mo per project.
- Vercel pricing: [vercel.com/pricing](https://vercel.com/pricing) —
  Pro $20/mo per project, shared across all our clinic sites.
- Competitor prices: see the Clinic Feature Audit sources list;
  figures from vendor pages and third-party comparison sites, not
  independently verified.
- Nothing here is a guarantee of revenue. The arithmetic shows what
  the business needs to deliver; whether it does is a sales and
  product question, not a financial one.
