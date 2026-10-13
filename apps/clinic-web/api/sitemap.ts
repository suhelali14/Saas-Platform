import type { VercelRequest, VercelResponse } from '@vercel/node';
import { hostOf, fetchSeo, escapeHtml } from './_seo.js';

/**
 * sitemap.xml, per clinic.
 *
 * Without one, a crawler finds a clinic's articles only by following
 * links from a page it has already found — which for a new site with no
 * inbound links means mostly not finding them at all. This is the
 * cheapest thing available that materially affects whether a clinic's
 * health articles get indexed.
 *
 * Built from what exists: a clinic with no articles gets no /blog entry,
 * because pointing a crawler at an empty page spends its budget on
 * nothing.
 */
export default async function handler(request: VercelRequest, response: VercelResponse) {
  const host = hostOf(request.headers as Record<string, string | string[] | undefined>);
  const seo = await fetchSeo(host);

  response.setHeader('Content-Type', 'application/xml; charset=utf-8');
  response.setHeader('Cache-Control', seo?.complete ? 'public, max-age=3600' : 'public, max-age=60');

  if (!seo) {
    response.status(404).send('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="https://www.sitemaps.org/schemas/sitemap/0.9"></urlset>\n');
    return;
  }

  const urls = seo.pages
    .map((page) => {
      const parts = [`    <loc>${escapeHtml(page.loc)}</loc>`];
      if (page.lastmod) parts.push(`    <lastmod>${page.lastmod}</lastmod>`);
      parts.push(`    <changefreq>${page.changefreq}</changefreq>`);
      parts.push(`    <priority>${page.priority}</priority>`);
      return `  <url>\n${parts.join('\n')}\n  </url>`;
    })
    .join('\n');

  response.status(200).send(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="https://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
  );
}
