# GoDaddy VPS — complete setup

Everything from buying the server to a working deploy, in order. Follow it
top to bottom.

By the end you will have all four `DEPLOY_*` secrets, which currently hold
placeholders (`23`, `ss`, `ssss`, `sss`) — those will be replaced with
real values in §6.

Assumes your domain is `nayaverse.in` and already points at Vercel's
nameservers, which it does.

---

## 1. What to buy

**godaddy.com → Hosting → VPS Hosting**

| Choice | Pick | Why |
|---|---|---|
| Plan | the **smallest** | 1 vCPU / 2 GB is plenty for your first clinics |
| Management | **Self-Managed** | Managed tiers cost more and give you *less* control. You need root. |
| Control panel | **None** | Do NOT add cPanel or Plesk. They cost extra, and they fight with Docker and nginx over ports 80/443. |
| Operating system | **Ubuntu 24.04 LTS** | What the scripts target. 22.04 also works. |
| Billing term | **Monthly** | So you can leave for DigitalOcean once your card works. |
| Payment | **UPI** | The reason you are here. |

> **Self-Managed with no control panel is the correct product.** GoDaddy's
> own support statement for it covers provisioning and DNS only — you
> patch the OS and install your own software. That is exactly what the
> bootstrap script does, and it enables automatic security updates so the
> patching is not left to memory.

Expect roughly ₹650–900/month depending on the plan and any promotion.
Confirm the **renewal** price, not just the first term.

---

## 2. Set the server up in GoDaddy's wizard

After paying, GoDaddy puts the server in a "setting up" state and asks for:

- [ ] **Hostname** — `clinic-server` is fine
- [ ] **Operating system** — Ubuntu 24.04
- [ ] **Control panel** — **None**
- [ ] **Root password** — set a strong one and save it somewhere. GoDaddy
      issues a password rather than taking your SSH key, unlike
      DigitalOcean.
- [ ] Optionally paste your SSH key if the wizard offers it — if it does,
      §3 gets shorter.

Provisioning takes 10–20 minutes. When it finishes, from
**My Products → Servers → Manage**, copy:

- [ ] the **IP address** — this is your `DEPLOY_HOST`
- [ ] the **root password**, if you have not already

---

## 3. Get in, and install your key

> **GoDaddy does not give you `root` over SSH.** Its newer VPS tiers
> create a **named user with sudo** and disable direct root login, so
> `ssh root@...` returns "Permission denied" even with the correct
> password. Find your username at **Servers → Manage → Access → Login
> credentials** — it is usually derived from your account name.

```powershell
ssh <your-username>@<your-ip>
```

Enter the password you set. At the fingerprint prompt, type **`yes`** —
nothing else. That prompt is not masked, so anything you type there is
left in your terminal history; if you accidentally type your password,
change it.

Everything below that needs root gets `sudo` in front, or run `sudo -i`
once to become root for the rest of the session.

> If this hangs, check GoDaddy's firewall for the server in their panel
> and make sure **22, 80 and 443** are allowed inbound. Some plans ship
> with a restrictive default.

Your public key is already at `~/.ssh/id_ed25519.pub` on your laptop. Get
it onto the server. **On your laptop**, in a second terminal:

```powershell
type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh <your-username>@<your-ip> "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
```

Now prove key login works **before** turning passwords off:

```powershell
ssh <your-username>@<your-ip> whoami
```

It must print your username **without asking for a password**. Only once it does:

```bash
sed -i 's/^#\?PasswordAuthentication .*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart ssh
```

> Do not skip the proof step. Disabling passwords while the key is not
> working locks you out of your own server, and the only way back is
> GoDaddy's recovery console.

---

## 4. Run the bootstrap

Still on the server as root.

**If your GitHub repo is public:**

```bash
curl -fsSL https://raw.githubusercontent.com/suhelali14/Saas-Platform/master/deploy/bootstrap-server.sh \
  | bash -s -- https://github.com/suhelali14/Saas-Platform.git
```

**If it is private** — that URL returns a 404 without auth, so clone with
a token first:

```bash
apt-get update -qq && apt-get install -y -qq git
git clone https://<github-username>:<token>@github.com/suhelali14/Saas-Platform.git /srv/clinic/repo
bash /srv/clinic/repo/deploy/bootstrap-server.sh https://github.com/suhelali14/Saas-Platform.git
```

Create the token at **github.com → Settings → Developer settings →
Personal access tokens → Fine-grained**, repository access limited to
`Saas-Platform`, permission **Contents: Read**. Delete it afterwards.

The bootstrap installs Docker, Node 22, nginx and certbot; creates the
`deploy` user with sudo limited to service restarts; adds a swapfile;
installs the nightly backup job; and closes the firewall to 22/80/443.

- [ ] It ends with **"Server ready."**
- [ ] **Copy the `DEPLOY_HOST_KEY` block it prints at the end.**

---

## 5. Create the CI deploy key

A **second** key, separate from your personal one, so a leak from CI
rotates independently.

**On your laptop:**

```powershell
ssh-keygen -t ed25519 -f $env:USERPROFILE\.ssh\clinic-deploy -N '""' -C "github-actions"
```

`-N '""'` means no passphrase — required, because GitHub Actions cannot
type one.

Install its public half for the `deploy` user:

```powershell
type $env:USERPROFILE\.ssh\clinic-deploy.pub | ssh <your-username>@<your-ip> "sudo mkdir -p /home/deploy/.ssh && sudo tee -a /home/deploy/.ssh/authorized_keys > /dev/null && sudo chown -R deploy:deploy /home/deploy/.ssh && sudo chmod 700 /home/deploy/.ssh && sudo chmod 600 /home/deploy/.ssh/authorized_keys"
```

Note `sudo tee -a` rather than `cat >>`: the redirection in `cat >>` is
performed by *your* shell, which is not root, so it fails on a file in
another user's home. `tee` runs under sudo and does the writing itself.

Test it:

```powershell
ssh -i $env:USERPROFILE\.ssh\clinic-deploy deploy@<your-ip> whoami
```

Must print `deploy`.

---

## 6. The four GitHub secrets

**github.com/suhelali14/Saas-Platform → Settings → Secrets and variables
→ Actions**

Click each existing placeholder and **Update secret**.

### `DEPLOY_HOST`
Your server's IP from §2. Replaces `23`.

### `DEPLOY_USER`
```
deploy
```
Exactly that. Replaces `ss`.

### `DEPLOY_SSH_KEY`
```powershell
type $env:USERPROFILE\.ssh\clinic-deploy | Set-Clipboard
```
Paste. **The whole file**, including `-----BEGIN OPENSSH PRIVATE KEY-----`
and the `-----END` line. Replaces `ssss`.

> The file **without** `.pub`. Pasting the `.pub` half here is the common
> mistake — the workflow now detects it and says so, but it is easier to
> get right the first time.

### `DEPLOY_HOST_KEY`
Either the block the bootstrap printed, or regenerate it on your laptop:
```powershell
ssh-keyscan -H <your-ip> | Set-Clipboard
```
Paste all of it. Replaces `sss`.

### Then the two Variables

**Variables tab** → New repository variable:

| Name | Value |
|---|---|
| `PLATFORM_DOMAIN` | `nayaverse.in` |
| `PROVIDER_API_URL` | `https://api.nayaverse.in` |

---

## 7. Point DNS at the server

**Vercel → Domains → nayaverse.in → DNS Records** — not GoDaddy, since
your nameservers are Vercel's now.

| Type | Name | Value |
|---|---|---|
| `A` | `api` | your GoDaddy VPS IP |
| `A` | `*.api` | your GoDaddy VPS IP |

Verify before continuing:

```powershell
nslookup api.nayaverse.in 8.8.8.8
nslookup acme.api.nayaverse.in 8.8.8.8
```

Both must return **your VPS IP**. If either returns `216.198.*` or
`64.29.*`, that is Vercel answering — the record is missing or still
propagating.

---

## 8. Configure and deploy

On the server:

```bash
sudo -u deploy nano /srv/clinic/env/provider.env
```

```bash
NODE_ENV=production
PORT=4200
DATABASE_URL="<your provider-console Neon connection string>"
JWT_SECRET="<paste the output of: openssl rand -base64 32>"
PLATFORM_DOMAIN=nayaverse.in
CORS_ORIGINS=https://console.nayaverse.in
NEON_API_KEY=<your Neon API key>
```

Save with `Ctrl+O`, `Enter`, `Ctrl+X`.

Then push to trigger the first real deploy:

```powershell
git commit --allow-empty -m "First deploy to GoDaddy VPS"
git push origin master
```

Watch **GitHub → Actions**. CI runs, the image builds and pushes to
GHCR, then the deploy SSHes in and starts `provider-api`.

Then TLS and your console login:

```bash
sudo certbot --nginx -d api.nayaverse.in

sudo /srv/clinic/repo/deploy/seed-provider.sh you@example.com "Your Name"
```

It prompts for the password rather than taking it as an argument, so it
does not land in your shell history or in the process list. Use at least
12 characters — this account can create and destroy clinic
infrastructure.

- [ ] `curl https://api.nayaverse.in/health` returns `{"status":"ok",...}`
- [ ] `https://console.nayaverse.in` loads and you can log in

---

## 9. Add your first clinic

```bash
sudo /srv/clinic/repo/deploy/add-clinic.sh acme --plan STANDARD
```

It asks for the clinic's own Neon connection string, the clinic name, the
doctor's printed name and login email, then prints a generated password
**once**.

Then `sudo certbot --nginx -d acme.api.nayaverse.in`, and in the console:
**Onboard a clinic** → subdomain `acme` → set `apiDomain` to
`acme.api.nayaverse.in` → status **LIVE**.

---

## 10. What is different from DigitalOcean

| | DigitalOcean | GoDaddy |
|---|---|---|
| SSH access | key at creation | **root password**, key installed by you (§3) |
| Firewall | open by default | **check their panel** for 22/80/443 |
| Resizing | one click | may need a support request or a plan change |
| Snapshots | included, reliable | included, but **"not guaranteed"** by their own terms |
| OS patching | yours | yours |

### The snapshot warning matters

GoDaddy's VPS terms state they do not guarantee having a disaster-recovery
backup of your server. So the nightly backup the bootstrap installs is not
belt-and-braces here, it is your actual backup:

```bash
sudo -u deploy /usr/local/bin/clinic-backup
ls -la /srv/clinic/backups/*/
```

**Copy them off the server.** They currently sit on the same disk they
protect, which does not survive losing the server:

```bash
# Cloudflare R2: 10 GB free, no egress charge
rclone sync /srv/clinic/backups r2:clinic-backups
```

---

## 11. Moving to DigitalOcean later

Once your card works, this is an afternoon, not a migration:

1. Create the droplet, run the bootstrap on it
2. Copy two directories across:
   ```bash
   rsync -av -e ssh root@OLD_IP:/srv/clinic/env/  /srv/clinic/env/
   rsync -av -e ssh root@OLD_IP:/srv/clinic/data/ /srv/clinic/data/
   chown -R 1000:1000 /srv/clinic/data
   ```
3. Push to deploy — it pulls the image and starts every clinic
4. Re-run `certbot` for each hostname
5. Update the `api` and `*.api` A records in Vercel
6. Update `DEPLOY_HOST` and `DEPLOY_HOST_KEY` in GitHub

The databases live on Neon and do not move. The images live in the
registry. Only `env/` and `data/` actually travel — which is why they are
kept apart from the code.
