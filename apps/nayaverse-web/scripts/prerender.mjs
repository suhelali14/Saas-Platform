/**
 * Render every route, in every language, to real HTML at build time -- then
 * prove it worked.
 *
 * The proving half is the point. A prerender that silently produces an empty
 * <div id="root"> still deploys, still returns 200, and is invisible until
 * somebody notices the site has no search traffic months later. So this script
 * fails the build unless the written HTML actually contains the page's own
 * copy, in its own language.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const app = path.resolve(here, '..');
const dist = path.join(app, 'dist');
const ssr = path.join(app, 'dist-ssr', 'entry-server.js');

const die = (msg) => {
  console.error(`prerender: ${msg}`);
  process.exit(1);
};

if (!fs.existsSync(dist)) die(`no client build at ${dist} -- run vite build first`);
if (!fs.existsSync(ssr)) die(`no server build at ${ssr} -- run vite build --ssr first`);

const template = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
for (const marker of ['<!--app-html-->', '<!--app-head-->', 'lang="en-IN"']) {
  if (!template.includes(marker)) die(`index.html has no ${marker} -- nothing to inject into`);
}

const mod = await import(pathToFileURL(ssr).href);
const { render, allRoutes, pathFor, facts, statusWords, locales, content } = mod;

/**
 * Where a route's file goes: one flat file per route, never a directory
 * index.
 *
 * Vercel resolves `/x` by looking for `x.html`. It does not fall back to
 * `x/index.html`, so `/mr` served from `mr/index.html` is a 404 while
 * `/mr/pricing` served from `mr/pricing.html` is fine -- which is exactly the
 * split the first deployment showed. The root keeps the name `index.html`
 * because that is the one filename every static host agrees about.
 */
const fileFor = (locale, page) => {
  if (page === '404') return locale === 'en' ? '404.html' : `${locale}/404.html`;
  if (locale === 'en') return page === 'home' ? 'index.html' : `${page}.html`;
  return page === 'home' ? `${locale}.html` : `${locale}/${page}.html`;
};

const written = [];

for (const { locale, page } of allRoutes) {
  const { html, head, lang } = render(locale, page);
  const out = template
    .replace('lang="en-IN"', `lang="${lang}"`)
    .replace('<!--app-head-->', head)
    .replace('<!--app-html-->', html);
  const file = path.join(dist, fileFor(locale, page));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, out, 'utf8');
  written.push({ locale, page, file, bytes: Buffer.byteLength(out), html, out });
}

/* ---------------------------------------------------------------- checks ---
   Each has a specific failure in mind, not a general feeling that checking is
   good. */

const problems = [];

for (const { locale, page, file, html, out } of written) {
  const name = path.relative(dist, file).replace(/\\/g, '/');

  // The failure this whole script exists to prevent.
  const floor = page === '404' ? 1500 : 9000;
  if (html.length < floor) {
    problems.push(`${name}: rendered only ${html.length} bytes of markup (floor ${floor})`);
  }

  if (!/<title>[^<]+<\/title>/.test(out)) problems.push(`${name}: no title`);
  if (!out.includes('rel="canonical"')) problems.push(`${name}: no canonical link`);
  if (out.includes('<!--app-html-->')) problems.push(`${name}: marker left unreplaced`);
  if (page !== '404' && !out.includes('hreflang')) {
    problems.push(`${name}: no hreflang -- the three languages would compete with each other`);
  }

  // The page must actually be in its own language, not English with a prefix.
  const words = statusWords[locale];
  if (page === 'home' && !html.includes(words.live)) {
    problems.push(`${name}: the word for "Live" (${words.live}) is absent -- is this page translated?`);
  }
}

// The honesty checks. A status word silently dropped, or a row flipped to
// Live, is the one mistake on this site that actually matters.
for (const locale of locales) {
  const home = written.find((w) => w.locale === locale && w.page === 'home');
  if (!home) continue;
  const words = statusWords[locale];

  // Counted by class, not by the word. The same word appears in the band's
  // tally, and in Marathi "Waitlist" and a row's "Waiting" are one word --
  // `cell-wide` appears only on the service chart's status column, which is
  // the place that actually makes the claim.
  const cells = (cls) => home.html.split(`cell cell-wide ${cls}`).length - 1;

  for (const [label, cls, want] of [
    ['Live', 'cell-serving', facts.live],
    ['Building', 'cell-waiting', facts.building],
    ['Waitlist', 'cell-done', facts.waitlist],
  ]) {
    const got = cells(cls);
    if (got !== want) {
      problems.push(
        `${locale}/index.html: ${got} service rows marked ${label}, the content says ${want}` +
          (label === 'Live'
            ? ' -- one clinic is in production, and the page must not imply more'
            : ''),
      );
    }
  }

  // And the word has to be present at all, or the page is not translated.
  for (const w of [words.live, words.building, words.waitlist]) {
    if (!home.html.includes(w)) {
      problems.push(`${locale}/index.html: the status word "${w}" never renders`);
    }
  }

  // No percentage anywhere. There is one customer and no study, so a figure
  // here would have been invented by whoever added it.
  const pct = home.html.match(/>[^<]*\b\d{1,3}\s?%/g) ?? [];
  if (pct.length) {
    problems.push(
      `${locale}/index.html: found a percentage (${pct[0].trim().slice(0, 40)}) -- there is no measured result to cite`,
    );
  }
}

// The "not built yet" notice only renders for a tab the visitor selects, so it
// lives in the bundle rather than the prerendered HTML. It is the single most
// important sentence on the page, so it is checked where it actually is.
const bundles = fs
  .readdirSync(path.join(dist, 'assets'))
  .filter((f) => f.endsWith('.js'))
  .map((f) => fs.readFileSync(path.join(dist, 'assets', f), 'utf8'))
  .join('');
for (const locale of locales) {
  const notice = content?.[locale]?.chartSection?.notBuilt;
  if (notice && !bundles.includes(notice)) {
    problems.push(
      `bundle: ${locale} is missing "${notice}" -- a Building chart would read as shipped`,
    );
  }
}

if (problems.length) {
  console.error('prerender: the build produced HTML that is not shippable\n');
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

/* ------------------------------------------------------- robots + sitemap -- */

const origin = 'https://www.nayaverse.in';
const today = new Date().toISOString().slice(0, 10);
const indexable = allRoutes.filter((r) => r.page !== '404');

/*
 * vercel.json's rewrites are written from the same route list that produced
 * the files, so a new page cannot ship with a URL that resolves to nothing.
 * This is the failure the first deployment had: the files were all present
 * and correct, and two of the six were unreachable.
 */
const rewrites = allRoutes
  .filter((r) => r.page !== '404')
  .map(({ locale, page }) => ({
    source: pathFor(locale, page),
    destination: `/${fileFor(locale, page)}`,
  }));

const vercelConfig = {
  $schema: 'https://openapi.vercel.sh/vercel.json',
  trailingSlash: false,
  // Vercel's Git integration must not deploy this project; GitHub Actions
  // does, after CI passes. Two paths to one project means the one that skips
  // the tests can overwrite the one that ran them. Only effective once the
  // project's Root Directory is apps/nayaverse-web -- otherwise Vercel reads
  // the repo root and never sees this file.
  git: { deploymentEnabled: { master: false, main: false } },
  rewrites,
  headers: [
    {
      source: '/assets/(.*)',
      headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
    },
    {
      source: '/(.*).html',
      headers: [{ key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }],
    },
  ],
};

fs.writeFileSync(
  path.join(app, 'vercel.json'),
  JSON.stringify(vercelConfig, null, 2) + '\n',
  'utf8',
);

// Every rewrite must point at a file that exists, and every page must have a
// rewrite. Checked here rather than discovered by a visitor.
for (const r of rewrites) {
  const target = path.join(dist, r.destination.replace(/^\//, ''));
  if (!fs.existsSync(target)) {
    console.error(`prerender: rewrite ${r.source} points at ${r.destination}, which was not written`);
    process.exit(1);
  }
}

fs.writeFileSync(
  path.join(dist, 'robots.txt'),
  `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`,
  'utf8',
);

// Each URL lists its alternates, which is what tells a search engine these are
// translations of one page rather than three thin pages about the same thing.
const urls = indexable
  .map(({ locale, page }) => {
    const alts = locales
      .map(
        (l) =>
          `    <xhtml:link rel="alternate" hreflang="${l}-IN" href="${origin}${pathFor(l, page)}"/>`,
      )
      .join('\n');
    return `  <url>\n    <loc>${origin}${pathFor(locale, page)}</loc>\n${alts}\n    <lastmod>${today}</lastmod>\n  </url>`;
  })
  .join('\n');

fs.writeFileSync(
  path.join(dist, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`,
  'utf8',
);

for (const { locale, page, file, bytes, html } of written) {
  const name = path.relative(dist, file).replace(/\\/g, '/');
  console.log(
    `prerender: ${`${locale}/${page}`.padEnd(13)} -> ${name.padEnd(17)} ${String(bytes).padStart(7)} bytes  (${html.length} markup)`,
  );
}
console.log(`prerender: robots.txt and sitemap.xml written (${indexable.length} urls)`);
