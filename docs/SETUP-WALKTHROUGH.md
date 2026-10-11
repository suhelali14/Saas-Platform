# Setup walkthrough

Which website to go to, in what order, and what to click. Tick each box.

Your code is already on GitHub at `suhelali14/Saas-Platform`, branch
`master`, so that part is done.

**Total: about 2 hours, most of it waiting for DNS.**
**Running cost: $6/month plus the domain.**

Do the steps in this order — each one needs something from the one before.

---

## Step 1 — Buy the domain

**Where:** any registrar. For a `.in`:
[Hostinger](https://www.hostinger.in/domain-name-search),
[BigRock](https://www.bigrock.in),
[GoDaddy](https://in.godaddy.com/domains),
[Namecheap](https://www.namecheap.com) (`.com` is often cheaper here).

- [ ] Search for the name you want
- [ ] Buy it — **₹900–1,200/year** for `.in`
- [ ] Decline every upsell (hosting, email, "privacy protection", SSL).
      You need none of them; TLS comes free from Vercel and Let's Encrypt.

Through this document, `yourco.in` means whatever you bought.

> Pick something short. Clinics will say it on the phone, and it becomes
> part of every clinic's address: `acme.yourco.in`.

**Cost: ₹900–1,200/year. Time: 10 minutes.**

---

## Step 2 — Vercel: the two static sites

**Where:** [vercel.com](https://vercel.com) → **Sign up** → *Continue with
GitHub*

Create the projects from your own machine rather than the dashboard's
"Import Git Repository". Importing connects Vercel's own auto-deploy,
which would deploy on every push *in addition to* your CI workflow — and
Vercel's deploy is not gated on tests passing. Linking from the CLI
creates the project with no Git connection, so your workflow owns deploys.

In your project folder:

```bash
npm i -g vercel
vercel login

cd apps/clinic-web
vercel link          # Set up a new project? Yes.  Name: clinic-web
cat .vercel/project.json          # <- copy orgId and projectId

cd ../provider-console
vercel link          # Name: provider-console
cat .vercel/project.json          # <- copy projectId
```

Keep those three values. You need them in Step 8:

- [ ] `orgId` → becomes `VERCEL_ORG_ID`
- [ ] clinic-web's `projectId` → `VERCEL_PROJECT_ID_CLINIC_WEB`
- [ ] provider-console's `projectId` → `VERCEL_PROJECT_ID_PROVIDER_CONSOLE`

Now get an access token:

- [ ] **vercel.com** → your avatar → **Account Settings** → **Tokens**
- [ ] **Create** → name it `github-actions`, scope *Full Account*, no
      expiry (or set a reminder)
- [ ] Copy it now — it is shown **once**. This becomes `VERCEL_TOKEN`.

### Add the domains

**vercel.com** → project **clinic-web** → **Settings** → **Domains**:

- [ ] Add `*.yourco.in`
- [ ] Add `*.portal.yourco.in`

Two separate entries. A wildcard matches exactly one DNS label, so
`*.yourco.in` does **not** cover `acme.portal.yourco.in` — this is the
single most common way this setup gets broken.

Project **provider-console** → **Settings** → **Domains**:

- [ ] Add `console.yourco.in`

Vercel will now show you **nameservers** (like `ns1.vercel-dns.com`)
because wildcards need DNS-challenge access to issue certificates.

- [ ] Write both nameservers down

**Cost: $0. Time: 20 minutes.**

---

## Step 3 — Registrar: point the domain at Vercel

**Where:** back at your registrar, in the domain's DNS / nameserver
settings. Look for "Nameservers", "Custom DNS" or "Change nameservers".

- [ ] Switch from the registrar's defaults to **Custom**
- [ ] Enter the two Vercel nameservers from Step 2
- [ ] Save

From now on you manage all DNS **at Vercel**, not the registrar.

> Propagation takes 10 minutes to a few hours. Start Step 4 while you
> wait — it does not depend on this.

### On GoDaddy specifically

1. Sign in → **Domain Portfolio** (or *My Products*)
2. Click the domain itself — not the Manage button beside it
3. Find **DNS and Nameservers** at the top of the domain's page
4. Open **Nameservers** → **Change**
5. Choose **I'll use my own nameservers**
6. Paste the two Vercel nameservers, remove any GoDaddy ones
7. **Save**

GoDaddy may then ask for a verification code — a 2-step code if you have
had 2SV enabled for over 24 hours, otherwise a one-time password emailed
to your account address. That is Domain Protection, not an error.

After this, **stop using GoDaddy's DNS records page.** Once the
nameservers point at Vercel, GoDaddy is no longer answering DNS queries
for the domain and anything you add there has no effect. Every record from
here on goes in Vercel → Domains → your domain → DNS Records.

> **Where does the IP come from?** Not from GoDaddy. A registrar sells you
> the name; the IP belongs to whatever hosts the service. In this setup
> the only IP you need is your **DigitalOcean droplet's**, created in
> Step 4, and it goes into Vercel's DNS in Step 5. Vercel itself never
> gives you an IP — it gives nameservers, which is why Step 3 exists.

If you would rather keep DNS at GoDaddy, the alternative (NS delegation of
`_acme-challenge`) is in
[DEPLOYMENT-AND-COSTS.md](DEPLOYMENT-AND-COSTS.md) §4 Step 0. It is more
fiddly and easy to get wrong; moving the nameservers is simpler and is
what the rest of this assumes.

**Cost: $0. Time: 5 minutes, plus waiting.**

---

## Step 4 — DigitalOcean: the server

**Where:** [digitalocean.com](https://www.digitalocean.com) → **Sign up**

New accounts usually get $200 in credit for 60 days, which covers this
entirely for the first two months.

- [ ] **Create** → **Droplets**
- [ ] Region: **Bangalore (BLR1)** — same country as your patients
- [ ] Image: **Ubuntu 24.04 (LTS) x64**
- [ ] Size: **Basic** → **Regular** → **$6/mo** (1 GB RAM, 25 GB SSD)
- [ ] Authentication: **SSH Key** → **New SSH Key**

If you do not have a key yet, on your own machine:

```bash
ssh-keygen -t ed25519 -C "my-laptop"
cat ~/.ssh/id_ed25519.pub        # paste this into DigitalOcean
```

- [ ] Hostname: `clinic-server`
- [ ] **Create Droplet**
- [ ] Copy the **IP address** it gives you

Find it again any time at **digitalocean.com → Droplets** — the IPv4
address is in the list, and clicking the droplet shows it in full. This is
the only IP address in the whole setup.

Choose the $6 size, not the $4. The $4 has 512 MB, which runs out at
about two clinics plus the build.

**Cost: $6/month. Time: 10 minutes.**

---

## Step 5 — Vercel DNS: point the API at the server

Your clinic sites go to Vercel; the APIs go to your droplet. Both are
under the same domain, so this record lives at Vercel now.

**Where:** **vercel.com** → **Domains** (top nav) → click `yourco.in` →
**DNS Records**

- [ ] **Add** → Type `A`, Name `api`, Value *your droplet IP*
- [ ] **Add** → Type `A`, Name `*.api`, Value *your droplet IP*

The second one is a wildcard so each clinic's API hostname
(`acme-api.yourco.in`) resolves without you adding a record per clinic.

Check it after a few minutes:

```bash
nslookup api.yourco.in
```

- [ ] It returns your droplet IP

**Cost: $0. Time: 5 minutes, plus waiting.**

---

## Step 6 — Neon: the databases

**Where:** [neon.com](https://neon.com) → **Sign up** → *Continue with
GitHub*

The free plan allows **100 projects**, so your first ~20 clinics cost
nothing. One project per clinic, plus one for the console.

### The console's database

- [ ] **New Project**
- [ ] Name: `provider-console`
- [ ] Region: **AWS ap-south-1 (Mumbai)**
- [ ] **Create**
- [ ] Copy the **connection string** (`postgresql://...`) — keep it safe

### Your first clinic's database

- [ ] **New Project** again
- [ ] Name: `clinic-acme` (use the real clinic's name)
- [ ] Region: **ap-south-1 (Mumbai)**
- [ ] Copy that connection string too, separately

> Never reuse one connection string for two clinics. There is no
> `clinicId` anywhere in the schema, so two clinics on one database would
> quietly show each other's patients. `add-clinic.sh` refuses a string
> already in use, but keep them clearly labelled anyway.

### The API key, for the console to provision future clinics

- [ ] Avatar → **Account settings** → **API keys** → **Create new**
- [ ] Copy it — shown once. This is `NEON_API_KEY`.

**Cost: $0. Time: 15 minutes.**

---

## Step 7 — The server: set it up

**Where:** your terminal.

```bash
ssh root@<your-droplet-ip>
```

Say `yes` to the fingerprint prompt the first time.

### Run the bootstrap

```bash
curl -fsSL https://raw.githubusercontent.com/suhelali14/Saas-Platform/master/deploy/bootstrap-server.sh \
  | bash -s -- https://github.com/suhelali14/Saas-Platform.git
```

If the repo is private, clone it manually first with a token, then run
`sudo bash /srv/clinic/repo/deploy/bootstrap-server.sh <git-url>`.

That installs Node 22, nginx, certbot and automatic security updates,
creates the `deploy` user, builds `/srv/clinic`, installs the systemd
units, sets up nightly backups, and closes the firewall to 22/80/443.

- [ ] It finishes and prints a "Server ready" block
- [ ] **Copy the `DEPLOY_HOST_KEY` lines it prints** — needed in Step 8

### Create the CI deploy key

On **your own machine**, not the server:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/clinic-deploy -N "" -C "github-actions"
ssh-copy-id -i ~/.ssh/clinic-deploy.pub deploy@<droplet-ip>
```

- [ ] Confirm it works: `ssh -i ~/.ssh/clinic-deploy deploy@<droplet-ip> whoami`
      → prints `deploy`

### Write the console's config

Back on the server:

```bash
sudo -u deploy nano /srv/clinic/env/provider.env
```

```bash
NODE_ENV=production
PORT=4200
DATABASE_URL="<the provider-console string from Step 6>"
JWT_SECRET="<paste from: openssl rand -base64 32>"
PLATFORM_DOMAIN=yourco.in
CORS_ORIGINS=https://console.yourco.in
NEON_API_KEY=<from Step 6>
```

Generate the secret with `openssl rand -base64 32` and paste the output.
Save with `Ctrl+O`, `Enter`, `Ctrl+X`.

- [ ] `PLATFORM_DOMAIN` is set — `add-clinic.sh` reads it from this file
      to build every clinic's hostnames, and fails without it

### First deploy

```bash
sudo -u deploy /srv/clinic/repo/deploy/deploy.sh
```

- [ ] It ends with "Deployed `<timestamp>`"

### TLS and start

```bash
sudo certbot --nginx -d api.yourco.in
sudo systemctl enable --now provider-api
curl https://api.yourco.in/health
```

- [ ] The last command returns `{"status":"ok",...}`

If certbot fails, `api.yourco.in` has not propagated yet. Wait and retry.

### Create your console login

```bash
cd /srv/clinic/current/apps/provider-api
sudo -u deploy env $(grep -v '^#' /srv/clinic/env/provider.env | xargs) \
  PROVIDER_SEED_EMAIL=you@example.com \
  PROVIDER_SEED_NAME="Your Name" \
  PROVIDER_SEED_PASSWORD='<a strong password>' \
  npx tsx prisma/seed-provider.ts
```

- [ ] It confirms the user was created

**Cost: $0 extra. Time: 30 minutes.**

---

## Step 8 — GitHub: wire up automatic deploys

**Where:** [github.com/suhelali14/Saas-Platform](https://github.com/suhelali14/Saas-Platform)
→ **Settings** → **Secrets and variables** → **Actions**

### Secrets tab → "New repository secret", nine times

| Name | Value |
|---|---|
| `DEPLOY_HOST` | your droplet IP |
| `DEPLOY_USER` | `deploy` |
| `DEPLOY_SSH_KEY` | `cat ~/.ssh/clinic-deploy` — the **private** half, whole file including the BEGIN/END lines |
| `DEPLOY_HOST_KEY` | the lines bootstrap printed in Step 7 |
| `VERCEL_TOKEN` | from Step 2 |
| `VERCEL_ORG_ID` | from Step 2 |
| `VERCEL_PROJECT_ID_CLINIC_WEB` | from Step 2 |
| `VERCEL_PROJECT_ID_PROVIDER_CONSOLE` | from Step 2 |

- [ ] All eight added

> Do not skip `DEPLOY_HOST_KEY`. Without it the workflow trusts whatever
> answers on that IP, so a DNS or routing compromise would be handed your
> deploy key and a shell on the machine holding patient records. The
> workflow warns but still runs, so it is easy to leave undone.

### Variables tab → "New repository variable", twice

| Name | Value |
|---|---|
| `PLATFORM_DOMAIN` | `yourco.in` |
| `PROVIDER_API_URL` | `https://api.yourco.in` |

- [ ] Both added

These are variables rather than secrets on purpose: both end up readable
in the browser bundle anyway, and marking a public value secret only
makes your CI logs unreadable.

### Prove it works

```bash
git commit --allow-empty -m "Trigger first automated deploy"
git push origin master
```

- [ ] **GitHub → Actions** shows CI, then *Deploy static apps* and
      *Deploy APIs*, all green
- [ ] `https://console.yourco.in` loads and you can log in

**Cost: $0. Time: 15 minutes.**

---

## Step 9 — Add your first clinic

**Where:** SSH on the server.

```bash
sudo /srv/clinic/repo/deploy/add-clinic.sh acme --plan STANDARD
```

It will ask for:

- the clinic's Neon connection string (Step 6)
- the clinic's name, e.g. `Acme Clinic`
- the doctor's printed name, e.g. `Dr. Asif Khan` — this appears on every
  prescription
- the doctor's login email

- [ ] It ends with "Acme Clinic is live" and prints a password
- [ ] **Write that password down.** It is not stored anywhere.

**Cost: $0. Time: 5 minutes.**

---

## Step 10 — Switch the clinic on

**Where:** `https://console.yourco.in`, logged in.

- [ ] Click **Onboard a clinic**
- [ ] **Clinic name** — the full name, e.g. `Acme Clinic Private Limited`
- [ ] **Subdomain** — type `acme`. It must match Step 9 exactly.

> The subdomain field pre-fills from the name but **check it**. A legal
> name would otherwise give you
> `acme-clinic-private-limited.yourco.in`, which the clinic has to read
> out over the phone. The field shows both resulting URLs as you type,
> and it cannot be changed after the account is created — every URL the
> clinic has given to patients would move.

- [ ] Contact, city, plan, monthly fee
- [ ] **Create account**
- [ ] Open the new clinic → set **apiDomain** to `acme-api.yourco.in`
      (printed in Step 9)
- [ ] Set status to **LIVE**

Until status is LIVE the patient URLs deliberately show "no clinic at this
address", so a half-finished setup is never publicly visible.

Now check:

- [ ] `https://acme.yourco.in` → the patient website
- [ ] `https://acme.portal.yourco.in` → the staff login
- [ ] The doctor can log in with the Step 9 credentials

**Done.**

---

## Every clinic after this one

Only two steps, about 10 minutes:

1. **neon.com** → New Project → ap-south-1 → copy the string
2. `sudo /srv/clinic/repo/deploy/add-clinic.sh <slug>`
3. Console → **Onboard a clinic** → set the **Subdomain** to the same
   slug → set `apiDomain` → status **LIVE**

No DNS. No certificate. No redeploy. No new hosting.

---

## Every code change after this one

```bash
git push origin master
```

CI runs, and if it is green both deploys go out. Watch it in **GitHub →
Actions**.

---

## Where each thing lives, afterwards

| What | Where |
|---|---|
| Your code | github.com/suhelali14/Saas-Platform |
| Patient websites + portals | Vercel |
| All APIs, all patient files | your DigitalOcean droplet |
| All databases | Neon |
| DNS | Vercel |
| Your console | `console.yourco.in` |
| Backups | on the droplet, `/srv/clinic/backups`, nightly at 02:15 |

---

## If something breaks

| Symptom | Cause | Fix |
|---|---|---|
| `acme.yourco.in` shows "no clinic at this address" | status is not LIVE, or the console's subdomain differs from the one in `add-clinic.sh` | Check both in the console |
| The subdomain is long and ugly | the field was left as the auto-filled legal name | It cannot be edited; delete the account and recreate it with a short subdomain |
| Certificate warning on the portal only | `*.portal.yourco.in` was never added | Step 2, add it as a second domain |
| certbot fails | DNS has not propagated | `nslookup api.yourco.in`, wait, retry |
| CI red on *Deploy APIs* | a secret is wrong | Check the Actions log — it names what is missing |
| A clinic's API is down | service crashed | `journalctl -u clinic-api@acme -n 50` |
| A deploy broke everything | bad build | `sudo -u deploy /srv/clinic/repo/deploy/rollback.sh` |

---

## Before a real patient's records go in

- [ ] Rotate every dev credential — `dev-pass-12345` exists on five
      accounts
- [ ] Run a backup by hand and confirm it produced files:
      `sudo -u deploy /usr/local/bin/clinic-backup && ls -la /srv/clinic/backups/*/`
- [ ] Copy backups off the server — they currently sit on the same disk
      they protect
- [ ] Create a pharmacist account if the clinic has a pharmacy
- [ ] Check Neon usage after a week (see the CU-hours note in
      [DEPLOYMENT-AND-COSTS.md](DEPLOYMENT-AND-COSTS.md) §3)
- [ ] Rehearse all of this on a throwaway clinic first — the live
      provisioning path has never been executed
