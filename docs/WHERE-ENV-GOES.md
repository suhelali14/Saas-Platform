# Where configuration lives

Nothing in the pushed code holds a real value, and that is deliberate.
Config lives in **four** places, each for a different reason.

| Place | Holds | Who sets it | In git? |
|---|---|---|---|
| **1. The repo** | `.env.example` templates only | already done | yes, no real values |
| **2. GitHub → Secrets** | how CI reaches your server + Vercel | you, in the browser, once | no |
| **3. GitHub → Variables** | public build values for the frontend | you, in the browser, once | no |
| **4. The server, `/srv/clinic/env/*.env`** | every API's real runtime config | you, over SSH | **never** |

The **Docker image contains no configuration at all.** That is what lets
one image serve every clinic: config is injected at container start with
`--env-file`, so the same artifact runs as Acme's API, as Bright's API,
and as your console.

---

## 1. The repo — templates only

```
apps/clinic-api/.env.example
apps/provider-api/.env.example
apps/clinic-web/.env.example
```

These document every variable with no real value in them. Copy from them;
never commit a filled-in one. `.env` is gitignored, and CI fails the build
if a server secret turns up in a browser bundle.

**Nothing to do here.**

---

## 2. GitHub → Secrets

**github.com/suhelali14/Saas-Platform → Settings → Secrets and variables
→ Actions → Secrets tab**

These exist only so CI can reach your server and Vercel. No application
ever reads them.

| Secret | Where to get it |
|---|---|
| `DEPLOY_HOST` | your droplet's IP |
| `DEPLOY_USER` | `deploy` |
| `DEPLOY_SSH_KEY` | `cat ~/.ssh/clinic-deploy` — the **private** half, whole file |
| `DEPLOY_HOST_KEY` | printed by `bootstrap-server.sh`, or `ssh-keyscan -H <ip>` |
| `DEPLOY_PORT` | only if SSH is not on 22 |
| `VERCEL_TOKEN` | vercel.com → Account Settings → Tokens |
| `VERCEL_ORG_ID` | `apps/clinic-web/.vercel/project.json` after `vercel link` |
| `VERCEL_PROJECT_ID_CLINIC_WEB` | same file |
| `VERCEL_PROJECT_ID_PROVIDER_CONSOLE` | `apps/provider-console/.vercel/project.json` |

> **The registry needs no secret.** The image is pushed to GitHub's own
> container registry using `GITHUB_TOKEN`, which Actions provides
> automatically. The server gets a short-lived pull token from the same
> source at deploy time, so no long-lived registry credential is ever
> stored on the box.

**The error you hit** — `Missing secrets: DEPLOY_HOST DEPLOY_USER
DEPLOY_SSH_KEY` — is exactly this table, not yet filled in. The workflow
checks first and stops with a clear message rather than failing
halfway. Note the image still built and pushed; only the deploy step is
unconfigured.

---

## 3. GitHub → Variables

**Same page → Variables tab**

| Variable | Value |
|---|---|
| `PLATFORM_DOMAIN` | `yourco.in` |
| `PROVIDER_API_URL` | `https://api.yourco.in` |

Variables, not secrets, on purpose: both get compiled into the browser
bundle and are readable by anyone who opens the site. Marking a public
value secret does not protect it — it just replaces it with `***` in your
CI logs when you are trying to debug a build.

---

## 4. The server — the real config

**`/srv/clinic/env/`, one file per service, `chmod 600`, never in git and
never in the image.**

This is where a clinic's `DATABASE_URL` and `JWT_SECRET` live, and the
only place. They are not in the repo, not in GitHub secrets, and not baked
into the image — an image is pushed to a registry, so a secret inside one
is a published secret.

### `/srv/clinic/env/provider.env` — write this by hand, once

```bash
NODE_ENV=production
PORT=4200
DATABASE_URL="postgresql://...@...neon.tech/neondb?sslmode=require"
JWT_SECRET="<openssl rand -base64 32>"
PLATFORM_DOMAIN=yourco.in
CORS_ORIGINS=https://console.yourco.in
NEON_API_KEY=<from Neon>
```

### `/srv/clinic/env/<slug>.env` — written for you

`add-clinic.sh` generates these. You never write one by hand:

```bash
NODE_ENV=production
PORT=4101                    # assigned automatically
DATABASE_URL="..."           # you paste it in when prompted
JWT_SECRET="..."             # generated fresh per clinic
CLINIC_PLAN=STANDARD
CORS_ORIGINS=https://acme.yourco.in,https://acme.portal.yourco.in
```

> **`JWT_SECRET` is generated per clinic and never shared.** A shared
> secret would mean a token minted at one clinic is valid at another —
> one login, every clinic's patient records. `add-clinic.sh` also refuses
> a `DATABASE_URL` another clinic already uses, because with no `clinicId`
> in the schema two clinics on one database would quietly show each
> other's patients.

### Why the deploy script reads these files

A schema change has to be applied to every clinic's database, and the
console cannot say which those are — it stores a Neon *project id*, never
a password. So `deploy-image.sh` discovers what to migrate by reading
`env/*.env`. That is a direct consequence of not warehousing connection
strings, and it is the right trade: a breach of the console is one API key
to rotate rather than every clinic's patient records.

---

## 5. Vercel — two public values

**vercel.com → each project → Settings → Environment Variables**

Only needed if you ever build on Vercel directly. The CI workflow passes
these at build time from GitHub Variables, so normally you can leave
Vercel's own settings empty.

| Variable | Value |
|---|---|
| `VITE_PLATFORM_DOMAIN` | `yourco.in` |
| `VITE_PROVIDER_API_URL` | `https://api.yourco.in` |

Note what is **not** here: no clinic API URL. `clinic-web` resolves that
at runtime from its own hostname, which is what lets one build serve every
clinic.

---

## The whole thing in one picture

```
your laptop            GitHub                 ghcr.io            droplet
───────────            ──────                 ───────            ───────
git push ──────────▶   CI
                       ├─ builds image ────▶  image:sha
                       │   (no secrets in it)     │
                       └─ ssh ─────────────────── │ ─────────▶ pull
                          using Secrets           │            │
                                                  ▼            ▼
                                            same image    + env/*.env
                                                               │
                                            ┌──────────────────┴────────┐
                                            ▼          ▼               ▼
                                      provider-api  clinic-acme   clinic-bright
                                                    own DB         own DB
                                                    own secret     own secret
```

One artifact. Config supplied at the last moment, per container, from
files that exist only on your server.

---

## Checklist

- [ ] Nothing in git — already true
- [ ] 8 GitHub **Secrets** — fixes the error you hit
- [ ] 2 GitHub **Variables**
- [ ] `/srv/clinic/env/provider.env` — by hand, once
- [ ] `/srv/clinic/env/<slug>.env` — `add-clinic.sh` writes each one

Only the middle three are manual, and all three are one-time.
