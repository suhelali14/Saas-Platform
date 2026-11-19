# Handling per-clinic customization at scale

Written 2026-11-19. Answers one question: **when a clinic or hospital
asks for something specific, what do we do?**

TL;DR — **Never branches.** Four tiers, in this order:

1. **Config** — does the feature already have a knob? Flip it.
2. **Core + feature flag** — a code path everyone has, this clinic
   turns on.
3. **Custom module** — a new domain concept, built once, flagged on
   for whoever paid.
4. **Say no.** The deal that needs truly bespoke code eats the roadmap.

Customer-paid custom work goes **into core behind a flag**, not into
their branch. We own the code; it ships for everyone or is flagged off
for others. Priced as the CUSTOMIZATION line item on the quote.

---

## Why not per-clinic branches

The anti-pattern has a name — "tenant fork hell" — and every B2B SaaS
that tried it regrets it. Concretely:

- **Security patches lag.** A bug fix in core has to be ported to N
  branches. Miss one branch, that clinic ships with a known hole.
- **Dependency drift.** Each branch gets stuck on its own version of
  Prisma, React, pdfkit. After a year nothing merges cleanly.
- **Permanent CI cost.** Each branch runs its own CI. 50 clinics = 50
  pipelines.
- **Hiring kills you.** A new engineer can't learn 50 variants.
- **Audit nightmare.** "Which code was running at this clinic last
  Thursday?" is a release-notes question, not a git-log question.

The one legitimate reason to fork is "we are two different products
now." If we're ever there, it's a company split, not a tech choice.

**What we do instead:** one codebase, config per clinic, plus optional
modules.

---

## What we already have (and this is good)

Our existing architecture already runs this model. It is worth saying
out loud so we don't accidentally dismantle it:

| Layer | Mechanism | Example |
|---|---|---|
| **Database isolation** | One Postgres database per clinic, provisioned at onboarding. Never shared tables. | Vadgaonkar's patient records never touch anyone else's. |
| **Plan tiers** | `CLINIC_PLAN=BASIC/STANDARD/PREMIUM/ENTERPRISE` at boot. Routes only register if the plan enables them (404, not 403). | `/api/clinic/staff` doesn't exist in a BASIC deployment. |
| **Per-deal feature overrides** | `ClinicAccount.featureOverrides` merged over the plan defaults at provisioning time. | A BASIC clinic can have `staff` granted off-tier. |
| **Content customization** | Specialty forms, document templates, website design, 12-language translations — all stored as data, not code. | Each clinic reorders / renames / hides sections of the public page. |

The system is already "tenant-config shaped." The task isn't to
rearchitect; it's to **tighten the discipline** when a new ask comes
in.

---

## The decision tree

When a clinic asks for something specific, pick the lowest tier that
can honestly answer the ask:

### Tier 1 — Config (minutes to hours)

The feature already exists. The ask is a value change.

- "We want our prescription letterhead taller." → Document template
  editor.
- "We need a clinical form that captures LMP date for every female
  patient." → Form builder.
- "Our pharmacy counts in strips, not tablets." → Unit field on the
  drug / line item.
- "Blue instead of green on the website." → Theme picker.
- "We dispense before billing, not after." → Workflow preference
  (add to `ClinicSettings` if not already there).

**Rule:** if your answer is "go to Settings → X, change Y," it's Tier
1. Don't open the editor.

### Tier 2 — Core + feature flag (days to a week)

The capability doesn't exist but **it will apply to every clinic**
once we build it. Add it to core, flagged off by default, flipped on
for this clinic.

- "We need WhatsApp appointment reminders." → Build notifications
  infra, add `notifications.whatsapp` feature, flip on where the
  deal paid for it.
- "We need Razorpay." → Build the payment-link flow, add
  `payments.razorpay`, flip on per clinic.
- "We need a pre-op checklist before every surgery." → Add
  `encounter.pre_op_checklist`, build the panel, flip on for
  surgical clinics.

**Rule:** if a competitor has this feature — it's a core thing. Not a
custom.

**Pricing:** absorb into the plan if the roadmap has it anyway. If
the clinic wants it before it was due, that's an **acceleration fee**
on the quote (the "Priority support + feature acceleration" category
of the proposal).

### Tier 3 — Custom module (one to four weeks)

A new domain concept. Nothing similar in core. Would arguably be
weird in every other clinic's UI. Still: build it in core, flagged
off, so it ships in the mainline codebase and benefits from every
later bug fix.

- "We run IVF cycles — can we track ovum retrieval dates, embryo
  transfer, beta-HCG results all linked?" → `modules/ivf/`. Flipped
  on for fertility clinics.
- "We're an eye hospital — we need refraction values on every
  prescription." → `modules/ophthalmology/`. Flipped on for eye
  hospitals.
- "We do dialysis — session logs, Kt/V, access type." →
  `modules/dialysis/`.

**Rule:** a module is a thing a doctor would list on their
specialty chart. It is not a hack for one clinic's quirk.

**Pricing:** billed as the CUSTOMIZATION line item on the quote,
at a rate that covers 6-8 weeks of our engineering. **The custom
module ships in the mainline codebase and we can sell it to the
next clinic in that specialty** — it's reusable R&D, not a one-off.

**Code location:**
- Schema additions in a new migration under the clinic-api.
- Backend routes in `src/modules/<name>/` (new convention — create
  it on the first module).
- Frontend pages in `src/pages/<Module>.tsx`, gated by the feature.
- Server-side: `isFeatureEnabled("modules.<name>")` guards the
  route registration.
- Frontend: nav items hidden if the server's `/me` doesn't list
  the feature.

### Tier 4 — Say no

The ask is so specific that only this one clinic would ever use it,
and they can't pay for us to build it as a module. Three outcomes:

- **Propose a Tier 2 alternative.** Often "I want X" is "I need to
  solve Y, and X is one way." Reframe.
- **Accept but delay.** Put it on the quote's "Future scope" list
  with a provisional estimate.
- **Decline.** Rare, but necessary. Tell them the truth: "This would
  be the wrong feature for your clinic in two years, and we have to
  own it forever." A clinic that respects that answer is a better
  customer; a clinic that doesn't was going to churn anyway.

**What we do NOT do:** build it, mark their branch, tell them "we
customized it just for you." Six months later the next hire sees that
branch, asks what it is, and the answer is "I don't know."

---

## The code conventions this implies

**1. Feature registry is one file.**
`apps/clinic-api/src/config/features.ts` already has this. Keep it
single-source-of-truth. Every new flag lives here with:
- A key (dot-namespaced: `notifications.whatsapp`, `modules.ivf`).
- The plan tier that includes it by default.
- A one-sentence description of what it unlocks.
- A reference to the routes and components it gates.

**2. Modules live in their own folder.**
`src/modules/<name>/` for anything that is scoped to a specialty. The
clinic API has a `modules/` directory from day one of the first
module.

**3. Every module registers itself.**
A module exports `register(app, features)`. The main
`app.ts` iterates registered modules and calls each with
`isFeatureEnabled(...)`. Modules don't know about each other.

**4. Custom fields on core objects use a `data Json?` column.**
We already do this for `vitals Json` on case sheets. The pattern is:
if a clinic needs to store an extra fact per visit that only they
care about, it goes in a `data Json?` column and the form builder
validates its shape. **It does NOT get a hand-written column in the
schema for that one clinic.**

**5. Integrations have a defined interface.**
When we build the second integration (after Razorpay), extract a
`PaymentProvider` interface. When we build the second notification
channel (after WhatsApp), extract a `NotificationProvider` interface.
Don't do this on the first one; do it on the second. That way the
abstraction is pulled from two real examples, not invented from one.

**6. Workflows that vary per clinic are preferences, not forks.**
"Dispense before billing" is a bool on ClinicSettings, and the UI
shows the steps in the preferred order. Not a branch.

**7. Document and form templates stay as data.**
Clinic-facing documents (prescription layout, certificate format,
discharge summary) stay in the document-template editor, as data in
the clinic's database. **Do not ever hardcode a layout for a specific
clinic.** We already hold this line for prescriptions; we should
extend it to certificates (the known gap).

---

## When the model is the problem

The decision tree above holds up to around 300-500 clinics on one
codebase. Past that, the strains show. We won't hit that for a long
time, but the honest names of the strains:

- **Plan explosion.** We started with BASIC/STANDARD/PREMIUM/
  ENTERPRISE. Each new module adds a feature; eventually a quote is
  a checklist of 40 flags and the plan becomes meaningless.
  **Response:** rationalise plans every ~6 months. Collapse features
  that always travel together into bundles.
- **Feature-flag cardinality.** More than ~50 live flags and the
  support story gets painful ("does this clinic have X on? let me
  check"). **Response:** sunset flags that have been on-for-everyone
  for two quarters — fold them into the plan default.
- **Specialty modules that overlap.** IVF and OB/Gyn share
  "pregnancy tracking." **Response:** extract shared primitives
  (pregnancy, cycle, hormone level) once two modules want them, not
  on the first module.
- **Reporting at scale.** Analytics that queried one clinic's
  database start wanting cross-clinic rollups (for a hospital group).
  **Response:** a separate reporting database that ingests
  from each clinic's export, read-only, flagged on for the group.

---

## When a hospital group asks "can you unify our five clinics"

A real ask once we land one. Options, in order of simplicity:

1. **Shared login + branding, separate data.** Each clinic keeps its
   own database and portal. The group gets a cross-clinic Dashboard
   that reads from each via the public read endpoints. ~days.
2. **Shared staff accounts.** Doctor who works at two clinics logs in
   once and switches. Requires moving the auth source to a group-
   scoped service. ~weeks.
3. **Shared patient records.** Patient registered at Clinic A is
   immediately visible at Clinic B. This is the real hospital-group
   ask, and it needs more than a UI — it needs consent flow under
   the DPDP Act (the patient consents to cross-clinic record
   sharing). ~a sprint.

None of the three is "one codebase for the group." They are all
"same code, more configuration." Which is the point.

---

## Making it feel like SaaS — self-serve, not "call the founder"

Everything above answers **"don't rebuild per clinic."** The other half
of the same question: **"don't configure per clinic either."** If every
clinic needs the founder to flip a flag, update a setting, or import
their data by hand, the product runs like a service — the founder
becomes the bottleneck, the business doesn't scale past ~20 clinics,
and the pricing has to reflect that one-on-one time.

A product feels like SaaS when the clinic itself does everything from
signup to go-live without a human in the loop on our side.

### Where we are today (honest)

| Lifecycle step | Self-serve? | Who does it today |
|---|---|---|
| Discover / evaluate | Yes | The public site, the live clinic's public page, the chart with statuses. |
| Buy / sign up | **No** | Founder in a call → quotation → agreement → manual DB provisioning. |
| Provision infra | Partly | Provider console runs the script, but the founder clicks it. |
| Initial clinic setup | Partly | Clinic fills in details via `SetupPrompt.tsx` + `Settings.tsx`. Good. |
| Import existing records | **No** | No CSV import exists; founder would do it. |
| Daily use | Yes | Clinic staff log in, work, log out. No founder involvement. |
| Design the public site | Yes | Website designer, 6 themes, 4 layouts, section reorder. Good. |
| Add specialty forms | Yes | Form builder, 10 starter templates, clone + edit. Good. |
| Edit prescription layout | Yes | Document template editor. Good. |
| Change plan tier | **No** | Founder edits through provider console. |
| Enable a new feature (e.g. WhatsApp) | **No** | Founder flips featureOverrides. |
| Pay a monthly invoice | **No** | Founder emails the PDF; client pays however. |
| Suspend / renew | **No** | Founder-triggered. |
| Cancel | **No** | Founder-handled. |
| Export their data | Yes | Data & Backup screen. Good. |

Daily use and content customization are already SaaS-shaped. **Sign-up,
provisioning, plan changes, feature additions, payments, and
cancellations are not.** That is the gap between "runs like a service"
and "runs like a SaaS."

### The six things that make this feel like SaaS

In rough order of lift:

1. **Self-serve signup & provisioning.** The clinic goes to a page,
   enters their details, pays (or starts a free trial), and the
   provider API runs the same provisioning job the console runs today.
   No founder click. The clinic lands on their portal ~5 minutes later
   with the welcome email already sent.

   What exists: provisioning script, inotify-driven runner, welcome
   email, SMTP. What's missing: a public signup page that calls the
   same endpoints; Stripe / Razorpay for payment capture; a trial
   mode that auto-suspends on expiry.

   Effort: ~1 week once the payment flow is in.

2. **Self-serve plan upgrade and addon activation.** The clinic clicks
   "Upgrade to Standard" from Settings → Billing. The next invoice
   shows the prorated amount; the features flip on immediately, the
   clinic staff never waits for us. Addons (WhatsApp module, Insurance
   module, etc.) work the same way — a checkout, not a sales call.

   What exists: plan tiers, feature overrides, Razorpay would be the
   payment collector (gap in the Feature Audit, Tier 1 #3).
   What's missing: the self-serve upgrade UI + the webhook that
   applies the feature change.

   Effort: ~3-4 days after Razorpay is in.

3. **Self-serve data import.** CSV upload for patients, drugs, old
   prescriptions. The clinic brings its own data; we don't carry it
   across for them.

   Effort: ~3 days per entity.

4. **Self-serve suspend / cancel.** The clinic can pause (stops the
   container, keeps the data) or cancel (DPDP-compliant: export their
   data, give them 30 days, then delete). The clinic triggers both
   from Settings. We're informed, not asked.

   Effort: ~1 week.

5. **Self-serve billing history and invoice download.** The clinic
   sees every invoice they've paid in Settings → Billing. Already
   generated server-side in the provider API; just needs exposure to
   the clinic portal.

   Effort: ~2 days.

6. **Auto-renew.** Monthly / annual auto-charge via Razorpay Standing
   Instructions (RBI e-mandate). Important for recurring revenue that
   doesn't need chasing. Note: standing instructions above ₹15,000
   need OTP re-auth per RBI, so annual billing for hospital plans will
   still have friction — this is a real industry constraint, not a
   product gap.

   Effort: ~1 week.

### What that changes on our side

Today the founder spends ~X hours per clinic per month on plan
tweaks, provisioning fixes, feature flips, invoice chasing. Once the
six items above ship, that collapses to ~zero for clinics on the
standard plan, and the founder's time goes to:

- **Enterprise deals** — where a hospital group genuinely needs
  someone on a call.
- **Module building** — the Tier 3 custom modules that make the
  product differentiated.
- **Support tickets** — not provisioning work.

The pricing model can then collapse too: the "founder time" line
item on the proposal becomes a module subscription instead. That
is the pricing move that unlocks scaling past ~20 clinics with one
engineer.

### What stays founder-touched (deliberately)

Not everything should be self-serve. Some touchpoints are too
sensitive to automate:

- **Custom module development** (Tier 3 above). A clinic asking for
  IVF tracking gets a scoping call. Not a webform.
- **Data recovery from backups.** A clinic that wants a point-in-time
  restore gets a founder-approved process, not a button that could
  destroy their current data.
- **Large discounts and deals.** The quotation editor lets you type
  any discount; the self-serve price page has a fixed ladder.
  Non-standard discounts stay in sales.
- **Compliance incident response.** A DPDP breach notification is a
  founder call, not a dashboard.

The line to hold: **routine work is self-serve, exceptional work is
founder-touched.** If the founder is doing routine work, the product
isn't SaaS yet.

---

## What to do this quarter

Before the next clinic asks for something specific:

1. **Create `apps/clinic-api/src/modules/` as a directory** with a
   `README.md` that points at this document and says "modules live
   here."
2. **Add the `data Json?` convention to the docs** — specifically,
   when it's used and when it's NOT used (not for financial data,
   not for anything that needs to be queried across clinics, not
   for anything a regulator audits).
3. **Review the current `featureOverrides` keys**, make sure every
   one is namespaced (`notifications.whatsapp`, `modules.ivf`, not
   `whatsapp`, `ivf`), so the registry stays readable at 50 flags.
4. **Document the quote-to-feature pipeline**: how a CUSTOMIZATION
   line item becomes a module, who agrees it fits in mainline, who
   owns the flag.

None of this is engineering urgency. It becomes urgent the first
time a hospital group asks and we have to answer "yes we can
customize that" without immediately regretting it.
