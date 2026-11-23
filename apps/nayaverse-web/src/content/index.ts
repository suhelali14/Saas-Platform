/**
 * Locales, and how a URL maps to one.
 *
 * Three languages, each on its own prefixed path rather than a cookie or a
 * query string, because the point of translating this site is that somebody
 * searching in Marathi finds it. A language a crawler cannot reach is a
 * language nobody arrives in.
 *
 *   /            /pricing          English
 *   /hi          /hi/pricing       हिन्दी
 *   /mr          /mr/pricing       मराठी
 *
 * Every page is prerendered at every locale, and each one declares the others
 * with hreflang, so the three are one document in three languages rather than
 * three pages competing with each other.
 */
import { en, type Content } from './en';
import { hi } from './hi';
import { mr } from './mr';

export type Locale = 'en' | 'hi' | 'mr';
export type { Content };

export const locales: Locale[] = ['en', 'hi', 'mr'];

export const content: Record<Locale, Content> = { en, hi, mr };

/** Shown in the switcher. Each set in its own script: somebody looking for
 *  Marathi should find मराठी, not the word "Marathi". */
export const localeNames: Record<Locale, { native: string; short: string; latin: string }> = {
  en: { native: 'English', short: 'ENG', latin: 'English' },
  hi: { native: 'हिन्दी', short: 'हिं', latin: 'Hindi' },
  mr: { native: 'मराठी', short: 'मरा', latin: 'Marathi' },
};

/** The BCP 47 tag that goes in <html lang>. */
export const htmlLang: Record<Locale, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  mr: 'mr-IN',
};

export type Page =
  | 'home'
  | 'pricing'
  | 'about'
  | 'founder'
  | 'features'
  | 'security'
  | 'why-nayaversse'
  | 'for-clinics'
  | 'for-polyclinics'
  | 'for-hospitals'
  | 'for-multi-specialty'
  | 'stories'
  | 'blog'
  | '404';

export type RouteInfo = { locale: Locale; page: Page };

/** Pages that live at /<slug>, matched by their slug on URL resolution. */
const SIMPLE_PAGES: { page: Exclude<Page, 'home' | '404'>; slug: string }[] = [
  { page: 'pricing', slug: 'pricing' },
  { page: 'about', slug: 'about' },
  { page: 'founder', slug: 'founder' },
  { page: 'features', slug: 'features' },
  { page: 'security', slug: 'security' },
  { page: 'why-nayaversse', slug: 'why-nayaversse' },
  { page: 'for-clinics', slug: 'for-clinics' },
  { page: 'for-polyclinics', slug: 'for-polyclinics' },
  { page: 'for-hospitals', slug: 'for-hospitals' },
  { page: 'for-multi-specialty', slug: 'for-multi-specialty' },
  { page: 'stories', slug: 'stories' },
  { page: 'blog', slug: 'blog' },
];

/** `/mr/pricing` -> { locale: 'mr', page: 'pricing' } */
export function resolveRoute(pathname: string): RouteInfo {
  const parts = pathname.split('/').filter(Boolean);
  let locale: Locale = 'en';

  if (parts.length && (locales as string[]).includes(parts[0]!)) {
    locale = parts.shift() as Locale;
  }

  if (parts.length === 0) return { locale, page: 'home' };
  if (parts.length === 1) {
    const hit = SIMPLE_PAGES.find((r) => r.slug === parts[0]);
    if (hit) return { locale, page: hit.page };
  }
  return { locale, page: '404' };
}

/** The path for a page in a locale. English is unprefixed: it is the default,
 *  and `/en/` would be a second URL for a page that already has one. */
export function pathFor(locale: Locale, page: Page): string {
  const prefix = locale === 'en' ? '' : `/${locale}`;
  if (page === '404') return `${prefix}/404`;
  const hit = SIMPLE_PAGES.find((r) => r.page === page);
  if (hit) return `${prefix}/${hit.slug}`;
  return prefix || '/';
}

/** Every path that gets prerendered. */
export const allRoutes: RouteInfo[] = locales.flatMap((locale) =>
  (['home', ...SIMPLE_PAGES.map((p) => p.page), '404'] as Page[]).map((page) => ({ locale, page })),
);
