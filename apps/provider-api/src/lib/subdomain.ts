/**
 * Subdomain rules for the platform.
 *
 * Every clinic is addressed by its slug under one platform domain:
 *
 *   acme.yourco.in         -> the clinic's public patient website
 *   acme.portal.yourco.in  -> that clinic's staff portal
 *
 * Why two wildcards rather than one: a DNS/TLS wildcard matches exactly
 * one label, so `*.yourco.in` covers `acme.yourco.in` but NOT
 * `acme.portal.yourco.in`. The portal therefore needs its own
 * `*.portal.yourco.in` record and certificate. Both are one-time setup --
 * clinic #2 and clinic #500 need no DNS work at all, which is the whole
 * point of addressing clinics this way instead of buying a domain each.
 */

/**
 * Subdomains that can never belong to a clinic.
 *
 * This is a safety rail, not a style guide. `api.yourco.in` is the
 * platform's own API; if a clinic were ever onboarded with the slug `api`
 * its patient website would claim that hostname and take the platform
 * down with it. The same reasoning covers `www`, `console` and the mail
 * records -- a slug is not just a database key here, it is a hostname.
 *
 * Erring long is free: a clinic told "that name is taken, try acme-clinic"
 * costs one retry, while discovering the collision in production costs an
 * outage.
 */
export const RESERVED_SLUGS = new Set([
  // Platform surfaces.
  "www", "app", "apps", "api", "console", "admin", "administrator",
  "portal", "dashboard", "staff", "provider", "vendor", "internal",
  // Auth and account flows, in case any ever get their own host.
  "auth", "login", "logout", "signup", "register", "account", "accounts",
  "billing", "invoice", "invoices", "pay", "payments",
  // Operational and informational.
  "status", "health", "docs", "doc", "help", "support", "blog", "news",
  "about", "contact", "legal", "privacy", "terms", "security",
  // Infrastructure and delivery.
  "cdn", "assets", "static", "media", "files", "uploads", "img", "images",
  "db", "database", "redis", "cache", "queue", "worker", "cron",
  // Mail and DNS, which break in confusing, delayed ways if shadowed.
  "mail", "email", "smtp", "imap", "pop", "mx", "webmail",
  "ns", "ns1", "ns2", "ns3", "ns4", "dns", "autodiscover", "autoconfig",
  // Environments -- a clinic named `staging` would be a lasting confusion.
  "dev", "development", "test", "testing", "stage", "staging", "preview",
  "demo", "sandbox", "local", "localhost", "example",
  // Generic terms likely to be wanted by the platform later.
  "clinic", "clinics", "doctor", "doctors", "patient", "patients",
  "book", "booking", "appointments", "queue", "live",
]);

/** Why a slug was refused, phrased for the person typing it. */
export type SlugProblem = { ok: false; reason: string } | { ok: true };

/**
 * Validates a slug as a hostname label, not merely as a string.
 *
 * The regex on the request schema already enforces the character set.
 * This adds the rules that only matter because the value becomes DNS:
 * length, leading/trailing hyphens (illegal in a hostname label), the
 * `xn--` punycode prefix, and the reserved list above.
 */
export function validateSlug(slug: string): SlugProblem {
  if (slug.length < 2) return { ok: false, reason: "Must be at least 2 characters." };
  // 63 is the hard limit on a single DNS label.
  if (slug.length > 63) return { ok: false, reason: "Must be 63 characters or fewer." };
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return { ok: false, reason: "Lowercase letters, numbers and hyphens only." };
  }
  if (slug.startsWith("-") || slug.endsWith("-")) {
    return { ok: false, reason: "Cannot start or end with a hyphen." };
  }
  // Reserved by IDNA for punycode; a label starting `xn--` is interpreted
  // as an encoded internationalised name and will not resolve as typed.
  if (slug.startsWith("xn--")) return { ok: false, reason: "Cannot start with \"xn--\"." };
  if (RESERVED_SLUGS.has(slug)) {
    return { ok: false, reason: `"${slug}" is reserved by the platform. Try something like "${slug}-clinic".` };
  }
  return { ok: true };
}

/** `acme` -> `acme.yourco.in` */
export function publicHostFor(slug: string, platformDomain: string): string {
  return `${slug}.${platformDomain}`;
}

/** `acme` -> `acme.portal.yourco.in` */
export function portalHostFor(slug: string, platformDomain: string): string {
  return `${slug}.portal.${platformDomain}`;
}

/**
 * True when `origin` is the platform domain or any subdomain of it.
 *
 * Matched on a label boundary, never as a substring. `yourco.in` must not
 * admit `evil-yourco.in` (a suffix match on the bare string would) nor
 * `yourco.in.evil.com` (a prefix match would), and both are exactly how a
 * hand-rolled origin check usually fails open. Parsing with URL also means
 * a port or a path on the Origin header cannot smuggle anything through.
 */
export function isPlatformSubdomain(origin: string, platformDomain: string): boolean {
  const root = platformDomain.trim().toLowerCase().replace(/^\.+|\.+$/g, "");
  // An unset or single-label domain (the "localhost" default) would make
  // the suffix test absurdly broad, so it admits nothing.
  if (!root || !root.includes(".")) return false;

  let host: string;
  try {
    const url = new URL(origin);
    // Only ever over TLS in production. An http:// origin claiming a
    // platform subdomain is either a misconfiguration or an attempt.
    if (url.protocol !== "https:") return false;
    host = url.hostname.toLowerCase().replace(/\.$/, "");
  } catch {
    return false;
  }

  return host === root || host.endsWith(`.${root}`);
}
