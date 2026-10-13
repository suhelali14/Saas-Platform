import type { VercelRequest, VercelResponse } from '@vercel/node';
import { hostOf, fetchSeo } from './_seo.js';

/**
 * robots.txt, per clinic.
 *
 * Has to be per clinic because the Sitemap line names this clinic's own
 * host, and that line is how a crawler finds the sitemap at all — a
 * sitemap nobody is told about is a file nobody reads.
 *
 * Keeps the staff portal out of the index. Not a security measure and
 * not treated as one: every route behind it needs a token and the API
 * enforces RBAC regardless. It is there because a clinic's login page
 * has no business ranking for the clinic's own name.
 */
export default async function handler(request: VercelRequest, response: VercelResponse) {
  const host = hostOf(request.headers as Record<string, string | string[] | undefined>);
  const seo = await fetchSeo(host);

  response.setHeader('Content-Type', 'text/plain; charset=utf-8');
  // Short when it could not be built, so a cold clinic is retried rather
  // than having a crawl-blocking file cached for hours.
  response.setHeader('Cache-Control', seo ? 'public, max-age=3600' : 'public, max-age=60');

  if (!seo) {
    // An unknown host is not a clinic. Allowing a crawl of a page that
    // will render "no clinic at this address" wastes its budget and puts
    // an error page in the index.
    response.status(200).send('User-agent: *\nDisallow: /\n');
    return;
  }

  response.status(200).send(
    [
      'User-agent: *',
      'Allow: /',
      'Disallow: /login',
      'Disallow: /live-queue',
      '',
      `Sitemap: https://${host}/sitemap.xml`,
      '',
    ].join('\n'),
  );
}
