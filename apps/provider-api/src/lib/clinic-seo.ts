/**
 * Everything a crawler or a share preview needs, for one clinic, in one
 * request.
 *
 * ── The problem this solves ──────────────────────────────────────────
 *
 * One static bundle serves every clinic, so the HTML on disk is the same
 * for all of them: one title, no description, no structured data. The
 * app fills those in once it boots, which is enough for Google — it runs
 * JavaScript — and no use at all to WhatsApp, Facebook, LinkedIn or
 * Slack, which read the served HTML and never execute anything. In this
 * market a forwarded WhatsApp link is how a clinic spreads, and it was
 * arriving as a bare URL.
 *
 * Fixing that means the markup has to be in the response. Whatever
 * produces that response -- an edge function today, a prerender step
 * later -- needs the clinic's identity, its copy and its article list,
 * keyed by hostname, fast enough to sit in front of a page load.
 *
 * ── Why it is aggregated here ────────────────────────────────────────
 *
 * The hostname resolves to a clinic in the provider's directory; the
 * content lives in that clinic's own database behind its own API. Asking
 * the edge to make both calls in sequence puts two round trips in front
 * of every page. Doing the join here means one call out, and the result
 * is identical for every visitor, so it caches hard.
 *
 * Nothing here is private. It is assembled entirely from what the clinic
 * has chosen to publish, through the same unauthenticated endpoint a
 * patient's browser uses -- so there is no path by which this could
 * expose something the public page does not already show.
 */

export type SeoPage = {
  /** Absolute URL. */
  loc: string;
  lastmod?: string;
  changefreq: "daily" | "weekly" | "monthly";
  priority: string;
};

export type ClinicSeo = {
  host: string;
  slug: string;
  name: string;
  title: string;
  description: string;
  imageUrl: string | null;
  canonical: string;
  locale: string;
  jsonLd: Record<string, unknown>[];
  pages: SeoPage[];
  /**
   * False when the clinic's own API could not be reached, so this
   * bundle was built from the directory alone.
   *
   * Reported rather than hidden because the caller has to decide how
   * long to cache it: a complete bundle is identical for every visitor
   * and caches for hours, and a degraded one must be retried in
   * seconds. Caching a thin bundle is how one slow cold start becomes
   * ten minutes of Googlebot seeing a clinic with no address.
   */
  complete: boolean;
  /** Articles, for the per-article head. */
  posts: { slug: string; title: string; excerpt: string | null; coverUrl: string | null; publishedAt: string | null; author: string | null }[];
};

type PublicPayload = {
  clinic: Record<string, unknown>;
  doctors: { name: string; qualifications?: string | null }[];
  posts: { slug: string; title: string; excerpt: string | null; coverImagePath: string | null; publishedAt: string | null; author?: { name: string } | null }[];
};

const DAY_CODES: Record<string, string> = {
  monday: "Mo", tuesday: "Tu", wednesday: "We", thursday: "Th",
  friday: "Fr", saturday: "Sa", sunday: "Su",
};

/** Cut at a word boundary. A description ending mid-word reads as broken. */
function truncate(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return (space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[,.;:\s]+$/, "") + "…";
}

/**
 * The description, in order of how much thought went into it.
 *
 * The clinic's own words first, then its tagline with the locality, then
 * the opening of its About text, then a plain sentence from what it has
 * entered. Never a generic string: "Welcome to our clinic" in a search
 * result is worse than the fragment Google would have picked itself.
 *
 * Deliberately the same ladder the browser uses, so a page's description
 * does not change depending on whether it was rendered here or there.
 */
function describe(clinic: Record<string, unknown>): string {
  const own = String(clinic.metaDescription ?? "").trim();
  if (own) return truncate(own);

  const name = String(clinic.name ?? "").trim();
  const tagline = String(clinic.tagline ?? "").trim();
  const address = String(clinic.address ?? "").trim();
  const place = address ? address.split(",").slice(-2).join(",").trim() : "";

  if (tagline) return truncate(place ? `${tagline} — ${name}, ${place}.` : `${tagline} — ${name}.`);

  const about = String(clinic.about ?? "").trim();
  if (about) return truncate(about);

  const services = Array.isArray(clinic.services) ? (clinic.services as string[]) : [];
  const parts = [name];
  if (services.length) parts.push(services.slice(0, 3).join(", "));
  if (place) parts.push(place);
  return truncate(parts.filter(Boolean).join(". ") + ".");
}

/**
 * The clinic as structured data.
 *
 * MedicalClinic, which inherits from LocalBusiness and MedicalBusiness
 * and is what makes a practice eligible for local treatment. Only fields
 * the page actually shows are emitted: Google's policy prohibits marking
 * up content a page does not display, and a clinic that has entered no
 * address should have none in its markup.
 */
function clinicJsonLd(
  clinic: Record<string, unknown>,
  doctors: { name: string; qualifications?: string | null }[],
  origin: string,
  assetBase: string,
): Record<string, unknown> {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "MedicalClinic",
    name: clinic.name,
    url: origin,
    description: describe(clinic),
  };

  if (clinic.logoPath) data.logo = `${assetBase}/public/${clinic.logoPath}`;
  if (clinic.heroImagePath) data.image = `${assetBase}/public/${clinic.heroImagePath}`;
  if (clinic.phone) data.telephone = clinic.phone;
  if (clinic.email) data.email = clinic.email;

  // Unparsed on purpose: splitting a free-text Indian address into
  // street, locality and postcode guesses wrongly often enough to be
  // worse than one accurate line, and streetAddress accepts the whole.
  if (clinic.address) {
    data.address = { "@type": "PostalAddress", streetAddress: clinic.address, addressCountry: "IN" };
  }

  const timings = Array.isArray(clinic.timings)
    ? (clinic.timings as { day: string; opensAt?: string; closesAt?: string; closed?: boolean }[])
    : [];
  const open = timings.filter((t) => !t.closed && t.opensAt && t.closesAt);
  if (open.length) {
    data.openingHoursSpecification = open.map((t) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: DAY_CODES[t.day?.toLowerCase()] ?? t.day,
      opens: t.opensAt,
      closes: t.closesAt,
    }));
  }

  const services = Array.isArray(clinic.services) ? (clinic.services as string[]) : [];
  if (services.length) {
    data.availableService = services.map((s) => ({ "@type": "MedicalProcedure", name: s }));
  }

  if (doctors.length) {
    data.employee = doctors.map((d) => ({
      "@type": "Physician",
      name: `Dr. ${d.name}`,
      ...(d.qualifications ? { description: d.qualifications } : {}),
    }));
  }

  // Deliberately absent: aggregateRating and review. Indian medical
  // advertising rules treat a practitioner republishing patient
  // testimonials as soliciting, and it is the doctor's registration at
  // risk. The clinic's own feedback is collected privately for exactly
  // that reason, so it must not leak into markup either.

  return data;
}

/**
 * Every page a crawler should know about, for the sitemap.
 *
 * Built from what exists rather than from a fixed list: a clinic with no
 * articles gets no /blog entry, because a sitemap pointing at an empty
 * page is a crawl budget spent on nothing.
 */
function pagesFor(origin: string, posts: PublicPayload["posts"]): SeoPage[] {
  const pages: SeoPage[] = [
    { loc: `${origin}/`, changefreq: "weekly", priority: "1.0" },
  ];

  if (posts.length) {
    const newest = posts
      .map((p) => p.publishedAt)
      .filter(Boolean)
      .sort()
      .reverse()[0];
    pages.push({
      loc: `${origin}/blog`,
      changefreq: "weekly",
      priority: "0.7",
      ...(newest ? { lastmod: String(newest).slice(0, 10) } : {}),
    });
    for (const post of posts) {
      pages.push({
        loc: `${origin}/blog/${encodeURIComponent(post.slug)}`,
        changefreq: "monthly",
        priority: "0.6",
        ...(post.publishedAt ? { lastmod: String(post.publishedAt).slice(0, 10) } : {}),
      });
    }
  }

  // The live queue is deliberately excluded. It is a display for people
  // already in the waiting room, its content changes by the minute, and
  // it is not a page anybody should arrive on from a search.

  return pages;
}

/**
 * Assembles one clinic's SEO bundle.
 *
 * `apiBaseUrl` is that clinic's own API, resolved from the hostname by
 * the directory. The fetch is the same unauthenticated endpoint a
 * patient's browser uses, so this can only ever see what the clinic has
 * published.
 */
export async function buildClinicSeo(opts: {
  host: string;
  slug: string;
  name: string;
  apiBaseUrl: string;
}): Promise<ClinicSeo> {
  const origin = `https://${opts.host}`;

  let payload: PublicPayload | null = null;
  try {
    const response = await fetch(`${opts.apiBaseUrl}/public/clinic`, {
      headers: { Accept: "application/json" },
      // Generous, because the common case for a quiet clinic is a cold
      // start: the free Neon tier suspends compute after five minutes
      // idle, and waking it plus running this page's queries took
      // longer than four seconds in testing -- which produced a
      // directory-only bundle for a clinic that had everything filled
      // in. A crawler will wait eight seconds; it will not come back to
      // check whether the address appeared later.
      signal: AbortSignal.timeout(8000),
    });
    if (response.ok) payload = (await response.json()) as PublicPayload;
  } catch {
    // Falls through to the directory-only bundle below.
  }

  const clinic = payload?.clinic ?? { name: opts.name };
  const doctors = payload?.doctors ?? [];
  const posts = payload?.posts ?? [];

  const name = String(clinic.name ?? opts.name);
  const tagline = String(clinic.tagline ?? "").trim();
  const description = describe(clinic);

  const image = clinic.heroImagePath
    ? `${opts.apiBaseUrl}/public/${clinic.heroImagePath}`
    : clinic.logoPath
      ? `${opts.apiBaseUrl}/public/${clinic.logoPath}`
      : null;

  const jsonLd: Record<string, unknown>[] = [
    clinicJsonLd(clinic, doctors, origin, opts.apiBaseUrl),
  ];

  // A site-level search action is cheap and is one of the few things
  // that genuinely changes how a result is presented. Only added when
  // there is something to search.
  if (posts.length) {
    jsonLd.push({
      "@context": "https://schema.org",
      "@type": "WebSite",
      name,
      url: origin,
    });
  }

  return {
    host: opts.host,
    slug: opts.slug,
    name,
    // Title pattern: the clinic, then what it is. A title that is only
    // the clinic's name wastes the single strongest ranking signal a
    // small practice has -- the words a patient actually searched.
    title: tagline ? `${name} — ${tagline}` : name,
    description,
    imageUrl: image,
    canonical: `${origin}/`,
    locale: String(clinic.defaultLocale ?? "en"),
    jsonLd,
    pages: pagesFor(origin, posts),
    complete: payload !== null,
    posts: posts.map((p) => ({
      slug: p.slug,
      title: p.title,
      excerpt: p.excerpt,
      coverUrl: p.coverImagePath ? `${opts.apiBaseUrl}/public/${p.coverImagePath}` : null,
      publishedAt: p.publishedAt,
      author: p.author?.name ?? null,
    })),
  };
}

/** The sitemap as XML. */
export function sitemapXml(seo: ClinicSeo): string {
  const entries = seo.pages
    .map((p) => {
      const parts = [`    <loc>${escapeXml(p.loc)}</loc>`];
      if (p.lastmod) parts.push(`    <lastmod>${p.lastmod}</lastmod>`);
      parts.push(`    <changefreq>${p.changefreq}</changefreq>`);
      parts.push(`    <priority>${p.priority}</priority>`);
      return `  <url>\n${parts.join("\n")}\n  </url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemap.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`
    // The namespace is sitemaps.org, with an s. Written out rather than
    // templated because a typo here invalidates the whole file and
    // Search Console reports it only as "could not read".
    .replace("http://www.sitemap.org", "https://www.sitemaps.org");
}

/**
 * robots.txt.
 *
 * Points at this clinic's own sitemap, which is the only reliable way a
 * crawler finds it, and keeps the staff portal out of the index. The
 * portal is not secret -- every route behind it needs a token and the
 * API enforces RBAC regardless -- but a clinic's login page has no
 * business in search results for the clinic's name.
 */
export function robotsTxt(seo: ClinicSeo): string {
  return [
    "User-agent: *",
    "Allow: /",
    // Not a security measure, and not treated as one.
    "Disallow: /login",
    "Disallow: /live-queue",
    "",
    `Sitemap: https://${seo.host}/sitemap.xml`,
    "",
  ].join("\n");
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
