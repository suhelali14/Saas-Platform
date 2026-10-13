/**
 * Shared bits for the SEO functions.
 *
 * ── Why these are serverless functions at all ────────────────────────
 *
 * One static bundle serves every clinic, so the HTML on disk carries one
 * title and no description for all of them. The app fills those in once
 * it boots, which satisfies Google because it executes JavaScript, and
 * is no use to WhatsApp, Facebook, LinkedIn or Slack, which read the
 * served HTML and run nothing. In this market a forwarded WhatsApp link
 * is how a clinic spreads, and it was arriving as a bare URL.
 *
 * robots.txt and sitemap.xml have the same problem for a different
 * reason: they have to differ per clinic, and a static file cannot.
 * Without a sitemap a crawler finds a clinic's articles only by
 * following links, which for a new site means mostly not finding them.
 *
 * ── Same HTML for everyone ───────────────────────────────────────────
 *
 * Deliberately NOT gated on a bot user-agent. Serving different markup
 * to crawlers than to people is cloaking, which is penalised, and it is
 * also the kind of thing that works until the day somebody checks. Every
 * visitor gets the same server-rendered head, and the app hydrates over
 * it exactly as before.
 */

import { PROVIDER_API as BUILT_IN_PROVIDER_API } from './_shell.js';

/**
 * Where the directory lives.
 *
 * Baked in at build time, because a Vercel function's environment comes
 * from the project's own settings rather than from the .env the build
 * reads. Depending on process.env alone would mean a manual dashboard
 * step whose absence silently downgrades every page to the generic
 * head — and silent is the worst kind of broken for something only a
 * crawler sees.
 *
 * An explicit environment variable still wins, so the override exists
 * without being required.
 */
const PROVIDER_API = (
  process.env.PROVIDER_API_URL ??
  process.env.VITE_PROVIDER_API_URL ??
  BUILT_IN_PROVIDER_API ??
  ''
).replace(/\/+$/, '');

export type SeoPage = {
  loc: string;
  lastmod?: string;
  changefreq: string;
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
  posts: {
    slug: string; title: string; excerpt: string | null;
    coverUrl: string | null; publishedAt: string | null; author: string | null;
  }[];
  complete: boolean;
};

/**
 * The hostname this request was made to.
 *
 * x-forwarded-host first, because that is what a proxy sets and what
 * actually carries the clinic's domain. The port is stripped: a crawler
 * will not send one, but a local check will.
 */
export function hostOf(headers: Record<string, string | string[] | undefined>): string {
  const raw = headers['x-forwarded-host'] ?? headers.host ?? '';
  const value = Array.isArray(raw) ? raw[0] ?? '' : raw;
  return value.split(':')[0]!.toLowerCase();
}

/**
 * This clinic's SEO bundle, or null when the hostname is not a live one.
 *
 * One call, because the directory joins the hostname to the clinic's own
 * database on its side. Two sequential round trips from here would sit
 * in front of every page load.
 */
export async function fetchSeo(host: string): Promise<ClinicSeo | null> {
  if (!PROVIDER_API || !host) return null;
  try {
    const response = await fetch(
      `${PROVIDER_API}/api/provider/public/seo/${encodeURIComponent(host)}`,
      {
        headers: { Accept: 'application/json' },
        // A page must not hang on the directory. Falling back to the
        // static shell gives a working site with a generic head, which
        // is what visitors had before any of this existed.
        signal: AbortSignal.timeout(9000),
      },
    );
    if (!response.ok) return null;
    return (await response.json()) as ClinicSeo;
  } catch {
    return null;
  }
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * JSON for a <script type="application/ld+json"> block.
 *
 * `</script>` inside a JSON string would end the block early and spill
 * the rest into the document, so the slash is escaped. This is the one
 * injection that matters here: the content is the clinic's own text, and
 * a clinic that names a `</script>` in its About section is unlikely but
 * the failure would be a broken page for every visitor.
 */
export function jsonLdScript(blocks: Record<string, unknown>[]): string {
  if (!blocks.length) return '';
  return blocks
    .map(
      (block) =>
        `<script type="application/ld+json">${JSON.stringify(block).replace(/</g, '\\u003c')}</script>`,
    )
    .join('\n    ');
}

/**
 * The <head> tags for one page.
 *
 * Open Graph and Twitter both, because they are read by different
 * unfurlers and a missing one means a bare link rather than a fallback.
 */
export function headTags(opts: {
  title: string;
  description: string;
  canonical: string;
  imageUrl?: string | null;
  locale?: string;
  type?: 'website' | 'article';
  siteName?: string;
  jsonLd?: Record<string, unknown>[];
  publishedAt?: string | null;
  author?: string | null;
}): string {
  const t = escapeHtml(opts.title);
  const d = escapeHtml(opts.description);
  const tags: string[] = [
    `<title>${t}</title>`,
    `<meta name="description" content="${d}" />`,
    `<link rel="canonical" href="${escapeHtml(opts.canonical)}" />`,
    `<meta property="og:title" content="${t}" />`,
    `<meta property="og:description" content="${d}" />`,
    `<meta property="og:type" content="${opts.type ?? 'website'}" />`,
    `<meta property="og:url" content="${escapeHtml(opts.canonical)}" />`,
  ];

  if (opts.siteName) tags.push(`<meta property="og:site_name" content="${escapeHtml(opts.siteName)}" />`);
  if (opts.locale) tags.push(`<meta property="og:locale" content="${escapeHtml(opts.locale)}" />`);

  if (opts.imageUrl) {
    tags.push(`<meta property="og:image" content="${escapeHtml(opts.imageUrl)}" />`);
    tags.push(`<meta name="twitter:card" content="summary_large_image" />`);
    tags.push(`<meta name="twitter:image" content="${escapeHtml(opts.imageUrl)}" />`);
  } else {
    // Without an image the large card renders as a grey rectangle, so
    // the small one is correct rather than a downgrade.
    tags.push(`<meta name="twitter:card" content="summary" />`);
  }

  tags.push(`<meta name="twitter:title" content="${t}" />`);
  tags.push(`<meta name="twitter:description" content="${d}" />`);

  if (opts.publishedAt) {
    tags.push(`<meta property="article:published_time" content="${escapeHtml(opts.publishedAt)}" />`);
  }
  if (opts.author) {
    tags.push(`<meta property="article:author" content="${escapeHtml(opts.author)}" />`);
  }

  const ld = jsonLdScript(opts.jsonLd ?? []);
  if (ld) tags.push(ld);

  return tags.join('\n    ');
}

/**
 * Puts the tags into the shell, replacing what is already there.
 *
 * The static shell carries its own <title>, and leaving it would mean
 * two titles in one document — which browsers tolerate and unfurlers
 * resolve unpredictably. So the existing title and description are
 * removed rather than appended to.
 */
export function injectHead(shell: string, tags: string): string {
  const stripped = shell
    .replace(/<title>[\s\S]*?<\/title>\s*/i, '')
    .replace(/<meta\s+name=["']description["'][^>]*>\s*/gi, '');

  return stripped.includes('</head>')
    ? stripped.replace('</head>', `    ${tags}\n  </head>`)
    : `${tags}\n${stripped}`;
}
