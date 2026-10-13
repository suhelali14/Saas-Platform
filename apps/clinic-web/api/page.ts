import type { VercelRequest, VercelResponse } from '@vercel/node';
import { hostOf, fetchSeo, headTags, injectHead } from './_seo.js';
import { SHELL } from './_shell.js';

/**
 * The app shell, with this clinic's head in it.
 *
 * This is the piece that makes a forwarded link show the clinic's name,
 * description and photo instead of a bare URL. WhatsApp, Facebook,
 * LinkedIn and Slack read the HTML and execute nothing, so the markup
 * has to be in the response -- the app filling it in after boot is
 * invisible to all of them.
 *
 * The same HTML goes to everyone. Serving different markup to crawlers
 * is cloaking, which is penalised and which also tends to work right up
 * until somebody checks.
 *
 * If the directory cannot be reached the static shell is returned
 * unchanged: a working site with a generic head, which is exactly what
 * every visitor had before any of this existed. A page that 500s because
 * its metadata was unavailable would be a far worse trade.
 */
export default async function handler(request: VercelRequest, response: VercelResponse) {
  const host = hostOf(request.headers as Record<string, string | string[] | undefined>);
  const path = (request.url ?? '/').split('?')[0]!;

  response.setHeader('Content-Type', 'text/html; charset=utf-8');

  const seo = await fetchSeo(host);
  if (!seo) {
    // No-store rather than a short max-age: the next request may well
    // resolve, and an un-headed shell is not worth keeping even briefly.
    response.setHeader('Cache-Control', 'no-store');
    response.status(200).send(SHELL);
    return;
  }

  // An article gets its own card. A health post is the one thing on a
  // clinic's site somebody actually forwards, so inheriting the clinic's
  // description would waste the share.
  const slug = path.startsWith('/blog/') ? decodeURIComponent(path.slice('/blog/'.length)) : null;
  const post = slug ? seo.posts.find((p) => p.slug === slug) : null;

  const tags = post
    ? headTags({
        title: `${post.title} — ${seo.name}`,
        description: post.excerpt?.trim() || seo.description,
        canonical: `https://${host}/blog/${encodeURIComponent(post.slug)}`,
        imageUrl: post.coverUrl ?? seo.imageUrl,
        locale: seo.locale,
        type: 'article',
        siteName: seo.name,
        publishedAt: post.publishedAt,
        author: post.author ? `Dr. ${post.author}` : null,
        jsonLd: [
          {
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: post.title,
            ...(post.excerpt ? { description: post.excerpt } : {}),
            ...(post.coverUrl ? { image: post.coverUrl } : {}),
            ...(post.publishedAt ? { datePublished: post.publishedAt } : {}),
            ...(post.author ? { author: { '@type': 'Person', name: `Dr. ${post.author}` } } : {}),
            publisher: { '@type': 'MedicalClinic', name: seo.name },
          },
        ],
      })
    : headTags({
        title: seo.title,
        description: seo.description,
        canonical: path === '/blog' ? `https://${host}/blog` : seo.canonical,
        imageUrl: seo.imageUrl,
        locale: seo.locale,
        type: 'website',
        siteName: seo.name,
        jsonLd: seo.jsonLd,
      });

  // A complete bundle is identical for every visitor and caches; a
  // degraded one is retried, so one slow cold start does not become an
  // hour of crawlers seeing a clinic with no address.
  response.setHeader(
    'Cache-Control',
    seo.complete
      ? 'public, max-age=300, s-maxage=600, stale-while-revalidate=86400'
      : 'public, max-age=15',
  );
  response.status(200).send(injectHead(SHELL, tags));
}
