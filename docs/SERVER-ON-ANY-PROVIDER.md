# Setting up the server on any provider

The deploy scripts do not care who hosts the machine. They need **one
Ubuntu 24.04 box with root SSH access**, and nothing else. So switching
provider costs you about fifteen minutes, not a rewrite.

This page covers what the box must have, how to create one on each
provider that works from India, and the setup steps — which are identical
everywhere.

---

## 1. Try this first: it is probably your card, not DigitalOcean

Most Indian debit cards **block international transactions by default**,
and many credit cards block "card not present" international payments
until you switch them on. DigitalOcean bills from the US, so a card that
works fine at Indian merchants is declined there.

Before paying more elsewhere, spend two minutes on:

- **Your bank's app** → Cards → Manage / Set limits → enable
  **International** and **Online / E-commerce** transactions. On most
  apps this takes effect immediately and can be switched off again
  afterwards.
- **A different card.** Credit cards clear international payments far
  more often than debit cards. RuPay cards generally do not work
  internationally at all.
- **DigitalOcean also accepts PayPal.** A PayPal account funded by an
  Indian card sometimes succeeds where the card alone is declined,
  because PayPal processes it differently.

This is worth the attempt because DigitalOcean at **$4/month (~₹350)** is
cheaper than every Indian provider below, and it has a Bangalore region.

If none of that works, carry on.

---

## 2. Providers that work from India

> Prices below come from vendor and comparison blogs, not from the
> providers' own pages, and several disagreed with each other. **Check the
> live price before paying.** Intro rates in this market routinely double
> on renewal, which matters more than the headline.

| Provider | Rough price | Pays with | India region | Notes |
|---|---|---|---|---|
| **DigitalOcean** | **$4** (~₹350) | intl. card, PayPal | Bangalore | Cheapest, best docs. Try §1 first. |
| **GoDaddy VPS** | ~₹649/mo | **UPI, Indian cards, net banking** | yes | **Your payment already works here.** |
| **Hostinger VPS** | ~₹599 intro, **~₹999 renewal** | **UPI, Paytm, net banking** | Mumbai (shared; VPS unconfirmed) | Verify the renewal price. |
| **E2E Networks** | ~₹700+ | **UPI, net banking, INR invoice** | Delhi, Mumbai | Indian company, NSE-listed. |
| Vultr / Linode | $5–6 | intl. card | Mumbai, Delhi, Bengaluru | Same card wall as DigitalOcean. |
| Hetzner | ~€4 | intl. card | **none** (Singapore nearest) | Same card wall, worse latency. |
| Oracle Always Free | **free** | intl. card for ID check | varies | Still needs a card. ARM. |

### The pragmatic choice

**GoDaddy VPS**, if §1 fails. Not because it is the best — it is not —
but because **you have already completed a payment there**, which is the
only thing currently blocking you. At ~₹649/month against a clinic paying
₹2,000–5,000/month, the difference from $4 is not worth another week of
failed checkouts.

Buy it **monthly, not for a year**. You can move to DigitalOcean in an
afternoon once the card is sorted, and these scripts make that a
re-bootstrap rather than a migration.

---

## 3. What the box must have

Any provider is fine if you can get all of these:

- [ ] **Ubuntu 24.04 LTS**, 64-bit (22.04 also works)
- [ ] **Root SSH access**, by key or by password
- [ ] **A public IPv4 address**
- [ ] **≥512 MB RAM** (1 GB is more comfortable; the bootstrap adds swap)
- [ ] **≥10 GB disk**
- [ ] **Ports 22, 80 and 443 reachable** from the internet
- [ ] **Full root**, i.e. a real VPS/KVM — **not** shared or cPanel hosting

> **Shared hosting will not work**, however cheap. You need to install
> Docker and run your own processes. If the product page talks about
> cPanel, "unlimited websites" or one-click WordPress and never mentions
> root or SSH, it is the wrong product. Look for **VPS**, **KVM** or
> **Cloud Server**.

---

## 4. Creating the box

### GoDaddy VPS

1. godaddy.com → **Hosting** → **VPS Hosting**
2. Smallest plan, **Self-Managed** (not Managed — you want root)
3. Billing term: **monthly**
4. Pay with **UPI**
5. In setup: Operating System **Ubuntu 24.04**, no control panel
6. From the dashboard, copy the **IP address** and the **root password**
   (GoDaddy issues a password rather than taking your key)

Because it gives you a password rather than a key, install your key
yourself on first login:

```powershell
ssh root@<ip>                  # enter the password GoDaddy gave you
```

Then, on the server:

```bash
mkdir -p ~/.ssh && chmod 700 ~/.ssh
echo '<paste your id_ed25519.pub here>' >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

Confirm key login works from a second terminal **before** disabling
password login:

```bash
sed -i 's/^#\?PasswordAuthentication .*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart ssh
```

### Hostinger VPS

1. hostinger.in → **VPS Hosting** → **KVM 1**
2. **Monthly** billing, pay with UPI
3. OS: **Ubuntu 24.04** (plain, not a template with a panel)
4. Paste your public key during setup if offered; otherwise as above
5. Copy the IP from the VPS dashboard

### E2E Networks

1. myaccount.e2enetworks.com → sign up (Indian KYC, PAN)
2. **Compute** → **Create Node** → Ubuntu 24.04 → smallest plan
3. Add your SSH key during creation
4. Copy the public IP

### DigitalOcean

Covered in [SETUP-WALKTHROUGH.md](SETUP-WALKTHROUGH.md) step 4.

---

## 5. From here, everything is identical

Nothing below depends on the provider.

```powershell
ssh root@<your-ip>
```

Then on the server:

```bash
curl -fsSL https://raw.githubusercontent.com/suhelali14/Saas-Platform/master/deploy/bootstrap-server.sh \
  | bash -s -- https://github.com/suhelali14/Saas-Platform.git
```

If the repository is **private**, that URL needs auth. Clone it with a
token first, then run the script from disk:

```bash
git clone https://<your-github-username>:<token>@github.com/suhelali14/Saas-Platform.git /srv/clinic/repo
sudo bash /srv/clinic/repo/deploy/bootstrap-server.sh https://github.com/suhelali14/Saas-Platform.git
```

Create the token at github.com → Settings → Developer settings →
Personal access tokens → Fine-grained, with **Contents: read** on that one
repository.

The bootstrap installs Docker, Node, nginx and certbot, creates the
`deploy` user, adds a swapfile, sets up nightly backups and closes the
firewall to 22/80/443. It prints your `DEPLOY_HOST_KEY` at the end.

Then continue from [SETUP-WALKTHROUGH.md](SETUP-WALKTHROUGH.md) step 7:

1. Add the CI deploy key
2. Write `/srv/clinic/env/provider.env`
3. First deploy
4. `certbot --nginx -d api.yourdomain.in`
5. Add the four `DEPLOY_*` secrets to GitHub

### The one provider-specific thing

In **Vercel → Domains → your domain → DNS Records**, the `api` and
`*.api` A records must point at **this box's IP**. If you change provider
later, those two records are the only DNS you have to update — the clinic
wildcards keep pointing at Vercel and nothing else moves.

---

## 6. If you switch provider later

1. Create the new box, run the bootstrap
2. Copy `/srv/clinic/env/` and `/srv/clinic/data/` across:
   ```bash
   rsync -av -e ssh root@OLD:/srv/clinic/env/  /srv/clinic/env/
   rsync -av -e ssh root@OLD:/srv/clinic/data/ /srv/clinic/data/
   chown -R 1000:1000 /srv/clinic/data
   ```
3. Deploy, which pulls the image and starts every clinic
4. Re-run `certbot` for each hostname
5. Update the `api` and `*.api` A records in Vercel
6. Update `DEPLOY_HOST` and `DEPLOY_HOST_KEY` in GitHub

The databases are on Neon and do not move. The images are in the
registry. What actually has to travel is two directories — which is the
whole reason the layout separates them from the code.
