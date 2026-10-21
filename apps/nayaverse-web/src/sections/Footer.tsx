/**
 * The fine print at the foot of the board.
 *
 * Deliberately not another cream panel: six panels in a row and the eye stops
 * seeing them. This is set straight onto the cladding, in the small type a
 * notice carries at the bottom, with the domain in the corner.
 */
import { useContent, useContentCtx } from '@/content/use-content';
import { pathFor } from '@/content/index';
import { site } from '@/content/contact';

export function Footer() {
  const { footer, nav, site: siteText } = useContent();
  const { locale } = useContentCtx();

  const links = [
    { label: nav.businesses, href: `${pathFor(locale, 'home')}#services` },
    { label: nav.system, href: `${pathFor(locale, 'home')}#manifest` },
    { label: nav.fares, href: pathFor(locale, 'pricing') },
    { label: nav.about, href: `${pathFor(locale, 'home')}#about` },
    { label: nav.questions, href: `${pathFor(locale, 'home')}#conditions` },
  ];

  return (
    <footer className="border-t border-[var(--steel-line)]">
      <div className="frame py-10">
        <div className="flex flex-wrap items-start justify-between gap-x-10 gap-y-7">
          <div className="max-w-prose">
            <div className="t-board inline-block bg-[var(--board)] px-2 py-1 text-[1rem] leading-none text-[var(--board-ink)] ring-1 ring-[var(--steel-line)]">
              {siteText.name}
            </div>
            {footer.lines.map((line) => (
              <p key={line.slice(0, 20)} className="mt-3 text-sm text-[var(--board-ink-soft)]">
                {line}
              </p>
            ))}
          </div>

          <nav aria-label={nav.questions}>
            <ul className="space-y-1.5">
              {links.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className="t-label text-[var(--board-ink-soft)] underline decoration-[var(--steel-line)] transition-colors hover:text-[var(--lamp)] hover:decoration-[var(--lamp)]"
                    style={{ transitionDuration: 'var(--dur)' }}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-9 flex flex-wrap items-end justify-between gap-x-8 gap-y-3 border-t border-[var(--steel-line)] pt-5">
          <p className="t-prose text-xs leading-relaxed text-[var(--board-ink-soft)]">{footer.legal}</p>
          <p className="t-label shrink-0 text-[var(--steel-rivet)]">{site.domain}</p>
        </div>
      </div>
    </footer>
  );
}
