# Deployment & Costs

Every service, what it needs, what it costs, and the cheapest path that is
not a trap.

Prices checked **11 October 2026**. Rupee figures assume ~₹88/USD — treat
the dollar figures as the real ones. Verify on each provider's page before
committing; several moved during 2026.

---

## 1. What actually needs hosting

Four services, but they do not scale the same way. This is the whole cost
story in one table:

| Service | How many | Needs | Scales with clinics? |
|---|---|---|---|
| `clinic-web` | **one, total** | static files | **No.** One build serves every clinic via the wildcard. |
| `provider-console` | **one, total** | static files | No. |
| `provider-api` | **one, total** | Node + a database | No. |
| `clinic-api` | **one per clinic** | Node + **a persistent disk** + its own database | **Yes.** Your only per-clinic cost. |

So the marginal cost of a clinic is *one Node process, one small disk, one
small database*. Nothing else multiplies.

### The disk is not optional

`clinic-api` writes X-rays, scans and lab reports to `./uploads`. On
Vercel, Netlify Functions or Lambda the filesystem is **ephemeral** — the
file is gone when the instance recycles. A doctor would upload a scan, see
it work, and find it missing the next day.

**So `clinic-api` cannot go on a serverless host.** Everything else can.
This single fact drives every recommendation below.

---

## 2. The cheapest real setup

| Piece | Where | Cost |
|---|---|---|
| `clinic-web` + `provider-console` | Vercel Hobby | **$0** |
| `clinic-api` × N + `provider-api` | one DigitalOcean droplet, Bangalore | **$6/mo** (1 GB) → $12 (2 GB) |
| Every database | Neon Free — **100 projects**, 1 GB each | **$0** |
| Domain | `.in` at any registrar | ~₹900–1,200/yr |
| Patient file storage | the droplet's own SSD | included |

**Clinic #1 total: ~$6/month (~₹530).** Clinics #2 and #3 cost **nothing
extra** until the droplet fills.

This also fixes the uploads blocker for free: a droplet has a real disk, so
patient files simply persist.

**The honest catch:** a VPS is yours to run. You install Node, nginx and
certbot, you apply security updates, you set up your own backups. Budget a
day to set up and an hour a month to maintain. If you would rather pay to
never think about it, see §6.

---

## 3. Costs at each provider, verified

### Static hosting — `clinic-web`, `provider-console`

| Provider | Free tier | Wildcard domains? |
|---|---|---|
| **Vercel Hobby** | $0 | **Yes — 50 custom domains per project** |
| Cloudflare Pages | $0, unlimited bandwidth | Historically **not** on Pages; needs a Worker. Verify before relying on it. |
| Netlify | $0, 100 GB/mo | Wildcards on paid plans |

**Use Vercel Hobby.** Free, does wildcards, and the two-level wildcard you
need (`*.portal.yourco.in`) is explicitly documented.

### Compute with a disk — `clinic-api`

| Provider | Entry price | Disk | Region near India |
|---|---|---|---|
| **DigitalOcean** | **$4/mo** (512 MB, 10 GB SSD)<br>**$6/mo** (1 GB, 25 GB) | included | **Bangalore** ✓ |
| Hetzner | ~€4–8/mo (sources conflict) | included | Singapore ✓ |
| Railway | $5/mo plan incl. $5 usage; then RAM $10/GB-mo, vCPU $20/vCPU-mo | **$0.15/GB-mo** | no India region |
| Render | **$7/mo** Starter (512 MB, 0.5 CPU) | **$0.25/GB-mo** | Singapore ✓ |

Hetzner looks cheapest but its 2026 prices disagree across every source I
checked, and its nearest region is Singapore. DigitalOcean Bangalore costs
a little more and sits in the same country as your patients — which matters
for latency and for where health data is expected to live.

### Databases

| Provider | Free tier | Paid |
|---|---|---|
| **Neon** | **100 projects**, 1 GB each, 20 GB total, 100 CU-hours/project | $0.106/CU-hour, $0.35/GB-month, no monthly minimum |
| Render Postgres | none | from ~$6/mo per database |
| Supabase | 2 projects | $25/mo |

**Neon wins outright, and not narrowly:** 100 free projects means your
first ~20 clinics need no database spend at all. A clinic's records are
text — 5,000 patients is well under 100 MB, so 1 GB per project is generous
rather than tight.

> ⚠️ **One trap worth knowing.** Neon Free gives 100 CU-hours per project
> and suspends compute after 5 minutes idle. At the 0.25 CU minimum that is
> ~400 hours of activity a month, and a clinic open 10 hours a day uses
> ~75. Comfortable — **unless the API holds a connection open 24/7**, which
> prevents suspend and burns ~182 CU-hours, over the cap. Compute then stops
> until the next billing period.

Set a pool that lets idle connections close:

```
DATABASE_URL="postgresql://...?connection_limit=5&pool_timeout=20"
```

Check Neon usage in week one. If you are near the cap, Launch is
pay-as-you-go with no minimum — a small clinic lands around $2–4/month.

### Object storage — only when you outgrow the disk

| Provider | Storage | Egress |
|---|---|---|
| **Cloudflare R2** | $0.015/GB-mo, **10 GB free** | **$0** |
| AWS S3 | ~$0.023/GB-mo | ~$0.09/GB — the part that hurts |

R2's zero egress is the point: serving X-rays back to doctors is pure
egress, which is exactly where S3 bills add up. Not needed on day one — the
droplet's SSD is fine for years at clinic scale.

---

## 4. Step by step

### Step 0 — Buy the domain, point it at Vercel

Any registrar. A `.in` runs ₹900–1,200/year.

Wildcard certificates need DNS-challenge access, so **either** switch to
Vercel's nameservers (simplest), **or** keep DNS where it is and delegate
just the challenge:

| Type | Name | Value |
|---|---|---|
| `NS` | `_acme-challenge` | `ns1.vercel-dns.com.` |
| `NS` | `_acme-challenge` | `ns2.vercel-dns.com.` |
| `NS` | `_acme-challenge.portal` | `ns1.vercel-dns.com.` |
| `NS` | `_acme-challenge.portal` | `ns2.vercel-dns.com.` |
| `CNAME` | `*` | `cname.vercel-dns-0.com.` |
| `CNAME` | `*.portal` | `cname.vercel-dns-0.com.` |

Leave the `NS` records in place permanently, or renewal breaks in 90 days.

**Cost: domain only.**

---

### Step 1 — Deploy `clinic-web` (serves every clinic)

```bash
cd apps/clinic-web
npm run build          # -> dist/, ~533 KB
npx vercel --prod
```

In Vercel → Settings → Domains, add **both**:

```
*.yourco.in
*.portal.yourco.in
```

Environment variables:

```
VITE_PLATFORM_DOMAIN=yourco.in
VITE_PROVIDER_API_URL=https://api.yourco.in
```

SPA fallback — `apps/clinic-web/vercel.json`:

```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

Without it, any deep link 404s on refresh.

**Cost: $0.**

---

### Step 2 — Deploy `provider-console` (your console)

```bash
cd apps/provider-console
npm run build          # -> dist/, ~268 KB
npx vercel --prod
```

Domain `console.yourco.in`, same SPA rewrite, and:

```
VITE_API_URL=https://api.yourco.in/api/provider
```

**Cost: $0.**

---

### Step 3 — Create the droplet

DigitalOcean → Create Droplet → **Bangalore** → Ubuntu 24.04 →
**$6/mo (1 GB / 25 GB)**. Add your SSH key.

```bash
ssh root@<ip>
adduser deploy && usermod -aG sudo deploy
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw enable
apt update && apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs nginx certbot python3-certbot-nginx
```

Point DNS at it: an `A` record for `api.yourco.in` → the droplet IP.

**Cost: $6/mo.**

---

### Step 4 — Deploy `provider-api`

```bash
sudo -iu deploy
git clone <your repo> ~/app && cd ~/app
npm install
cd apps/provider-api
npx prisma generate     # REQUIRED before build -- see the note below
npm run build
```

> `prisma generate` must run before `npm run build`. The generated client
> lives at a custom path (three schemas in one monorepo would otherwise
> fight over the hoisted `@prisma/client`), it is JavaScript so `tsc` does
> not emit it, and the build copies it into `dist/`. Skip the generate and
> the build fails with a clear message rather than shipping a broken
> `dist/`.

`apps/provider-api/.env`:

```bash
NODE_ENV=production
PORT=4200
DATABASE_URL="<its own Neon project>"
JWT_SECRET="<openssl rand -base64 32>"
PLATFORM_DOMAIN=yourco.in
CORS_ORIGINS=https://console.yourco.in
NEON_API_KEY=...
```

Run it under systemd so it survives a reboot:

```ini
# /etc/systemd/system/provider-api.service
[Unit]
Description=provider-api
After=network.target

[Service]
Type=simple
User=deploy
WorkingDirectory=/home/deploy/app/apps/provider-api
ExecStart=/usr/bin/node dist/server.js
# NOTE: provider-api's entry is dist/server.js; clinic-api's is
# dist/index.js. `npm start` is correct for both if you prefer that.
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now provider-api
npx prisma migrate deploy
PROVIDER_SEED_EMAIL=you@example.com PROVIDER_SEED_PASSWORD='<strong>' \
  npx tsx prisma/seed-provider.ts
```

nginx + TLS:

```nginx
# /etc/nginx/sites-available/api.yourco.in
server {
  server_name api.yourco.in;
  location / {
    proxy_pass http://127.0.0.1:4200;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/api.yourco.in /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d api.yourco.in
```

**Cost: $0 extra.**

---

### Step 5 — Deploy a clinic's API

**Once per clinic.** Each gets its own port, own `.env`, own database, own
uploads directory.

1. **Neon** → new project, region **ap-south-1 (Mumbai)** → copy the
   connection string.

2. `/home/deploy/clinics/acme/.env`:

```bash
NODE_ENV=production
PORT=4101                       # 4102, 4103... for later clinics
DATABASE_URL="<this clinic's Neon project only>"
JWT_SECRET="<a fresh openssl rand -base64 32>"
CLINIC_PLAN=STANDARD
CORS_ORIGINS=https://acme.yourco.in,https://acme.portal.yourco.in
```

> **Never copy a `JWT_SECRET` between clinics.** A shared secret means a
> token minted at one clinic is valid at another — one login, every clinic's
> patient records.

3. Migrate, seed, run:

```bash
cd ~/app/apps/clinic-api
npx prisma migrate deploy
npx tsx prisma/seed-clinic.ts
sudo systemctl enable --now clinic-acme
# Copy the unit from step 4, but note clinic-api's entry point:
#   ExecStart=/usr/bin/node dist/index.js
#   WorkingDirectory=/home/deploy/app/apps/clinic-api
# and point it at this clinic's .env (systemd: EnvironmentFile=).
```

4. Give it a hostname the browser can reach — `acme-api.yourco.in` via
   nginx, or the host's own assigned name. Patients never see this URL.

5. In the console: create the account with slug `acme`, set `apiDomain` to
   that hostname, set status **LIVE**.

`acme.yourco.in` and `acme.portal.yourco.in` now work. **No DNS. No
certificate. No redeploy.**

**Cost: $0 until the droplet fills.**

---

## 5. What it costs as you grow

A `clinic-api` process is roughly 150–200 MB resident. After the OS takes
its ~150 MB:

| Droplet | RAM | Clinics it holds | Cost | Per clinic |
|---|---|---|---|---|
| $6 | 1 GB | ~3 | $6/mo | $2.00 |
| $12 | 2 GB | ~8 | $12/mo | $1.50 |
| $24 | 4 GB | ~18 | $24/mo | $1.33 |
| $48 | 8 GB | ~38 | $48/mo | $1.26 |

Add Neon once you pass the free tier (~20 clinics), at roughly $2–4 per
clinic per month.

**Realistic all-in:**

| Clinics | Monthly | Per clinic |
|---|---|---|
| 1 | **$6** (₹530) | $6.00 |
| 3 | **$6** (₹530) | $2.00 |
| 10 | **$12** (₹1,060) | $1.20 |
| 25 | **$24 + ~$40 Neon = $64** (₹5,600) | $2.56 |
| 50 | **$48 + ~$90 Neon = $138** (₹12,150) | $2.76 |

At ₹2,000–5,000/month per clinic, infrastructure stays **under 2% of
revenue** at every size. Nothing here constrains the business.

---

## 6. If you would rather not run a server

A fair trade. Managed hosting costs 3–5× but removes the sysadmin work.

| | Cheapest (VPS) | Railway | Render |
|---|---|---|---|
| Clinic #1 | **$6** | ~$9 | ~$15 |
| 10 clinics | **$12** | ~$48 | ~$82 |
| Per extra clinic | ~$1.20 | ~$4.30 | ~$7.50 |
| You patch the OS | yes | no | no |
| Deploys | `git pull` + restart | git push | git push |
| India region | ✓ Bangalore | ✗ | ✓ Singapore |

**Railway** is the middle option and the one to pick if the VPS sounds like
a chore: real persistent volumes ($0.15/GB-mo), git-push deploys, ~$4.30
per clinic.

**Render** is simplest and priciest. Sources also mention a workspace fee
on top of per-service pricing in 2026 — confirm before budgeting.

**Start on the VPS.** At three clinics you pay $6 against maybe ₹9,000 of
revenue. Move to Railway later if maintenance annoys you; these are plain
Node apps and move in an afternoon.

---

## 7. Things that will bite you

- **`NODE_ENV=production` is load-bearing.** It switches CORS from
  permissive to an allowlist. Forget it and any website can call your API.
- **Set `CORS_ORIGINS`** per clinic. Without it, production CORS rejects
  everything and the site looks broken.
- **Rotate every dev credential.** `dev-pass-12345` exists on five accounts
  right now.
- **Back up before the first real patient.** Neon Free has no automated
  backups. A nightly `pg_dump` on the droplet is enough to start — and
  `uploads/` must be in it too. A database-only backup is not a backup here.
- **Watch Neon CU-hours in week one**, per the pooling note in §3.
- **Keep the `_acme-challenge` NS records.** Remove them and the wildcard
  silently fails to renew in 90 days.
- **No pharmacist account exists yet.** Create one if the clinic has a
  pharmacy, or those screens are reachable only by the doctor.
- **Rehearse on a throwaway clinic.** The live provisioning path has never
  executed — only its dry run has.

---

## Sources

Checked 11 October 2026.

- [Vercel — adding a custom domain](https://vercel.com/docs/domains/working-with-domains/add-a-domain) — wildcards, `_acme-challenge` delegation, 50 domains per Hobby project
- [Railway pricing](https://railway.com/pricing) — $5 Hobby, RAM/vCPU/volume rates
- [Neon pricing](https://neon.com/pricing) — 100 free projects, CU-hour and storage rates
- [DigitalOcean droplet pricing](https://www.digitalocean.com/pricing/droplets) — $4/$6 tiers, Bangalore region
- [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/) — $0.015/GB-mo, free egress
- [Render — hosting cost guide](https://render.com/articles/how-much-does-cloud-application-hosting-cost-for-small-businesses) and [Render pricing 2026 overview](https://livemy.app/blog/render-pricing) — Starter and disk rates; figures provisional
- [Hetzner Cloud](https://www.hetzner.com/cloud/) and [cloud pricing comparison, Aug 2026](https://kimmo.suominen.com/stuff/cpc-2026-08.txt) — Singapore region; 2026 prices inconsistent across sources
