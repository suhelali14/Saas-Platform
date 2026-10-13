import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";
import { publicHostFor, portalHostFor, validateSlug } from "../lib/subdomain.js";
import { buildClinicSeo } from "../lib/clinic-seo.js";

/**
 * The tenant directory: the one thing a browser needs before it can boot a
 * clinic's site.
 *
 * Each clinic keeps its own database and its own API deployment, so a
 * single static bundle served on `*.yourco.in` cannot know which API to
 * call until it knows which clinic it is. It reads its own subdomain and
 * asks here.
 *
 * This endpoint is UNAUTHENTICATED by necessity -- it runs before a
 * patient has any identity, on the public website. Two consequences are
 * designed for rather than hoped about:
 *
 * 1. It returns a hand-written allowlist of fields, never a row. The
 *    account record next to these fields holds the monthly fee, the
 *    contact's email, private notes and the Neon project id. A `select`
 *    that excluded them would be one careless edit away from leaking
 *    commercial terms to anybody who can type a URL, so the shape here is
 *    built field by field and the test asserts the absences.
 *
 * 2. It is cached aggressively, because every clinic's website now depends
 *    on it. `stale-while-revalidate` lets a CDN keep serving the last good
 *    answer for a day, so this service being down degrades to "clinic
 *    sites keep working" rather than "every clinic is offline at once".
 *    The browser keeps its own copy too -- see tenant.ts.
 */
export async function publicTenantRoutes(app: FastifyInstance) {
  app.get<{ Params: { slug: string } }>(
    "/api/provider/public/tenant/:slug",
    {
      // Tighter than the global limit. This is the only public, unauthenticated
      // endpoint that touches the database, which makes it both the cheapest
      // thing to hammer and the only way to enumerate customer slugs.
      config: { rateLimit: { max: 60, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      const slug = (request.params.slug ?? "").trim().toLowerCase();

      // Reject anything that is not a possible slug before querying, so a
      // scan of random strings costs no database time.
      if (!validateSlug(slug).ok) {
        return reply.status(404).send({ error: "Unknown clinic." });
      }

      const account = await prisma.clinicAccount.findUnique({
        where: { slug },
        // Explicit, and deliberately narrow -- see the note above.
        select: { slug: true, name: true, status: true, apiDomain: true, publicDomain: true, portalDomain: true },
      });

      // A clinic still being set up is not a website yet. 404 rather than
      // "ONBOARDING": which clinics are mid-deal is commercially sensitive,
      // and there is nothing for a visitor to see either way.
      if (!account || account.status === "LEAD" || account.status === "ONBOARDING" || account.status === "CHURNED") {
        reply.header("Cache-Control", "public, max-age=60");
        return reply.status(404).send({ error: "Unknown clinic." });
      }

      // Suspension is enforced HERE, which is what makes it a switch rather
      // than a note in a table. A suspended clinic resolves, so the site can
      // render an explanation instead of a broken page, but it is handed no
      // API base URL -- so the bundle has nowhere to send patient data even
      // if something downstream ignored the status.
      const suspended = account.status === "SUSPENDED";

      reply.header("Cache-Control", "public, max-age=300, stale-while-revalidate=86400");

      return {
        slug: account.slug,
        name: account.name,
        status: account.status,
        suspended,
        apiBaseUrl: suspended ? null : clinicApiBaseUrl(account.slug, account.apiDomain),
        publicHost: account.publicDomain ?? publicHostFor(account.slug, env.PLATFORM_DOMAIN),
        portalHost: account.portalDomain ?? portalHostFor(account.slug, env.PLATFORM_DOMAIN),
      };
    },
  );

  /**
   * Resolve a clinic from a custom domain.
   *
   * A platform subdomain carries its slug in the hostname, so the
   * browser can ask for it directly. A clinic on its own domain --
   * drasif.in -- carries nothing, so the lookup has to go the other
   * way: hostname first, slug second.
   *
   * Matched against both the public and the portal domain, because one
   * clinic may have separate names for the two and the bundle needs to
   * know which of the two sites it is before it renders either.
   */
  app.get<{ Params: { host: string } }>(
    "/api/provider/public/tenant-by-host/:host",
    { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    async (request, reply) => {
      // The same rules as the SEO endpoint, from one place. A second
      // copy would drift, and the way that drift shows is a clinic
      // resolving for one caller and not the other.
      const resolved = await resolveLiveHost(request.params.host);

      if (!resolved) {
        reply.header("Cache-Control", "public, max-age=60");
        return reply.status(404).send({ error: "Unknown clinic." });
      }

      reply.header("Cache-Control", "public, max-age=300, stale-while-revalidate=86400");

      return {
        slug: resolved.slug,
        name: resolved.name,
        status: resolved.status,
        suspended: resolved.suspended,
        apiBaseUrl: resolved.apiBaseUrl,
        // The clinic's own domain wins over the platform template, as
        // before. Extracting the lookup had quietly dropped this, which
        // would have told a clinic on its own domain that its address
        // was a platform subdomain.
        publicHost: resolved.publicDomain ?? publicHostFor(resolved.slug, env.PLATFORM_DOMAIN),
        portalHost: resolved.portalDomain ?? portalHostFor(resolved.slug, env.PLATFORM_DOMAIN),
        // Which of the two this hostname is, so the bundle does not have
        // to guess from a name it was not given.
        siteMode: resolved.isPortal ? "portal" : "public",
      };
    },
  );

  /**
   * Everything a crawler or a share preview needs, for one hostname.
   *
   * Exists because one static bundle serves every clinic, so the HTML on
   * disk carries one title and no description for all of them. The app
   * fills those in once it boots, which satisfies Google -- it executes
   * JavaScript -- and is no use at all to WhatsApp, Facebook, LinkedIn
   * or Slack, which read the served HTML and run nothing. A forwarded
   * WhatsApp link is how a clinic spreads here, and it was arriving as a
   * bare URL.
   *
   * Whatever puts the markup into the response -- an edge function now,
   * a prerender step later -- makes one call here and gets the title,
   * the description, the share image, the structured data and the
   * sitemap, already joined across the directory and the clinic's own
   * database.
   *
   * Cached hard, and `stale-while-revalidate` for a day: the answer is
   * identical for every visitor, and a crawler arriving while this
   * service is slow should get the last good copy rather than nothing.
   */
  app.get<{ Params: { host: string } }>(
    "/api/provider/public/seo/:host",
    { config: { rateLimit: { max: 120, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const resolved = await resolveLiveHost(request.params.host);

      // Nothing to index. 404 rather than an empty bundle, so a caller
      // can tell "no such clinic" from "a clinic with no content".
      if (!resolved || !resolved.apiBaseUrl) {
        reply.header("Cache-Control", "public, max-age=60");
        return reply.status(404).send({ error: "Unknown clinic." });
      }

      // The staff portal must never be indexed. It is not secret --
      // every route behind it needs a token -- but a clinic's login page
      // has no business ranking for the clinic's name.
      if (resolved.isPortal) {
        reply.header("Cache-Control", "public, max-age=300");
        return reply.status(404).send({ error: "Not a public site." });
      }

      const seo = await buildClinicSeo({
        host: resolved.host,
        slug: resolved.slug,
        name: resolved.name,
        apiBaseUrl: resolved.apiBaseUrl,
      });

      // A complete bundle is the same for every visitor and caches for
      // hours. A degraded one -- the clinic's API was waking up -- is
      // retried in seconds, because caching it would turn one slow cold
      // start into ten minutes of crawlers seeing a clinic with no
      // address, no hours and no services.
      reply.header(
        "Cache-Control",
        seo.complete
          ? "public, max-age=600, stale-while-revalidate=86400"
          : "public, max-age=15",
      );
      return seo;
    },
  );
}

/**
 * Resolves a hostname to a clinic that is actually live.
 *
 * Shared by the browser's tenant lookup and the SEO endpoint, because
 * both need exactly the same rules and a second copy would drift. The
 * way that drift would show is a clinic becoming crawlable before it is
 * live, which is the opposite of what the status check is for.
 *
 * Returns null for anything that is not a live clinic -- an unparseable
 * host, an unknown one, or one still being set up. Which clinics are
 * mid-deal is commercially sensitive, and there is nothing for a visitor
 * or a crawler to see either way.
 */
export async function resolveLiveHost(rawHost: string): Promise<{
  host: string;
  slug: string;
  name: string;
  status: string;
  suspended: boolean;
  apiBaseUrl: string | null;
  isPortal: boolean;
  /** The clinic's own domains, when it has them. The caller prefers
   *  these over the platform template -- a clinic on drasif.in should be
   *  told its address is drasif.in, not acme.yourco.in. */
  publicDomain: string | null;
  portalDomain: string | null;
} | null> {
  const host = (rawHost ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[:/].*$/, "")
    .replace(/\.$/, "");

  // Must look like a hostname before it reaches a query, so a scan of
  // random strings costs no database time.
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9-]+)+$/.test(host) || host.length > 253) {
    return null;
  }

  const account = await prisma.clinicAccount.findFirst({
    where: { OR: [{ publicDomain: host }, { portalDomain: host }] },
    select: {
      slug: true, name: true, status: true,
      apiDomain: true, publicDomain: true, portalDomain: true,
    },
  });

  if (!account) return null;
  if (account.status === "LEAD" || account.status === "ONBOARDING" || account.status === "CHURNED") {
    return null;
  }

  const suspended = account.status === "SUSPENDED";

  return {
    host,
    slug: account.slug,
    name: account.name,
    status: account.status,
    suspended,
    apiBaseUrl: suspended ? null : clinicApiBaseUrl(account.slug, account.apiDomain),
    isPortal: account.portalDomain === host,
    publicDomain: account.publicDomain,
    portalDomain: account.portalDomain,
  };
}

/**
 * Where this clinic's API lives.
 *
 * A per-account `apiDomain` always wins, so a clinic that predates
 * subdomain addressing (or that insisted on its own domain) keeps working
 * untouched. Otherwise the platform template fills in the slug.
 */
function clinicApiBaseUrl(slug: string, apiDomain: string | null): string | null {
  if (apiDomain) {
    const host = apiDomain.replace(/^https?:\/\//, "").replace(/\/+$/, "");
    return `https://${host}/api/clinic`;
  }
  if (env.CLINIC_API_URL_TEMPLATE) {
    return env.CLINIC_API_URL_TEMPLATE.replace(/\{slug\}/g, slug);
  }
  // No template and no per-account domain means nobody has told the
  // platform where clinic APIs live. Returning null is honest: the site
  // will say it is not configured, which is accurate and debuggable,
  // rather than silently calling the provider API's own origin.
  return null;
}
