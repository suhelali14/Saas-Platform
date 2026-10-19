/**
 * Which of the two sites this page load is.
 *
 * One clinic deployment serves two audiences from ONE build:
 *
 *   dr-asif-clinic.in            -> the public patient website
 *   dashboard.dr-asif-clinic.in  -> the staff portal
 *
 * Both hostnames point at the same static bundle. Nothing is duplicated:
 * no second build, no second host, no reverse-proxy rewrite rules. The app
 * reads `window.location.hostname` at boot and mounts the matching router
 * tree, so the public site lives at `/` on its domain and the portal lives
 * at `/` on its own.
 *
 * Why decide in the client rather than at the edge: a static SPA host
 * (Netlify/Vercel/S3+CloudFront/nginx) can already serve one bundle on
 * many hostnames with zero configuration, but making it serve *different*
 * routes per hostname means per-host rewrite rules -- which differ on every
 * platform and are the thing most likely to be misconfigured when onboarding
 * clinic #2. Reading the hostname needs no platform support at all.
 *
 * Deliberate consequence: the portal is NOT hidden by this. It is not a
 * security boundary and is not treated as one -- every protected route
 * still requires a token and the API enforces RBAC regardless of which
 * hostname asked. Splitting by hostname is about giving patients a clean
 * address, not about concealing the login.
 */

import { currentTenant } from './tenant';

export type SiteMode = 'public' | 'portal' | 'both';

/**
 * Subdomains that mean "this is the staff portal". A clinic can override
 * the list entirely with VITE_PORTAL_HOSTS; these are the conventional
 * defaults so a deployment usually needs no configuration at all.
 */
const DEFAULT_PORTAL_PREFIXES = ['dashboard', 'portal', 'admin', 'staff', 'clinic-admin'];

/** Hosts where both sites coexist on routes, as during development. */
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];

function envList(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Resolution order, most explicit first:
 *
 * 1. `VITE_SITE_MODE` -- forces one mode. For a deployment that genuinely
 *    wants two separate builds, or for previewing either site locally.
 * 2. `VITE_PORTAL_HOSTS` / `VITE_PUBLIC_HOSTS` -- exact hostnames, for a
 *    clinic whose portal lives somewhere unconventional
 *    (e.g. `staff.asifclinic.co.in`, or a bare second domain).
 * 3. Conventional subdomain prefix (`dashboard.`, `portal.`, `admin.`…).
 * 4. Localhost -> 'both', so dev keeps working exactly as it does now.
 * 5. Anything else -> 'public'. A patient typing the clinic's domain is the
 *    common case, and it is the safer default: a stranger who guesses a
 *    hostname lands on the marketing site, not the login.
 */
export function resolveSiteMode(hostname?: string): SiteMode {
  const forced = (import.meta.env.VITE_SITE_MODE ?? '').trim().toLowerCase();
  if (forced === 'public' || forced === 'portal' || forced === 'both') return forced;

  // Platform subdomain addressing, when configured, is authoritative:
  // `acme.yourco.in` is Acme's patient site and `acme.portal.yourco.in` is
  // Acme's portal. The prefix rules below predate it and still serve every
  // clinic running on its own domain.
  const tenant = currentTenant();
  if (tenant.kind === 'tenant') return tenant.mode;
  if (tenant.kind === 'platform') return 'public';

  const host = (hostname ?? (typeof window !== 'undefined' ? window.location.hostname : '')).toLowerCase();
  if (!host) return 'both';

  // Strip a port if one somehow reaches us, and a trailing dot (a fully
  // qualified "example.com." is legal and does reach servers).
  const clean = host.split(':')[0]!.replace(/\.$/, '');

  if (envList(import.meta.env.VITE_PORTAL_HOSTS).includes(clean)) return 'portal';
  if (envList(import.meta.env.VITE_PUBLIC_HOSTS).includes(clean)) return 'public';

  const firstLabel = clean.split('.')[0] ?? '';
  if (DEFAULT_PORTAL_PREFIXES.includes(firstLabel)) return 'portal';

  if (LOCAL_HOSTS.includes(clean) || clean.endsWith('.local') || clean.endsWith('.localhost')) return 'both';

  return 'public';
}

let resolved: SiteMode | null = null;

/**
 * This page load's site mode.
 *
 * Read through a function rather than a module-level constant because a
 * clinic on its own domain is resolved by the tenant directory, which
 * answers over the network. A constant is evaluated when this module is
 * first imported -- before any lookup can have finished -- so a custom
 * portal domain would have been decided by the prefix rules below and
 * then never corrected.
 */
export function siteMode(): SiteMode {
  if (!resolved) resolved = resolveSiteMode();
  return resolved;
}

/**
 * Records what the directory said a custom domain is.
 *
 * Only the directory knows: drasif.in and portal.drasif.in are both just
 * hostnames to this bundle, and the conventional prefixes below are a
 * guess that a clinic is free not to follow. Called by TenantGate before
 * children mount, so nothing has read the resolved value yet.
 */
export function setSiteMode(mode: SiteMode): void {
  resolved = mode;
}

/**
 * Absolute URL to the other site, for the cross-links between them
 * ("Staff login" on the public footer, "View public site" in the portal).
 *
 * In `both` mode these stay same-origin paths, so development and any
 * single-domain deployment keep working. Once the sites are split they have
 * to be absolute, because `/clinic` does not exist on the portal's domain
 * and `/queue` does not exist on the patient's.
 */
export function publicSiteUrl(path = '/'): string {
  if (siteMode() !== 'portal') return path === '/' ? '/clinic' : path;
  const configured = import.meta.env.VITE_PUBLIC_SITE_URL;
  if (configured) return joinUrl(configured, path);
  // Fall back to dropping the portal subdomain: dashboard.x.in -> x.in.
  return joinUrl(siblingOrigin(true), path);
}

/**
 * The hostname a patient and a search engine see.
 *
 * The search-appearance preview used `window.location.host`, which inside
 * the portal is the PORTAL's hostname -- so a clinic on a split
 * deployment was shown `vadgaonkar.portal.nayaverse.in` as the address
 * Google would list, when the indexed site is `vadgaonkar.nayaverse.in`.
 * The one thing that preview exists to show was the one thing it had
 * wrong.
 *
 * On a single-domain deployment the two share a host, so the current one
 * is the right answer; on a split one the public URL is absolute and
 * carries the host to use.
 */
export function publicSiteHost(): string {
  const url = publicSiteUrl('/');
  // A relative path means the patient site is served from this origin.
  if (url.startsWith('/')) return window.location.host;
  try {
    return new URL(url, window.location.origin).host;
  } catch {
    return window.location.host;
  }
}

export function portalSiteUrl(path = '/'): string {
  if (siteMode() !== 'public') return path;
  const configured = import.meta.env.VITE_PORTAL_SITE_URL;
  if (configured) return joinUrl(configured, path);
  // x.in -> dashboard.x.in
  return joinUrl(siblingOrigin(false), path);
}

/**
 * Derives the other site's origin by adding or removing the portal
 * subdomain. A convenience only -- a deployment whose two domains are
 * unrelated sets VITE_PUBLIC_SITE_URL / VITE_PORTAL_SITE_URL instead, and
 * those always win.
 */
function siblingOrigin(stripPortalPrefix: boolean): string {
  if (typeof window === 'undefined') return '';
  const { protocol, host } = window.location;
  const [hostname, port] = [host.split(':')[0]!, host.split(':')[1]];

  const labels = hostname.split('.');
  let nextHostname: string;

  // Under platform subdomain addressing the two hosts differ by one
  // middle label, not by a leading one:
  //   acme.yourco.in  <->  acme.portal.yourco.in
  const tenant = currentTenant();
  if (tenant.kind === 'tenant') {
    const rest = labels.slice(tenant.mode === 'portal' ? 2 : 1).join('.');
    nextHostname = stripPortalPrefix
      ? `${tenant.slug}.${rest}`
      : `${tenant.slug}.portal.${rest}`;
  } else if (stripPortalPrefix) {
    nextHostname = DEFAULT_PORTAL_PREFIXES.includes(labels[0] ?? '') ? labels.slice(1).join('.') : hostname;
  } else {
    nextHostname = `dashboard.${hostname}`;
  }

  return `${protocol}//${nextHostname}${port ? `:${port}` : ''}`;
}

function joinUrl(origin: string, path: string): string {
  const base = origin.replace(/\/+$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return suffix === '/' ? base || '/' : `${base}${suffix}`;
}

/** True when the two sites are on separate hostnames, so cross-links must
 * leave the current origin. */
export function sitesAreSplit(): boolean {
  return siteMode() !== 'both';
}
