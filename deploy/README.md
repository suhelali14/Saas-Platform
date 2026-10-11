# Automated deployment

Connect the repo once. After that, `git push` deploys everything.

```
git push origin master
      │
      ├─ CI ─────────── typecheck, 53 tests, Dockerfile check, builds,
      │                 secret scan   (everything below waits on this)
      │
      ├─ deploy-static ─ clinic-web      → Vercel  (one deploy, all clinics)
      │                  provider-console → Vercel
      │
      └─ deploy-api ──── build image → push to ghcr.io
                           └─ SSH → deploy-image.sh on your server
                                ├─ pull that exact image tag
                                ├─ migrate EVERY clinic's database (in the image)
                                ├─ docker compose up onto the new tag
                                └─ health-check, roll back to the previous tag
                                   if anything fails
```

The image is built **once** and that same artifact is what runs. Nothing
is compiled on the server, so there is no "passed CI, failed on the box"
class of failure, and a rollback means running a previous tag rather than
rebuilding old source.

Config is never in the image — see
[docs/WHERE-ENV-GOES.md](../docs/WHERE-ENV-GOES.md).

Nothing deploys unless CI is green, so a build that does not typecheck
never reaches a clinic.

---

> Not to be confused with the `docker-compose.yml` at the repo root —
> that is a local dev Postgres for the older SAAS app and has nothing to
> do with deployment. The deploy compose file is **generated on the
> server** at `/srv/clinic/compose.yml` and is not in git, because it
> changes every time you add a clinic.

## Part 1 — The server, once

On a fresh Ubuntu 24.04 box:

```bash
sudo bash deploy/bootstrap-server.sh https://github.com/<you>/<repo>.git
```

That installs Node 22, nginx, certbot and automatic security updates;
creates the `deploy` user with sudo scoped to **service restarts only**;
builds `/srv/clinic`; installs the systemd units; sets up nightly backups;
and closes the firewall to everything but 22, 80 and 443.

Then create the CI deploy key **on your machine**:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/clinic-deploy -N "" -C "github-actions"
ssh-copy-id -i ~/.ssh/clinic-deploy.pub deploy@<server-ip>
```

And write the provider API's config on the server:

```bash
sudo -u deploy nano /srv/clinic/env/provider.env
```

```bash
NODE_ENV=production
PORT=4200
DATABASE_URL="<a Neon project for the console itself>"
JWT_SECRET="<openssl rand -base64 32>"
PLATFORM_DOMAIN=yourco.in
CORS_ORIGINS=https://console.yourco.in
NEON_API_KEY=<from Neon>
```

> `PLATFORM_DOMAIN` must be set before you add any clinic —
> `add-clinic.sh` reads it from this file to build each clinic's
> hostnames.

Finally, point `api.yourco.in` at the server and give it TLS:

```bash
sudo certbot --nginx -d api.yourco.in
sudo systemctl enable --now provider-api
```

---

## Part 2 — GitHub, once

**Settings → Secrets and variables → Actions**

Secrets (encrypted):

| Secret | Value |
|---|---|
| `DEPLOY_HOST` | your server's IP |
| `DEPLOY_USER` | `deploy` |
| `DEPLOY_SSH_KEY` | contents of `~/.ssh/clinic-deploy` (the **private** half) |
| `DEPLOY_HOST_KEY` | `ssh-keyscan -H <server-ip>` output |
| `DEPLOY_PORT` | only if SSH is not on 22 |
| `VERCEL_TOKEN` | Vercel → Account Settings → Tokens |
| `VERCEL_ORG_ID` | from `.vercel/project.json` after one `vercel link` |
| `VERCEL_PROJECT_ID_CLINIC_WEB` | same file, in `apps/clinic-web` |
| `VERCEL_PROJECT_ID_PROVIDER_CONSOLE` | same file, in `apps/provider-console` |

Variables (plain — these end up in the browser bundle anyway, and marking
a public value secret only makes the CI logs unreadable):

| Variable | Value |
|---|---|
| `PLATFORM_DOMAIN` | `yourco.in` |
| `PROVIDER_API_URL` | `https://api.yourco.in` |

> **Set `DEPLOY_HOST_KEY`.** Without it the workflow accepts whatever
> answers on that IP, so a DNS or routing compromise would be handed your
> deploy key and a shell on the machine holding patient records. The
> workflow warns when it is missing but does not refuse, so it is easy to
> leave undone.

### Getting the Vercel project IDs

Once, locally, for each static app:

```bash
cd apps/clinic-web && npx vercel link       # creates .vercel/project.json
cat .vercel/project.json                    # -> orgId, projectId
```

In each Vercel project's settings, add the domains:

- `clinic-web` → `*.yourco.in` **and** `*.portal.yourco.in`
- `provider-console` → `console.yourco.in`

`.vercel/` is gitignored and should stay that way.

---

## Part 3 — First deploy

```bash
sudo -u deploy DEPLOY_REF=main /srv/clinic/repo/deploy/deploy.sh
```

Run it by hand once so you see the output. After this, pushing to `main`
does the same thing.

---

## Part 4 — Adding a clinic

The only per-clinic step, and the one you will run most:

```bash
sudo /srv/clinic/repo/deploy/add-clinic.sh acme --plan STANDARD
```

It validates the slug as a hostname (rejecting reserved names like `api`,
which would otherwise claim the platform's own address), picks a free
port, writes the env file with a **freshly generated** `JWT_SECRET`,
creates the data directory, migrates, seeds, configures nginx, requests a
certificate, starts the service and health-checks it.

It asks you for the Neon connection string rather than creating the
database itself, and **refuses a connection string already used by
another clinic**. That is the one mistake here that fails silently: there
is no `clinicId` anywhere in the schema, so two clinics pointed at one
database would quietly show each other's patients.

It prints the doctor's generated password **once**. Write it down.

Last step, in your console: create the account with that slug, set
`apiDomain` to the printed API hostname, set status **LIVE**. Until then
the patient URLs resolve to "no clinic at this address" — deliberately,
so a half-finished setup is never publicly visible.

---

## Day to day

| Task | Command |
|---|---|
| Deploy | `git push origin master` |
| Deploy an existing tag | Actions → Deploy APIs → Run workflow → paste the tag |
| What image is live | `cat /srv/clinic/.image` |
| Roll back the image | `IMAGE_TAG=$(cat /srv/clinic/.image.previous) /srv/clinic/repo/deploy/deploy-image.sh` |
| Container logs | `docker logs -f clinic-acme` |
| What is running | `docker compose -f /srv/clinic/compose.yml ps` |
| Deploy a specific ref | Actions → Deploy APIs → Run workflow |
| See releases | `deploy/rollback.sh --list` |
| Roll back | `deploy/rollback.sh` |
| Roll back to one | `deploy/rollback.sh 20261011-184500` |
| Logs for a clinic | `journalctl -u clinic-api@acme -f` |
| Restart one clinic | `sudo systemctl restart clinic-api@acme` |
| Backup now | `sudo -u deploy /usr/local/bin/clinic-backup` |
| What is running | `systemctl list-units 'clinic-api@*'` |

---

## How it is laid out on the server

```
/srv/clinic/
  repo/                  the git clone deploys are built from
  releases/
    20261011-184500/     one build, immutable
    20261011-190200/
  current -> releases/20261011-190200
  env/
    provider.env         0600, deploy-owned
    acme.env             ← the ONLY copy of this clinic's DATABASE_URL
  data/
    acme/uploads/        ← patient scans. Survives every deploy.
  backups/
    acme/*.dump, *.tar.gz
```

Two decisions worth understanding, because they are load-bearing:

**Uploads live under `data/`, not in a release.** Each clinic's process
runs with `data/<slug>` as its working directory, and the app resolves
uploads against the working directory. Put them in a release and every
deploy would silently orphan that clinic's X-rays. Code comes from the
`current` symlink, so deploys swap the binary without touching the data.

**Connection strings live only in `env/`.** The provider console stores a
Neon *project id*, never a password — so a breach of the console is one
API key to rotate rather than every clinic's patient records. That is
also why `deploy.sh` discovers which databases to migrate by reading these
files: the console genuinely cannot tell it.

---

## What this does not do

- **Migrations are not reversed on rollback.** `rollback.sh` restores
  code, not schema. Additive migrations (new column, new table) are safe
  to roll back past; a dropped or renamed column needs a restore from
  `backups/`. Take a manual backup before that kind of change and do it
  out of hours.
- **A migration runs against every clinic at once.** Ten clinics means ten
  databases migrated in sequence, and the deploy aborts on the first
  failure before restarting anything — so a bad migration leaves everyone
  on the old release rather than breaking clinic 7 of 10.
- **There is a brief window during migration** where the old code is live
  against the new schema. Additive changes are fine; anything else wants a
  maintenance window.
- **Backups sit on the same disk** they protect. That covers a bad
  migration or a mistaken delete, not losing the server. Copy them off:
  `rclone sync /srv/clinic/backups remote:clinic-backups`. R2 is free for
  10 GB with no egress charge.
- **No staged rollout.** A deploy goes to every clinic simultaneously.
  With a handful of clinics that is the right trade; past ~20, deploy one
  clinic first and watch it.
