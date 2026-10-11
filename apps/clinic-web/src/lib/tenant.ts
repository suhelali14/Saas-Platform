/**
 * Which clinic this page load belongs to.
 *
 * One static bundle is served on a wildcard, for every clinic at once:
 *
 *   acme.yourco.in         -> Acme's patient website
 *   acme.portal.yourco.in  -> Acme's staff portal
 *   bright.yourco.in       -> a different clinic, a different database
 *
 * Each clinic keeps its OWN database and its OWN API deployment, so the
 * bundle cannot know which API to call until it knows which clinic it is.
 * It reads its own hostname, then asks the platform's tenant directory
 * where that clinic's API lives.
 *
 * Why the hostname and not a build-time variable: `VITE_API_URL` is
 * inlined by Vite at build time, so a bundle baked with one clinic's API
 * can only ever serve that clinic. Resolving at runtime is what makes one
 * deployment able to serve all of them -- which is the entire point of
 * addressing clinics by subdomain.
 */

/** Hostnames that are the platform itself, never a clinic. */
const PLATFORM_LABELS = new Set([
  "www", "app", "api", "console", "admin", "portal", "dashboard",
  "status", "docs", "help", "support", "cdn", "assets", "static",
  "mail", "blog",
]);

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);

export type TenantLocation =
  /** A clinic subdomain under the platform domain. */
  | { kind: "tenant"; slug: string; mode: "public" | "portal" }
  /** A clinic on its own domain, from before subdomain addressing. The
   *  build-time VITE_API_URL is correct for these and is left alone. */
  | { kind: "legacy" }
  /** The platform's own hostname (marketing site, console, api...). */
  | { kind: "platform" }
  /** Development: both sites on routes, one configured clinic. */
  | { kind: "dev" };

/**
 * Parses a hostname into a tenant location. Pure, so it can be tested
 * against the hostnames that actually matter rather than inspected.
 *
 * `platformDomain` is the root every clinic hangs off ("yourco.in").
 * Passing it in rather than reading the environment keeps this testable
 * and keeps the one tricky rule in one place: a wildcard certificate
 * matches a single label, so the portal lives at a second level and has to
 * be recognised explicitly.
 */
export function resolveTenant(hostname: string, platformDomain: string): TenantLocation {
  const host = (hostname ?? "").toLowerCase().split(":")[0]!.replace(/\.$/, "");
  if (!host) return { kind: "dev" };

  if (LOCAL_HOSTS.has(host) || host.endsWith(".local") || host.endsWith(".localhost")) {
    return { kind: "dev" };
  }

  const root = (platformDomain ?? "").trim().toLowerCase().replace(/^\.+|\.+$/g, "");
  // Without a configured platform domain there are no subdomains to
  // resolve, so every host is a clinic on its own domain. This is also
  // what keeps existing single-clinic deployments working untouched.
  if (!root || !root.includes(".")) return { kind: "legacy" };

  // The bare platform domain is the marketing site, not a clinic.
  if (host === root) return { kind: "platform" };

  // Anything not under the platform domain is a custom domain. Checked on
  // a label boundary: `evil-yourco.in` must not read as a subdomain of
  // `yourco.in`, and a bare `endsWith` would say it is.
  if (!host.endsWith(`.${root}`)) return { kind: "legacy" };

  const prefix = host.slice(0, -(root.length + 1));
  const labels = prefix.split(".");

  // <slug>.portal.<root> -- the staff portal.
  if (labels.length === 2 && labels[1] === "portal") {
    const slug = labels[0]!;
    if (!slug || PLATFORM_LABELS.has(slug)) return { kind: "platform" };
    return { kind: "tenant", slug, mode: "portal" };
  }

  // <slug>.<root> -- the patient website.
  if (labels.length === 1) {
    const slug = labels[0]!;
    if (!slug || PLATFORM_LABELS.has(slug)) return { kind: "platform" };
    return { kind: "tenant", slug, mode: "public" };
  }

  // Deeper than the wildcards cover. No certificate matches this, so a
  // browser could not have got here over TLS in the first place.
  return { kind: "platform" };
}

// ── Directory lookup ──────────────────────────────────────────────────

export type TenantConfig = {
  slug: string;
  name: string;
  status: string;
  suspended: boolean;
  apiBaseUrl: string | null;
  publicHost: string;
  portalHost: string;
};

const DIRECTORY_URL = import.meta.env.VITE_PROVIDER_API_URL ?? "";
const CACHE_PREFIX = "tenant-config:";
/** Treat a cached copy as fresh for five minutes. */
const FRESH_MS = 5 * 60 * 1000;

type Cached = { at: number; config: TenantConfig };

function readCache(slug: string): Cached | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + slug);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Cached;
    if (!parsed?.config?.slug) return null;
    return parsed;
  } catch {
    // Private browsing, cleared site data, or a quota error. A cache miss
    // is the correct outcome for all of them.
    return null;
  }
}

function writeCache(slug: string, config: TenantConfig): void {
  try {
    localStorage.setItem(CACHE_PREFIX + slug, JSON.stringify({ at: Date.now(), config }));
  } catch {
    // Not being able to cache is not a reason to fail the page load.
  }
}

/**
 * Looks up a clinic's configuration, preferring a fresh cached copy.
 *
 * The directory is a new dependency for every clinic's website, so the
 * failure mode matters more than the happy path. A stale cached copy is
 * served when the lookup fails, which turns "the platform directory is
 * down" into "returning visitors are unaffected" instead of "every clinic
 * is offline". The server sends `stale-while-revalidate` for the same
 * reason one layer out.
 */
export async function fetchTenantConfig(slug: string): Promise<TenantConfig> {
  const cached = readCache(slug);
  if (cached && Date.now() - cached.at < FRESH_MS) return cached.config;

  if (!DIRECTORY_URL) {
    throw new Error(
      "This deployment has no tenant directory configured (VITE_PROVIDER_API_URL).",
    );
  }

  try {
    const response = await fetch(`${DIRECTORY_URL}/api/provider/public/tenant/${encodeURIComponent(slug)}`, {
      headers: { Accept: "application/json" },
    });

    if (response.status === 404) {
      // An unknown slug is authoritative and worth remembering: it means
      // this hostname is not a clinic, not that the lookup failed. Serving
      // a stale copy here would resurrect a clinic that has been removed.
      try { localStorage.removeItem(CACHE_PREFIX + slug); } catch { /* ignore */ }
      throw new TenantNotFound(slug);
    }
    if (!response.ok) throw new Error(`Directory returned ${response.status}`);

    const config = (await response.json()) as TenantConfig;
    writeCache(slug, config);
    return config;
  } catch (error) {
    if (error instanceof TenantNotFound) throw error;
    if (cached) return cached.config;
    throw error;
  }
}

export class TenantNotFound extends Error {
  constructor(public slug: string) {
    super(`No clinic is registered at "${slug}".`);
    this.name = "TenantNotFound";
  }
}

/**
 * This page load's tenant location, computed once on first use.
 *
 * Lazy rather than a module-level constant so that importing this file has
 * no side effect and `resolveTenant` can be exercised directly against a
 * list of hostnames. A resolver that is only ever reachable through the
 * live `window.location` is a resolver nobody tests.
 */
let cachedLocation: TenantLocation | null = null;

export function currentTenant(): TenantLocation {
  if (!cachedLocation) {
    cachedLocation = resolveTenant(
      typeof window !== "undefined" ? window.location.hostname : "",
      PLATFORM_DOMAIN,
    );
  }
  return cachedLocation;
}

export const PLATFORM_DOMAIN: string = import.meta.env.VITE_PLATFORM_DOMAIN ?? "";
