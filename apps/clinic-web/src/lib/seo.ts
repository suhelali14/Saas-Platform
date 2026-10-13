/**
 * What a search engine, a browser tab and a shared link see.
 *
 * Every clinic's public website was served from one index.html titled
 * "Clinic Portal", with no description, no share card and no structured
 * data. For a practice whose patients find it by searching a
 * neighbourhood name, that is the difference between being found and
 * not — and when a patient forwards the link on WhatsApp, which is how
 * clinics here actually spread, it arrived as a bare URL.
 *
 * ── What this covers, and what it does not ───────────────────────────
 *
 * These tags are written into the document at runtime, from the clinic's
 * own payload. That is enough for the browser tab, for a bookmark, and
 * for Google, which executes JavaScript before indexing.
 *
 * It is NOT enough for a social unfurler. WhatsApp, Facebook, LinkedIn
 * and Slack fetch the HTML and read it without running any script, so
 * they still see the served index.html. Fixing that needs the markup in
 * the response itself — a prerender step or an edge function keyed on the
 * hostname — which is deployment work, not application work. Said plainly
 * rather than left to be discovered: this improves search, and a shared
 * link still needs that step.
 *
 * ── Only what the page shows ─────────────────────────────────────────
 *
 * Google's policy prohibits marking up content a page does not display,
 * so every field below is emitted only when the section that renders it
 * is actually present. A clinic that has not entered its address gets no
 * `address` in the markup rather than an empty one.
 *
 * Deliberately not claimed: `MedicalClinic` has no rich result of its
 * own. What it feeds is local and knowledge-panel eligibility, and that
 * is never guaranteed. Sources:
 * https://www.halcy.ai/learn/healthcare-structured-data-guide,
 * https://medslots.com/blog/medical-clinic-schema-markup-guide
 */

export type Timing = { day: string; opensAt?: string; closesAt?: string; closed?: boolean };

export type SeoClinic = {
  name: string;
  tagline?: string | null;
  about?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  services?: string[] | null;
  timings?: Timing[] | null;
  logoUrl?: string | null;
  imageUrl?: string | null;
  /** The clinic's own meta description, when it has written one. */
  metaDescription?: string | null;
  doctorNames?: string[];
};

/** schema.org wants the two-letter form: Monday -> Mo. */
const DAY_CODES: Record<string, string> = {
  monday: 'Mo', tuesday: 'Tu', wednesday: 'We', thursday: 'Th',
  friday: 'Fr', saturday: 'Sa', sunday: 'Su',
};

/**
 * A description, in the order of how much thought went into it.
 *
 * The clinic's own wording first, then its tagline, then the opening of
 * its About text, then a plain factual sentence built from what it has
 * entered. Never a generic string: "Welcome to our clinic" in a search
 * result is worse than the fragment Google would have picked itself.
 */
export function describeClinic(clinic: SeoClinic): string {
  const own = clinic.metaDescription?.trim();
  if (own) return truncate(own, 160);

  const tagline = clinic.tagline?.trim();
  if (tagline) {
    const place = clinic.address?.split(',').slice(-2).join(',').trim();
    return truncate(place ? `${tagline} — ${clinic.name}, ${place}.` : `${tagline} — ${clinic.name}.`, 160);
  }

  const about = clinic.about?.trim();
  if (about) return truncate(about.replace(/\s+/g, ' '), 160);

  const parts = [clinic.name];
  if (clinic.services?.length) parts.push(clinic.services.slice(0, 3).join(', '));
  if (clinic.address) parts.push(clinic.address.split(',').slice(-2).join(',').trim());
  return truncate(parts.filter(Boolean).join('. ') + '.', 160);
}

/** Cut at a word boundary — a description ending mid-word reads as broken. */
function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return (space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[,.;:\s]+$/, '') + '…';
}

/**
 * The structured description of the clinic, for search engines.
 *
 * `MedicalClinic` because it inherits from both LocalBusiness and
 * MedicalBusiness, which is what makes a practice eligible for local
 * treatment. A single-practitioner page would be better served by
 * `Physician`; this is the multi-doctor shape, and the clinic model here
 * supports several.
 */
export function clinicJsonLd(clinic: SeoClinic, pageUrl: string): Record<string, unknown> {
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'MedicalClinic',
    name: clinic.name,
    url: pageUrl,
  };

  const description = describeClinic(clinic);
  if (description) data.description = description;
  if (clinic.logoUrl) data.logo = clinic.logoUrl;
  if (clinic.imageUrl) data.image = clinic.imageUrl;
  if (clinic.phone) data.telephone = clinic.phone;
  if (clinic.email) data.email = clinic.email;

  // Unparsed on purpose. Splitting a free-text Indian address into
  // street/locality/postcode guesses wrongly often enough to be worse
  // than one accurate line, and `streetAddress` accepts the whole thing.
  if (clinic.address) {
    data.address = { '@type': 'PostalAddress', streetAddress: clinic.address, addressCountry: 'IN' };
  }

  const open = (clinic.timings ?? []).filter((t) => !t.closed && t.opensAt && t.closesAt);
  if (open.length) {
    data.openingHoursSpecification = open.map((t) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: DAY_CODES[t.day.toLowerCase()] ?? t.day,
      opens: t.opensAt,
      closes: t.closesAt,
    }));
  }

  if (clinic.services?.length) {
    data.availableService = clinic.services.map((s) => ({ '@type': 'MedicalProcedure', name: s }));
  }

  if (clinic.doctorNames?.length) {
    data.employee = clinic.doctorNames.map((name) => ({ '@type': 'Physician', name }));
  }

  return data;
}

/** Writes or replaces one meta tag, keyed the way that tag is addressed. */
function setMeta(attr: 'name' | 'property', key: string, content: string | null): void {
  const selector = `meta[${attr}="${key}"]`;
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!content) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = content;
}

function setLink(rel: string, href: string | null): void {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!href) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement('link');
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
}

export type PageSeo = {
  title: string;
  description: string;
  imageUrl?: string | null;
  /** Omitted for a page that should not be indexed on its own. */
  canonical?: string | null;
  jsonLd?: Record<string, unknown> | null;
  /** "website" for the clinic's front page, "article" for a post. */
  type?: 'website' | 'article';
};

const JSON_LD_ID = 'clinic-structured-data';

/**
 * Applies a page's metadata to the document.
 *
 * Returns nothing and is safe to call on every render: each tag is
 * replaced rather than appended, so a navigation between the clinic page
 * and a blog post cannot leave two descriptions behind — which is the
 * usual way a client-side SEO helper ends up serving the wrong one.
 */
export function applySeo(seo: PageSeo): void {
  if (typeof document === 'undefined') return;

  document.title = seo.title;
  setMeta('name', 'description', seo.description);

  // Open Graph, which is what a share card is built from.
  setMeta('property', 'og:title', seo.title);
  setMeta('property', 'og:description', seo.description);
  setMeta('property', 'og:type', seo.type ?? 'website');
  setMeta('property', 'og:image', seo.imageUrl ?? null);
  setMeta('property', 'og:url', seo.canonical ?? null);
  setMeta('property', 'og:site_name', seo.title);

  // Twitter reads its own, and falls back to a bare link without them.
  setMeta('name', 'twitter:card', seo.imageUrl ? 'summary_large_image' : 'summary');
  setMeta('name', 'twitter:title', seo.title);
  setMeta('name', 'twitter:description', seo.description);
  setMeta('name', 'twitter:image', seo.imageUrl ?? null);

  setLink('canonical', seo.canonical ?? null);

  // One structured-data block, replaced wholesale. Two would make the
  // clinic look like two businesses at the same address.
  const existing = document.getElementById(JSON_LD_ID);
  if (!seo.jsonLd) {
    existing?.remove();
    return;
  }
  const script = (existing as HTMLScriptElement | null) ?? document.createElement('script');
  script.id = JSON_LD_ID;
  (script as HTMLScriptElement).type = 'application/ld+json';
  script.textContent = JSON.stringify(seo.jsonLd);
  if (!existing) document.head.appendChild(script);
}
