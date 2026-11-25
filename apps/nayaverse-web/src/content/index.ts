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
import { guides, guideBySlug } from './guides';

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
  // The products, and what comes after them (content/products.ts).
  | 'clinic'
  | 'growth'
  | 'vision'
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
  | 'guides'
  | GuidePage
  | '404';

/** One guide, by its slug: `guide:opd-queue-management`. */
export type GuidePage = `guide:${string}`;

export const isGuidePage = (page: Page): page is GuidePage => page.startsWith('guide:');
export const guideSlug = (page: GuidePage) => page.slice('guide:'.length);

export type RouteInfo = { locale: Locale; page: Page };

/**
 * The languages a page exists in. Everything is in all three, except the
 * guides, which are English until their translations are written. Every
 * hreflang list, sitemap entry and language-switcher link reads this, so a
 * crawler or a visitor is never sent to a translation that does not exist.
 */
export function localesFor(page: Page): Locale[] {
  return page === 'guides' || isGuidePage(page) ? ['en'] : locales;
}

/** Pages that live at /<slug>, matched by their slug on URL resolution. */
const SIMPLE_PAGES: { page: Exclude<Page, 'home' | '404'>; slug: string }[] = [
  { page: 'clinic', slug: 'clinic' },
  { page: 'growth', slug: 'growth' },
  { page: 'vision', slug: 'vision' },
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
    if (parts[0] === 'guides') return { locale, page: 'guides' };
    const hit = SIMPLE_PAGES.find((r) => r.slug === parts[0]);
    if (hit) return { locale, page: hit.page };
  }
  if (parts.length === 2 && parts[0] === 'guides') {
    const g = guideBySlug(parts[1]!);
    if (g) return { locale, page: `guide:${g.slug}` };
  }
  return { locale, page: '404' };
}

/** The path for a page in a locale. English is unprefixed: it is the default,
 *  and `/en/` would be a second URL for a page that already has one. */
export function pathFor(locale: Locale, page: Page): string {
  const prefix = locale === 'en' ? '' : `/${locale}`;
  if (page === '404') return `${prefix}/404`;
  if (page === 'guides') return `${prefix}/guides`;
  if (isGuidePage(page)) return `${prefix}/guides/${guideSlug(page)}`;
  const hit = SIMPLE_PAGES.find((r) => r.page === page);
  if (hit) return `${prefix}/${hit.slug}`;
  return prefix || '/';
}

/** Every path that gets prerendered: each page in each language it exists in. */
export const allRoutes: RouteInfo[] = locales.flatMap((locale) =>
  ([
    'home',
    ...SIMPLE_PAGES.map((p) => p.page),
    'guides',
    ...guides.map((g) => `guide:${g.slug}` as GuidePage),
    '404',
  ] as Page[])
    .filter((page) => page === '404' || localesFor(page).includes(locale))
    .map((page) => ({ locale, page })),
);
