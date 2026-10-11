# Running the Clinic Product

Written for: you, operating this as a business — onboarding clinics,
deploying them, and configuring what each one gets.

This is the operational manual. For UI conventions see
[`apps/clinic-web/DESIGN.md`](../apps/clinic-web/DESIGN.md).

---

## 1. The shape of the thing

Four applications. Two are the product; two are yours.

| App | Port (dev) | Who uses it | Where it runs |
|---|---|---|---|
| `apps/clinic-api` | 4100 | — | **One deployment per clinic** |
| `apps/clinic-web` | 5176 | Patients + clinic staff | **One deployment per clinic** |
| `apps/provider-api` | 4200 | — | One deployment, yours |
| `apps/provider-console` | 5177 | You | One deployment, yours |

### Why one deployment per clinic

Every clinic gets **its own database**. Not a shared database with a
`clinicId` column — a genuinely separate one.

That is a deliberate and expensive choice, made because this is patient
data under India's DPDP Act. A query that forgets its tenant filter in a
shared database leaks one clinic's patients to another. There is no such
query to write here, because there is no other clinic in the database to
leak to.

The cost is real: ten clinics means ten databases and ten deployments.
The provider console exists to make that cost bearable.

### One build, two sites

`clinic-web` serves **both** the patient website and the staff portal from
a single deployment. Which one a visitor gets is decided from the hostname
at page load:

```
drasif.in            → patient website
dashboard.drasif.in  → staff portal
```

Both hostnames point at the same build. There are no per-host rewrite
rules to configure — that is the whole point, because rewrite rules differ
on every hosting platform and are the thing most likely to be wrong when
you onboard clinic number two.

Recognised portal subdomains: `dashboard.`, `portal.`, `admin.`, `staff.`
Anything else is treated as the patient site.

> **Not a security boundary.** Every portal route still requires a token
> and the API enforces roles regardless of which hostname asked. The split
> exists to give patients a clean address, not to hide the login.

---

## 2. Configuration

### `apps/provider-api/.env` — your console

```bash
PORT=4200
DATABASE_URL=postgresql://…/provider_console?schema=provider
JWT_SECRET=<64+ random chars>

# First console account, created by `npm run seed`
PROVIDER_SEED_EMAIL=you@example.com
PROVIDER_SEED_PASSWORD=<10+ chars>
PROVIDER_SEED_NAME="Your Name"

# How often to ping each live clinic's /health. 0 disables.
HEALTH_POLL_MINUTES=10
```

#### Provisioning credentials

**Without these the console runs in dry run.** Every step reports exactly
what it would call and calls nothing. That is the correct default for code
that creates billable infrastructure and writes DNS.

```bash
NEON_API_KEY=            # console.neon.tech → Account settings → API keys
NEON_ORG_ID=             # optional, if your Neon account has orgs

VERCEL_TOKEN=            # vercel.com/account/tokens
VERCEL_TEAM_ID=          # optional, if deploying under a team

DEPLOY_REPO=you/clinic   # the GitHub repo the clinic apps build from
```

> ### The credential rule
>
> **This console never stores a clinic's database password.**
>
> Provisioning needs one. It is fetched from Neon at the moment of use,
> handed to the migration step and to Vercel as a deployment secret, and
> dropped. What is stored is `neonProjectId` — a reference, useless alone.
>
> The consequence: a breach of your console is **one API key to rotate**.
> Warehousing ten clinics' database passwords in one place would make it a
> single point of catastrophic failure across every patient of every
> customer.
>
> If you ever find yourself adding a `databaseUrl` column to
> `ClinicAccount`, stop.

### `apps/clinic-api/.env` — one per clinic

Generated for you during provisioning. You only touch this by hand for the
dev clinic.

```bash
PORT=4100
DATABASE_URL=postgresql://…      # that clinic's own database
JWT_SECRET=<64+ random chars>    # unique per clinic, never reused
CLINIC_PLAN=STANDARD               # BASIC | STANDARD | PREMIUM

# Optional: AI translation for the patient site
ANTHROPIC_API_KEY=
GEMINI_API_KEY=
TRANSLATION_PROVIDER=auto          # anthropic | gemini | auto
AI_TRANSLATION_ENABLED=true        # master switch, independent of keys
AI_TRANSLATABLE_NAMESPACES=clinic,post
AI_TRANSLATION_MAX_ITEMS=200       # per-run cost guard
```

**`JWT_SECRET` must be unique per clinic.** A shared secret means a token
minted for one clinic is valid at another.

### `apps/clinic-web/.env` — one per clinic

```bash
VITE_API_URL=https://api.drasif.in/api/clinic

# Optional. Leave unset for hostname detection.
VITE_SITE_MODE=                    # public | portal | both — forces one
VITE_PORTAL_HOSTS=                 # exact hostnames, if unconventional
VITE_PUBLIC_HOSTS=
VITE_PUBLIC_SITE_URL=              # only if the two domains are unrelated
VITE_PORTAL_SITE_URL=
```

Locally, leave `VITE_SITE_MODE` unset: localhost resolves to `both`, so
the portal is at `/` and the patient site at `/clinic`, as during
development.

---

## 3. Onboarding a clinic

### Step 0 — first-time console setup

```bash
cd apps/provider-api
cp .env.example .env          # fill in DATABASE_URL and JWT_SECRET
npx prisma migrate deploy
npm run seed                  # creates your owner account
npm run dev

cd ../provider-console && npm run dev    # → localhost:5177
```

### Step 1 — record the deal

**Clinics → Onboard a clinic.** Name, contact, city, plan, monthly fee.

The contact **email becomes the clinic's first sign-in**, so use the
doctor's real address.

This creates the account and a 10-step checklist. Nothing is deployed yet;
the account sits as a `LEAD`.

### Step 2 — domains

The clinic buys their own domain. You need three names:

| Purpose | Example | DNS record |
|---|---|---|
| Patient website | `drasif.in` | `A` / `ALIAS` → your host |
| Staff portal | `dashboard.drasif.in` | `CNAME` → `drasif.in` |
| API | `api.drasif.in` | `CNAME` → your host |

Enter them on the clinic's page. They are normalised on save, so pasting
`https://drasif.in/` is fine.

### Step 3 — deploy

**Deploy this clinic.** With credentials configured this runs, in order:

1. **Create the database** — a dedicated Neon project in `ap-south-1`
   (Mumbai; these are Indian clinics and latency matters at a front desk).
2. **Create the API deployment** — with `DATABASE_URL`, a freshly generated
   `JWT_SECRET`, and `CLINIC_PLAN` from the plan you chose.
3. **Create the web deployment** — with `VITE_API_URL`, and both the
   patient and portal domains attached to the same project.
4. **Migrate and seed** — runs the clinic app's *own* migrations and seed
   script. Not a copy of them: a second copy would drift, and the first
   symptom would be a customer's database disagreeing with the code
   serving it.

Each step reports success, failure, or what it would have called in a dry
run. A failure stops the run rather than pressing on — a half-provisioned
clinic is harder to reason about than a clearly failed one.

**The generated admin password is shown once and never stored.** Copy it
before leaving the page.

### Step 4 — DNS

Always manual. It is the clinic's registrar, and no console has a
relationship with it.

Point the three records as in step 2, then wait for propagation. Vercel
will issue certificates once the records resolve.

### Step 5 — hand over

- Give the doctor their email and the generated password, **directly** —
  not over email or WhatsApp.
- Have them change it at first sign-in (Settings → Password).
- Walk them through Settings → Clinic: logo, address, timings, services.
  Their site stays deliberately sparse until they do; nothing is invented
  for them.
- Set the account to **LIVE**. Health polling only covers live clinics.

---

## 4. Plans and features

Which modules a clinic gets is decided **at boot** from `CLINIC_PLAN` in
that deployment's own environment. A lower tier does not get a 403 on a
gated route — the route is never registered, so there is nothing to probe.

| Tier | Adds |
|---|---|
| **BASIC** | Patients, appointments, case sheets, prescriptions, certificates, billing, labs, public website |
| **STANDARD** | Staff accounts, pharmacy & stock, analytics, expenses & P&L |
| **PREMIUM** | Regional languages, audit log & data export, AI translation |

### Honesty about what is actually enforced

Only **`staff`** is gated by the clinic API today. Everything else ships to
every tier. The console labels those "not gated" for exactly that reason —
promising a clinic something on a PREMIUM invoice that a BASIC deployment
already has is a promise the software does not keep, and they will find
out.

To genuinely gate a feature, add it to `Feature` in
`apps/clinic-api/src/config/features.ts`, add it to the plan sets, and
guard its route registration in `app.ts`.

### Per-deal overrides

A feature promised off-tier in a sales call belongs in configuration, not
in a note nobody reads a year later. Tick it on the clinic's Plan &
features panel; it is marked `DEAL` and survives.

---

## 5. Changing a clinic after go-live

| Change | What to do |
|---|---|
| **Upgrade the plan** | Change it in the console, then update `CLINIC_PLAN` on that clinic's API deployment and redeploy. The console records the intent; the env var is what the software reads. |
| **New domain** | Add it in the console, attach it in Vercel, point DNS. |
| **Suspend for non-payment** | Set status `SUSPENDED` in the console. **This does not take the clinic offline** — it is a record, not a switch. To actually suspend, disable the deployment in Vercel. |
| **Off-board** | Export their data first (Settings → Data & Backup, as them), then decommission the Neon project and Vercel projects deliberately. |

> Deleting an account in the console removes **only the console record**.
> The clinic's database and deployments survive, and the API says so in
> its response. A tidy console does not mean tidy infrastructure.

---

## 6. Monitoring

The console polls each **LIVE** clinic's public `/health` every
`HEALTH_POLL_MINUTES`. Down clinics raise a banner at the top of the
Clinics list.

**That endpoint is the only thing this console ever reads from a running
clinic.** No patient data, no counts, nothing behind a login. The whole
architecture rests on the console being unable to see PHI, and monitoring
is exactly the kind of convenience that erodes such a boundary one field
at a time.

History is pruned after 30 days. Unlike the clinic's own audit log, these
rows carry no compliance weight.

---

## 7. Compliance notes you should not discover later

- **Audit log.** India's DPDP Act and NABH require every access to a
  patient record to be logged with user, timestamp and what was touched,
  immutably. The clinic app does this automatically via a central hook —
  there is no route that can skip it, and no API that can edit or delete an
  entry.
- **Patient testimonials are prohibited.** The NMC bars a practitioner from
  requesting or sharing patient testimonials or reviews. The feedback
  feature is therefore **private by default**, and the publish toggle
  carries the warning. Do not talk a clinic into publishing them.
- **Backups are incomplete without `uploads/`.** Scan attachments, X-rays
  and lab reports live on the server's disk, not in the database. Back up
  that directory alongside it.
- **Every clinic's `JWT_SECRET` must differ.** Provisioning generates a
  fresh one per clinic; do not copy an env file between deployments.

---

## 8. Local development

```bash
# Terminal 1-4
cd apps/clinic-api        && npm run dev    # :4100
cd apps/clinic-web        && npm run dev    # :5176
cd apps/provider-api      && npm run dev    # :4200
cd apps/provider-console  && npm run dev    # :5177
```

| | |
|---|---|
| Patient site | http://localhost:5176/clinic |
| Staff portal | http://localhost:5176/ |
| Provider console | http://localhost:5177 |

Preview either site at the root without DNS:

```bash
VITE_SITE_MODE=public npm run dev   # patient site at /
VITE_SITE_MODE=portal npm run dev   # portal at /
```

### Migrations

`prisma migrate dev` needs a TTY and fails here. The workflow is:

```bash
# hand-write prisma/migrations/<timestamp>_<name>/migration.sql
npx prisma migrate deploy
npx prisma generate
```

Do **not** use `migrate diff --to-schema-datamodel` against an existing
clinic database: it cannot see the `?schema=` qualification and emits a
full drop-and-recreate.

On Windows, `prisma generate` fails with `EPERM` while a dev server holds
the query engine. Stop the servers first.

---

## 9. Troubleshooting

| Symptom | Cause |
|---|---|
| Login returns a token but the page stays on login | Fixed — but if it recurs, check the route's guard redirects authenticated users away from `/login`. |
| `ERR_CONNECTION_REFUSED` on 5176 after schema work | The dev server was killed to release the Prisma engine lock. Restart it. |
| Dropdowns render white-on-white | `theme.css` must style `select` **and** `option`; a native `<option>` never inherits its parent's styling. |
| Provisioning says "dry run" with keys set | Both `NEON_API_KEY` and `VERCEL_TOKEN` are required. One alone still means dry run. |
| Clinic's site shows almost nothing | Expected. Nothing is invented for them — the clinic fills in Settings → Clinic. |
| PDF comes out with columns overlapping | Column offsets must be cumulative. There is a positional test in the scratchpad that reads text placements out of a generated PDF. |

---

## 10. What is not built

Being explicit so you do not discover these in front of a customer.

- **The live provisioning path has never executed.** Only the dry-run
  branch has, because no credentials were configured when it was written.
  Do the first real run against a throwaway clinic.
- **Suspension is a record, not a switch.** Setting `SUSPENDED` does not
  take a clinic offline.
- **No billing or invoicing for your own business.** The console tracks fee
  and renewal date; it does not raise invoices or take payment.
- **No automated backups.** The clinic can export from Settings → Data &
  Backup. Nothing runs on a schedule.
- **No staged rollout.** A code change deploys to whichever clinic you
  redeploy. There is no canary and no version pinning per clinic.

---

## 11. Before you go live

### ⛔ The one real blocker: where patient files live

`clinic-api` writes uploaded scans, X-rays and lab reports to
`./uploads` on the local disk. There are already 22MB of them in
development.

**That does not survive a serverless host.** On Vercel, Netlify Functions
or Lambda the filesystem is ephemeral and per-instance: a file written
during one request is gone when the instance recycles, and invisible to
every other instance in the meantime. A doctor would upload an X-ray, see
it work, and find it missing the next day.

The provisioning code currently creates a **Vercel** project for the API.
That is wrong for this reason and must be changed before a real clinic
uses attachments.

Two ways out:

| Option | Effort | Notes |
|---|---|---|
| **Host the API somewhere with a persistent disk** — Railway, Render, Fly.io, or a small VPS | Low. No code change. | Recommended for clinic #1. Attach a volume at `apps/clinic-api/uploads`. Update `createVercelProject` in `provisioning.ts` to call that host's API instead. |
| **Move uploads to object storage** — S3, Cloudflare R2, Backblaze | Medium. Rewrite `lib/file-storage.ts`. | The right answer at ten clinics. `file-storage.ts` is already the single chokepoint — every read and write goes through it — so this is a contained change. |

`clinic-web` and `provider-console` are static builds and deploy to Vercel
perfectly well. Only the **API** needs a disk.

### Pre-flight checklist

- [ ] **Rotate every credential.** The dev accounts
      (`doctor@wellnessclinic.local` etc., all `dev-pass-12345`) and the
      console owner account must not exist in production.
- [ ] **Generate a fresh `JWT_SECRET` per clinic.** Never copy an env file
      between deployments — a shared secret means a token minted for one
      clinic is valid at another.
- [ ] **Set `NODE_ENV=production`.** This is what switches CORS from
      permissive to an allowlist and binds the provider API to `0.0.0.0`.
- [ ] **Set `CORS_ORIGINS`** to that clinic's real domains, comma
      separated. Without it, production CORS rejects everything.
- [ ] **Decide the uploads story** per the table above.
- [ ] **Take a database backup** before the first real patient.
- [ ] **Create a pharmacist account** if the clinic has one — none exists
      yet, so the pharmacy screens are currently reachable only by the
      doctor.
- [ ] **Run the first provisioning against a throwaway clinic.** The live
      Neon/Vercel path has never executed; only the dry run has.

### What is already hardened

| | |
|---|---|
| Login rate limiting | 5 attempts/minute per IP on both APIs, returning 429 with a countdown. `/health` is exempt so monitoring never looks like an outage. |
| CORS | Allowlist in production, permissive only in development. |
| Double submits | Identical in-flight mutations are collapsed in `apiFetch`, verified by counting network calls. |
| Secrets | `.env` and `uploads/` gitignored; verified nothing sensitive is tracked. |
| PHI access logging | Central hook, no route can skip it. |
| Error responses | 5xx are generic; 4xx keep their actionable message. |

### Deploying, concretely

```bash
# 1. Static front-ends — Vercel, Netlify, anywhere
cd apps/clinic-web && npm run build          # → dist/ (533KB)
cd apps/provider-console && npm run build    # → dist/ (269KB)
# Both need SPA fallback: serve index.html for unknown paths.

# 2. APIs — a host with a persistent disk
cd apps/clinic-api && npm run build && npm start
cd apps/provider-api && npm run build && npm start
```

All four build clean today.

### Smallest sensible first deployment

One clinic, three domains, four services:

```
drasif.in            → clinic-web      (static)
dashboard.drasif.in  → clinic-web      (same build, same deployment)
api.drasif.in        → clinic-api      (needs a disk)
console.yourco.in    → provider-console + provider-api
```

Get that working end to end with a throwaway clinic before onboarding a
paying one.

---

## 12. Multi-tenant subdomains

Clinics are addressed by subdomain under one platform domain. Onboarding
clinic #2 — or #500 — needs no domain purchase, no DNS change and no
certificate work.

```
yourco.in                  the platform's own marketing site
console.yourco.in          your provider console
api.yourco.in              the provider API (tenant directory)

acme.yourco.in             Acme Clinic's patient website
acme.portal.yourco.in      Acme Clinic's staff portal

bright.yourco.in           a different clinic
bright.portal.yourco.in    …its portal
```

Clinic **APIs** are deliberately *not* on vanity subdomains. Each clinic's
API is its own deployment with its own database, so one wildcard cannot
point at all of them — `*.api.yourco.in` would need a record per clinic,
which is exactly the per-clinic DNS work subdomains exist to avoid.

Instead each API keeps the hostname its host assigns
(`acme-api.up.railway.app`, `acme-api.fly.dev`), and that goes in the
account's `apiDomain`. The directory hands it to the browser at boot.
Patients never see it, so it does not need to be pretty — and this way
adding a clinic touches no DNS at all.

Set `CLINIC_API_URL_TEMPLATE` only if you *do* want vanity API hostnames
and accept adding one DNS record per clinic.

### Each clinic still has its own database

Nothing about the isolation model changed. The subdomain decides *which*
clinic's API and database to use; it does not put two clinics in one.
There is still no `clinicId` column anywhere, so a missing `WHERE` clause
cannot leak one clinic's patients into another's screen — that class of
bug does not exist here, which for regulated health records is worth more
than the hosting it costs.

### DNS: three records, once

| Record | Type | Points at | Covers |
|---|---|---|---|
| `yourco.in` | A / ALIAS | platform marketing site | the root |
| `*.yourco.in` | CNAME | the `clinic-web` deployment | every clinic's patient site |
| `*.portal.yourco.in` | CNAME | the same `clinic-web` deployment | every clinic's staff portal |

That is the whole DNS story. Clinic APIs add no records — see above.

**Two wildcards are required, not one.** A DNS or TLS wildcard matches
exactly one label, so `*.yourco.in` covers `acme.yourco.in` but **not**
`acme.portal.yourco.in`. Getting this wrong produces a certificate error
only on the portal, only for clinics, and only in production — so it is
worth checking before you need it.

Your TLS certificate therefore needs both `*.yourco.in` and
`*.portal.yourco.in` as SANs. Let's Encrypt issues wildcards via DNS-01;
most hosts do it for you once the records exist.

### One build serves every clinic

`clinic-web` is a single static deployment on the wildcard. It reads its
own hostname at boot, asks the tenant directory which clinic that is, and
points itself at that clinic's API before rendering anything.

```
VITE_PLATFORM_DOMAIN=yourco.in
VITE_PROVIDER_API_URL=https://api.yourco.in
```

Leave both unset and the app behaves exactly as it did before — one
clinic, its own domain, `VITE_API_URL` baked in. Existing deployments are
unaffected, and a clinic that insists on its own domain still gets one:
set `apiDomain` on its account and that always wins over the template.

### The tenant directory

`GET /api/provider/public/tenant/:slug` — unauthenticated, because it
runs before a patient has any identity.

It returns only `slug`, `name`, `status`, `suspended`, `apiBaseUrl`,
`publicHost` and `portalHost`. The account row beside those fields holds
the monthly fee, the contact's email, private notes and the Neon project
id, so the response is built field by field rather than by excluding
things from a row — and the test plants canary values in every sensitive
column and asserts they never appear.

Two behaviours worth knowing:

- **A clinic still being onboarded returns 404**, not "ONBOARDING". Which
  clinics are mid-deal is commercially sensitive and there is nothing for
  a visitor to see either way.
- **Suspension is enforced here.** A `SUSPENDED` clinic resolves, so its
  site can explain itself instead of looking broken, but it is handed no
  API base URL at all — so the bundle has nowhere to send patient data
  even if something downstream ignored the status. This is what turned
  suspension from a record in a table into an actual switch.

### The new dependency, and why it is survivable

Every clinic's website now needs the directory to boot. That is a real
single point of failure, so it is cached at two levels:

- The response carries
  `Cache-Control: public, max-age=300, stale-while-revalidate=86400`, so
  a CDN keeps serving the last good answer for a day.
- The browser keeps its own copy in `localStorage` and serves it when the
  lookup fails.

So the directory going down degrades to "returning visitors are
unaffected" rather than "every clinic is offline at once". A 404 is
treated as authoritative and clears the cached copy — otherwise a removed
clinic would resurrect itself from a stale entry.

### Slugs are hostnames, so they are validated as hostnames

A slug becomes `<slug>.yourco.in`. A clinic onboarded as `api` would
claim the platform's own hostname and take everything down with it, so
**91 reserved slugs** are refused at account creation (`api`, `www`,
`console`, `portal`, `mail`, `ns1`, `staging`…), along with leading or
trailing hyphens, the `xn--` punycode prefix, and anything over 63
characters — the hard limit on a single DNS label.

The console suggests `<slug>-clinic` when a name is reserved, so the
operator gets a working alternative rather than a rejection.

### CORS

Clinic subdomains are unbounded, so they cannot be enumerated in an
allowlist. The provider API matches the platform domain by suffix
instead — on a label boundary, and over HTTPS only, so `evil-yourco.in`
and `yourco.in.evil.com` are both refused. Those two are exactly how a
hand-rolled origin check usually fails open, and both are covered by
tests.

### Adding a clinic, end to end

1. Create the account in the console. Pick a slug — it is the subdomain.
2. Provision: Neon project, API deployment, migrate, seed.
3. Set status to **LIVE**. Nothing else happens anywhere.
4. `acme.yourco.in` and `acme.portal.yourco.in` now work.

No DNS. No certificate. No redeploy of `clinic-web`.
