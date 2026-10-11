# Runtime topology

Where the requests go, and what is actually running.

Short answers to the two questions this document exists for:

- **There is no load balancer.** Two things split that job: Vercel's edge
  network for the static sites, and **nginx** on your droplet for the
  APIs. Neither is a separate paid component.
- **There are no pods.** There is no Kubernetes. Each clinic's API is a
  **Docker container** on one droplet, managed by Docker Compose.

That is deliberate, not an omission. See §5 for when it stops being the
right answer.

---

## 1. One patient's request, start to finish

A patient opens `acme.nayaverse.in`:

```
  browser
    │
    │  DNS: acme.nayaverse.in  →  *.nayaverse.in  →  Vercel
    ▼
  Vercel edge (CDN, free)
    │  serves ONE static bundle — the same files for every clinic
    ▼
  bundle boots in the browser
    │  reads window.location.hostname → "acme"
    │
    │  GET https://api.nayaverse.in/api/provider/public/tenant/acme
    ▼
  nginx on the droplet  (server_name api.nayaverse.in)
    │  proxy_pass → 127.0.0.1:4200
    ▼
  provider-api container
    │  answers: { apiBaseUrl: "https://acme.api.nayaverse.in/api/clinic" }
    ▼
  bundle now knows which API is Acme's, and renders
    │
    │  GET https://acme.api.nayaverse.in/api/clinic/public/clinic
    ▼
  nginx  (server_name acme.api.nayaverse.in)
    │  proxy_pass → 127.0.0.1:4101
    ▼
  clinic-acme container  ──→  Acme's own Neon database
```

The routing decision that matters — *which clinic is this?* — is made in
the browser from the hostname, then confirmed by a directory lookup. No
load balancer is doing it, which is why none is needed.

---

## 2. What is physically running

### Vercel (free)

Two static projects. No servers, no scaling to think about, no cost.

| Project | Hostnames |
|---|---|
| `clinic-web` | `*.nayaverse.in`, `*.portal.nayaverse.in` |
| `provider-console` | `console.nayaverse.in` |

One `clinic-web` deployment serves **every** clinic. Adding clinic #50
deploys nothing.

### Your droplet ($6/month)

```
┌─ droplet, Bangalore, 1 GB RAM ───────────────────────────────┐
│                                                              │
│  nginx  :80 / :443          ← the only ports open            │
│    │  TLS (certbot), routes by Host header                   │
│    │                                                         │
│    ├─ api.nayaverse.in        → 127.0.0.1:4200               │
│    ├─ acme.api.nayaverse.in   → 127.0.0.1:4101               │
│    └─ bright.api.nayaverse.in → 127.0.0.1:4102               │
│                                                              │
│  Docker containers, all from ONE image:                      │
│    provider-api   :4200   env/provider.env                   │
│    clinic-acme    :4101   env/acme.env    data/acme/uploads  │
│    clinic-bright  :4102   env/bright.env  data/bright/upl…   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
          │                    │                    │
          ▼                    ▼                    ▼
   console's Neon       Acme's Neon          Bright's Neon
   (separate DB)        (separate DB)        (separate DB)
```

**nginx is the load balancer**, in the only sense this system needs one:
it terminates TLS and routes by hostname. It is not balancing across
replicas, because there is one container per clinic — and that is the
point. Acme's traffic cannot touch Bright's container or Bright's
database.

---

## 3. The DNS that makes subdomains work

Four records, set once, for any number of clinics:

| Record | Points at | Matches |
|---|---|---|
| `nayaverse.in` | Vercel | the apex |
| `*.nayaverse.in` | Vercel | `acme`, `bright`, `console` … |
| `*.portal.nayaverse.in` | Vercel | `acme.portal`, `bright.portal` … |
| `api` + `*.api` | **droplet IP** | `api`, `acme.api`, `bright.api` … |

### Why a clinic's API is `acme.api.` and not `acme-api.`

Because **only a whole label can be wildcarded.** There is no such DNS
record as `*-api.nayaverse.in`, so a hostname shaped `acme-api` cannot be
pointed anywhere as a group — you would need one record per clinic, which
is the per-clinic DNS work subdomains exist to avoid. Shaped
`acme.api.nayaverse.in`, the whole family is covered by a single
`*.api.nayaverse.in` record.

That one dot is load-bearing, and the same rule is why the staff portal is
`acme.portal.nayaverse.in` with its own wildcard.

> **A measured caveat.** Strict wildcard matching (RFC 4592) says
> `*.nayaverse.in` should not match a two-label name, which would keep
> `acme.api.` away from Vercel automatically. Vercel's DNS does **not**
> behave that way: queried directly, `ns1.vercel-dns.com` answers for
> arbitrary depth — `a.b.c.nayaverse.in` resolves to a Vercel IP. So the
> separation does not come from label counting; it comes from
> `*.api.nayaverse.in` being a **more specific** record that takes
> precedence for names under `api.`.
>
> Practical consequence: after adding the `*.api` record, **verify it**
> rather than assuming:
>
> ```powershell
> nslookup acme.api.nayaverse.in 8.8.8.8
> ```
>
> It must return **your droplet's IP**. If it returns a Vercel address
> (`216.198.*` or `64.29.*`), the record is missing or not yet propagated,
> and every clinic API is pointed at the static host.

**Adding a clinic touches no DNS.** `*.nayaverse.in`,
`*.portal.nayaverse.in` and `*.api.nayaverse.in` already cover every
clinic that will ever exist.

---

## 4. GoDaddy Forwarding: leave it empty

Nothing goes on that page. Ever.

It exists to bounce a domain to another URL, which is the opposite of what
you need — subdomains must **serve** the app, not redirect somewhere. And
the warning on the page is the real hazard:

> *"We'll automatically update your domain to GoDaddy default nameservers
> if it's not currently using our nameservers."*

Saving anything there would pull DNS back to GoDaddy, undoing the Vercel
delegation and taking every clinic offline until it was changed back.

GoDaddy's only remaining job is renewing the domain. **All DNS lives in
Vercel.**

---

## 5. Why no Kubernetes, and when that changes

K8s solves problems this system does not have yet:

| K8s gives you | Your situation |
|---|---|
| Scheduling across many machines | One machine |
| Horizontal scaling of one service | One container per clinic, by design |
| Rolling deploys with health gates | `deploy-image.sh` does this, and rolls back |
| Service discovery | nginx and a hostname |
| Self-healing | `restart: unless-stopped` |

The cost is not just money. A managed control plane runs **$70+/month**
before any worker nodes — more than ten times your current total — and it
is a system that needs its own expertise when it breaks at 2am during a
clinic's OPD hours.

**Revisit at roughly these thresholds:**

| Signal | Do this |
|---|---|
| RAM pressure (~8 clinics on 1 GB) | Resize the droplet. One click. |
| ~40+ clinics | Second droplet, split clinics by nginx upstream |
| Downtime becomes unacceptable | Two droplets + a real load balancer ($12/mo on DO) |
| A dedicated ops person exists | *Then* consider K8s |

Until the third row, a bigger droplet is the answer, and it stays the
answer for a long time. The architecture does not block any of this: every
clinic is already an isolated container with an isolated database, which
is exactly the shape that moves to more machines cleanly.

---

## 6. What is genuinely missing

Being straight about it, since this is the page that describes the
runtime:

- **One droplet is a single point of failure.** If it dies, every clinic's
  API is down until it is rebuilt — the static sites stay up on Vercel,
  so patients still see the clinic's website, but nobody can log in. A
  rebuild from the image plus `env/` and `data/` backups is roughly an
  hour. Acceptable at this size, not forever.
- **No autoscaling.** A clinic with a sudden spike is capped by its
  container's 400 MB limit.
- **Backups are on the same disk** they protect. Copy them off.
- **No staged rollout.** A deploy reaches every clinic at once.
