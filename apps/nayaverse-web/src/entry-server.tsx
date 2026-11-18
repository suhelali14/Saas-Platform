/**
 * Build-time render. Called once per route by scripts/prerender.mjs, which
 * writes the result into dist/.
 *
 * Why prerender at all: this page exists to be found by strangers, and an
 * empty <div id="root"> is not findable. It also means the copy is in the HTML
 * for anyone reading with the script blocked -- and with three languages, a
 * crawler has to be able to reach each one at its own URL.
 */
import { renderToString } from 'react-dom/server';
import { App } from './App';
import {
  allRoutes,
  content,
  htmlLang,
  locales,
  pathFor,
  type Locale,
  type Page,
} from './content/index';
import { serviceRows } from './content/structure';
import { chartDefs } from './content/structure';
import { site } from './content/contact';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Facts only. Every figure here is one the owner has stated.
 *
 * Returns an array of two entities: SoftwareApplication (what the product
 * is) and Organization (who makes it). The Organization block is what
 * Google uses for the Knowledge Panel on the right of a brand search --
 * the box with the logo, description and social links. Google treats a
 * JSON-LD array as independent entities, so one script block is enough.
 */
function jsonLd(locale: Locale) {
  const t = content[locale];
  const org = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: t.site.name,
    url: site.url,
    logo: `${site.url}/logo.png`,
    description: t.site.description,
    sameAs: [
      // Add social profiles here as they exist. Omitting the array is
      // also fine; Google uses what is there and ignores what is not.
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'sales',
      telephone: '+91 75584 36263',
      areaServed: 'IN',
      availableLanguage: ['en', 'hi', 'mr'],
    },
  };
  const app = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: t.site.name,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web browser',
    url: site.url,
    inLanguage: htmlLang[locale],
    description: t.site.description,
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'INR',
      lowPrice: '3000',
      highPrice: '50000',
      offerCount: String(t.fares.length),
      availability: 'https://schema.org/LimitedAvailability',
    },
  };
  return JSON.stringify([org, app]);
}

export function render(locale: Locale, page: Page) {
  const t = content[locale];
  const path = pathFor(locale, page);
  const title = page === 'pricing' ? `${t.farePanel.pageHeading} - ${t.site.name}`
    : page === '404' ? `${t.notFound.heading} - ${t.site.name}`
    : `${t.site.name} - ${t.site.tagline}`;
  const description = page === 'pricing' ? t.farePanel.pageLede : t.site.description;

  const html = renderToString(<App locale={locale} page={page} />);

  // Every language declares the others, so the three are one document in
  // three languages rather than three pages competing with each other.
  const alternates = page === '404' ? [] : locales.map(
    (l) =>
      `<link rel="alternate" hreflang="${htmlLang[l]}" href="${site.url}${pathFor(l, page)}" />`,
  );
  if (alternates.length) {
    alternates.push(
      `<link rel="alternate" hreflang="x-default" href="${site.url}${pathFor('en', page)}" />`,
    );
  }

  // Which build is answering. The deploy asserts the live page carries the
  // sha it just pushed, so a green deploy cannot mean "an older copy of the
  // site is still up and returning 200".
  const build = import.meta.env.VITE_BUILD_SHA || 'dev';

  // Preview card image. Expected at /og.png (1200x630) in public/. Until
  // that file lands, social cards fall back to no image rather than
  // breaking -- a missing image is a worse first impression than none.
  const ogImage = `${site.url}/og.png`;

  const head = [
    `<title>${esc(title)}</title>`,
    `<meta name="x-build" content="${esc(build)}" />`,
    `<meta name="description" content="${esc(description)}" />`,
    `<link rel="canonical" href="${site.url}${path}" />`,
    // Search engines learn the brand is one thing even if a competitor's
    // domain ranks for the misspelling. Ask explicitly.
    `<meta name="application-name" content="${esc(t.site.name)}" />`,
    `<meta name="apple-mobile-web-app-title" content="${esc(t.site.name)}" />`,
    ...alternates,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${esc(t.site.name)}" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    `<meta property="og:url" content="${site.url}${path}" />`,
    `<meta property="og:locale" content="${htmlLang[locale].replace('-', '_')}" />`,
    `<meta property="og:image" content="${ogImage}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${esc(t.site.name)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(title)}" />`,
    `<meta name="twitter:description" content="${esc(description)}" />`,
    `<meta name="twitter:image" content="${ogImage}" />`,
    page === '404' ? '<meta name="robots" content="noindex" />' : '',
    `<script type="application/ld+json">${jsonLd(locale)}</script>`,
  ]
    .filter(Boolean)
    .join('\n    ');

  return { html, head, lang: htmlLang[locale], path };
}

export { allRoutes, locales, pathFor, content };

/**
 * What each page is supposed to claim, counted from the content itself.
 *
 * scripts/prerender.mjs asserts the rendered HTML matches. The point is
 * narrow and worth the machinery: if an edit ever flips a row from Building to
 * Live, or drops a status word, the build fails instead of quietly shipping a
 * page that says twenty businesses are running when one is.
 */
const countServices = (s: string) => serviceRows.filter((r) => r.status === s).length;
const countCharts = (s: string) => chartDefs.filter((c) => c.status === s).length;

export const facts = {
  // The service chart's own status column, which is where the claim lives.
  live: countServices('LIVE'),
  building: countServices('BUILDING'),
  waitlist: countServices('WAITLIST'),
  // The day-chart tabs carry the same statuses and are checked separately.
  tabsLive: countCharts('LIVE'),
  tabsBuilding: countCharts('BUILDING'),
};

/** The status words, per locale, so the check works in every language. */
export const statusWords: Record<Locale, { live: string; building: string; waitlist: string }> =
  Object.fromEntries(
    locales.map((l) => [
      l,
      {
        live: content[l].readiness.LIVE,
        building: content[l].readiness.BUILDING,
        waitlist: content[l].readiness.WAITLIST,
      },
    ]),
  ) as Record<Locale, { live: string; building: string; waitlist: string }>;
