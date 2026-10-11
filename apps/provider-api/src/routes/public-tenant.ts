import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";
import { publicHostFor, portalHostFor, validateSlug } from "../lib/subdomain.js";

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
