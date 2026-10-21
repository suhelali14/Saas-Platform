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
import { localeNames, locales, pathFor, type Locale } from '@/content/index';
import { cx } from '@/components/primitives';

export function Rail({ onEnquire }: { onEnquire: () => void }) {
  const { nav, site } = useContent();
  const { locale, page } = useContentCtx();
  const home = pathFor(locale, 'home');

  // Dropped in this order as the rail narrows. Every one of them is also in
  // the footer, so nothing here becomes unreachable -- unlike the language
  // switcher below, which never drops.
  const links = [
    { label: nav.businesses, href: `${home}#services`, cls: 'hidden md:inline-block' },
    { label: nav.system, href: `${home}#manifest`, cls: 'hidden lg:inline-block' },
    { label: nav.fares, href: pathFor(locale, 'pricing'), cls: 'hidden sm:inline-block' },
    { label: nav.about, href: `${home}#about`, cls: 'hidden xl:inline-block' },
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
                    href={pathFor(l, page === '404' ? 'home' : page)}
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
