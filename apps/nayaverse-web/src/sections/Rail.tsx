/**
 * The rail across the top of the cladding.
 *
 * Five links, a language switcher and one action, so there is no drawer and no
 * hamburger: links drop in a fixed order as the rail narrows and the rest
 * still fits a 360px phone. A menu button that opens a panel to reveal five
 * words is machinery for its own sake.
 *
 * Fares never drops. The price is what people came for.
 */
import { useContent, useContentCtx } from '@/content/use-content';
import { localeNames, locales, localesFor, pathFor, type Locale } from '@/content/index';
import { productsCopy } from '@/content/products';
import { cx } from '@/components/primitives';

export function Rail({ onEnquire }: { onEnquire: () => void }) {
  const { nav, site } = useContent();
  const { locale, page } = useContentCtx();
  const home = pathFor(locale, 'home');

  // Each link goes to its own prerendered page where one exists (About,
  // Features, Fares, Stories), with a hash fallback to the home page
  // section for the two that are still single-page only (the Businesses
  // chart and the Questions block). This matters: a nav that sends the
  // reader to /#about from the About page looks like "URL changed but
  // nothing navigated" -- the browser landed on home and scrolled to a
  // section, which is not what the reader asked for.
  //
  // Dropped in this order as the rail narrows. Every one of them is also
  // in the footer, so nothing here becomes unreachable -- unlike the
  // language switcher below, which never drops.
  //
  // The two products come first and never both drop: Clinic is what is for
  // sale, so it stays down to the narrowest phone that has room for it.
  const products = productsCopy[locale].nav;
  const links = [
    { label: products.clinic, href: pathFor(locale, 'clinic'), cls: 'hidden min-[420px]:inline-block' },
    { label: products.growth, href: pathFor(locale, 'growth'), cls: 'hidden sm:inline-block' },
    { label: products.vision, href: pathFor(locale, 'vision'), cls: 'hidden md:inline-block' },
    { label: nav.fares, href: pathFor(locale, 'pricing'), cls: 'hidden lg:inline-block' },
    { label: nav.about, href: pathFor(locale, 'about'), cls: 'hidden xl:inline-block' },
    { label: nav.questions, href: `${home}#conditions`, cls: 'hidden lg:inline-block' },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--steel-line)] bg-[var(--steel-deep)]">
      <div className="frame flex h-14 items-center gap-3">
        <a href={home} className="group flex items-baseline gap-2" aria-label={site.name}>
          {/* The wordmark as a small painted plate, which is what it is on the
              side of a real coach. */}
          <span className="t-board bg-[var(--board)] px-2 py-1 text-[0.9375rem] leading-none sm:text-[1.0625rem] tracking-[0.01em] text-[var(--board-ink)] ring-1 ring-[var(--steel-line)] transition-colors duration-200 group-hover:text-[var(--lamp)]">
            {site.name}
          </span>
        </a>

        <nav className="ml-auto flex items-center gap-0.5 sm:gap-1" aria-label={nav.businesses}>
          {links.map((item) => (
            <a key={item.href} href={item.href} className={cx('rail-link', item.cls)}>
              {item.label}
            </a>
          ))}

          {/* The same page in another language, as a link rather than a
              dropdown: three options, and a crawler should be able to follow
              each one. Each name is set in its own script. */}
          <ul
            className="ml-1 flex items-center gap-0.5 border-l border-[var(--steel-line)] pl-1.5"
            aria-label={nav.language}
          >
            {locales.map((l: Locale) => {
              const current = l === locale;
              return (
                <li key={l}>
                  <a
                    href={pathFor(l, page !== '404' && localesFor(page).includes(l) ? page : 'home')}
                    hrefLang={l}
                    lang={l}
                    aria-current={current ? 'true' : undefined}
                    className={cx(
                      'rail-link !tracking-normal !px-1.5 sm:!px-2',
                      current && '!text-[var(--lamp)] !border-[var(--steel-line)]',
                      // On the narrowest phones the current language is
                      // dropped: you are already reading it, and the room buys
                      // room for the two you might want instead.
                      current && 'hidden min-[360px]:inline-block',
                    )}
                  >
                    <span className="sm:hidden">{localeNames[l].short}</span>
                    <span className="hidden sm:inline">{localeNames[l].native}</span>
                  </a>
                </li>
              );
            })}
          </ul>

          <button type="button" onClick={onEnquire} className="plate ml-1.5 !px-2.5 !py-1.5 !text-[0.875rem] sm:!px-3 sm:!text-[0.9375rem]">
            {nav.enquire}
          </button>
        </nav>
      </div>
    </header>
  );
}
