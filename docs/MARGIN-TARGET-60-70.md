# Hitting 60-70% Net Margin — the honest arithmetic

Written 2026-11-20. The question: what does Nayaversse have to charge
per district to run 60-70% net margin?

**Short answer**: 60-70% **net** margin on a govt Y1 contract with
heavy district rollout is **not realistic in year 1**. Services and
implementation eat 30-40% of the deal. 60-70% is a **year-2 recurring**
number, achievable after the one-time rollout labour is behind us,
OR achievable in year 1 if the contract is priced at **Posture C
tender scale (₹3-5 crore)** while the team stays lean.

Three paths to the target margin, each with its tradeoff:

---

## Path 1 — Price at RFP-scale in year 1 (fastest to 60-70%)

Charge Posture C numbers from the plan doc — ₹3.5-5 crore Y1 TCV.
Keep the lean 6-7 person team (₹1.35 cr cost). Infra + travel + ops
~₹25-30L.

| Y1 contract | Y1 cost | Y1 EBITDA | Net margin |
|---|---|---|---|
| ₹3.5 cr | ₹1.4 cr | ₹2.1 cr | **60%** |
| ₹4.0 cr | ₹1.4 cr | ₹2.6 cr | **65%** |
| ₹4.5 cr | ₹1.4 cr | ₹3.1 cr | **69%** |

**Why this works**: the fixed team cost spreads across a bigger deal.
Each extra rupee of revenue above cost is 100% margin.

**Why it's hard**: at ₹3.5+ cr the DHO cannot sign alone; it needs a
formal tender. 6-18 months from first contact to contract, EMD +
PBG ~₹35-50L locked up, need 3 years of audited financials + ISO
27001. Not our day-one play.

**When to use**: year 2-3, after the first district is live as a
reference, when applying through PRAGATI or formal state tender.

---

## Path 2 — Keep Posture B pricing, cut team to the bone (year 2 play)

Year 1: run at Posture B (₹2 cr Y1), accept the 34% net margin while
doing the rollout work.

Year 2+ recurring at ₹75 lakh/yr per district. Drop the team for that
district to 3 FTE (1 senior engineer on-call + 1 field support + 0.3
of a manager):

| Y2+ recurring per district | Y2+ cost per district | Y2+ EBITDA | Margin |
|---|---|---|---|
| ₹75L | ₹25L | ₹50L | **67%** |
| ₹90L (raise price on renewal) | ₹25L | ₹65L | **72%** |

**Why this works**: implementation is done. Only maintenance +
support + continuous improvement needs headcount, and that's
amortised across many districts once there are 3+.

**When to use**: year 2+ recurring, after the first district renews.

---

## Path 3 — Bundle multiple districts into one RFP (highest total EBITDA)

Price 5-10 districts together. Fixed team cost barely grows (one
implementation lead handles 2-3 districts in parallel across their
rollout cycles).

| Districts bundled | Y1 TCV | Y1 cost | Y1 EBITDA | Margin |
|---|---|---|---|---|
| 1 district @ ₹2 cr | ₹2 cr | ₹1.4 cr | ₹60L | 30% |
| 3 districts @ ₹2 cr | ₹6 cr | ₹2.4 cr (team grows to 10 FTE) | ₹3.6 cr | **60%** |
| 5 districts @ ₹1.8 cr (discount for volume) | ₹9 cr | ₹3.4 cr (team 13-14 FTE) | ₹5.6 cr | **62%** |
| 10 districts @ ₹1.6 cr (state RFP) | ₹16 cr | ₹5.5 cr (team 20 FTE) | ₹10.5 cr | **66%** |

**Why this works**: the biggest fixed costs (central tech team,
ABDM integration, product development) don't double when the deal
doubles. Each additional district adds mostly rollout + support
labour, not engineering.

**When to use**: once we have a Posture B reference, approach MHTM
or SHS for a **regional bundle** — "pilot in six districts of
Western Maharashtra: Pune, Satara, Sangli, Kolhapur, Solapur,
Ahmednagar."

---

## What to actually quote

Depending on the room:

| If you are talking to | Price to quote (Y1) | Expected margin | Negotiation floor |
|---|---|---|---|
| **DHO / Zilla Parishad CEO** (direct) | **₹1.9-2.0 cr** | 30-35% net | ₹1.5 cr |
| **MHTM / State Health Society** (negotiated state contract) | **₹3.5 cr per district** × scale | 55-65% net | ₹2.5 cr |
| **PRAGATI / RFP response** (formal tender) | **₹4-5 cr per district** quoted; expect L1 negotiation down | 60-70% net if we win at quoted; 40-50% if cut to ₹2.5 cr | ₹2.5 cr walk-away |
| **Multi-district bundle** (3-10 districts) | **₹1.6-1.8 cr per district** × count | 60-66% net (volume economics) | ₹1.5 cr |

**The 60-70% margin exists; you reach it by selling at scale, not by
over-charging one district.** A single district at 60% margin would
need ₹3.5 cr from the DHO's budget, which is not a single-signature
authority at that level. The scale is the lever.

---

## Honest comparison to competitors

| Company | Typical Y1 contract | Reported / inferred margin |
|---|---|---|
| Practo Ray | Private only; SaaS ₹12-18k/clinic/yr | ~75-85% gross, 30-50% EBITDA at scale |
| Healthray EMR | Install + AMC, mid-size hospitals | Reported EBITDA 20-35% |
| TCS / Wipro / Infosys health practice | ₹10-100 cr state contracts | **5-15% EBITDA** on govt IT (reality of govt business) |
| Birlasoft, Pracvai, MediXcel | Mid-tier health IT | 15-25% EBITDA |

**The 60-70% net you want is not what the big IT services players get
on govt contracts.** The big players carry overhead we don't; our
advantage is a small team eating less overhead per rupee of revenue.
That's where the 60-70% becomes reachable — stay small, price at
scale.
