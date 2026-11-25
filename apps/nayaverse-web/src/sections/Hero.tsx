/**
 * The destination board.
 *
 * A board bolted to the cladding, carrying what the clinic product covers,
 * the headline painted across it, and at its right the three things this
 * company has: a product that is live, a product that is built, and a list
 * of what is planned. Each with the one word that says where it stands.
 *
 * It used to carry three counts off the service chart (one live, twenty
 * building, two not planned) and a monthly fare. The counts now live on the
 * Vision page with the chart they summarise. The fare is gone from here on
 * purpose: it was the price of the general business platform, which nobody
 * can buy yet, and a clinic's price is quoted after the walkthrough. A
 * figure on the first screen that the live product is not sold at would be
 * the one number on the site that misleads.
 *
 * Deliberately not full height: the board's lower edge sits above the fold so
 * the panel beneath it starts in the first viewport. A hero that fills the
 * screen teaches a visitor there is nothing under it.
 *
 * The board is also wider than every panel below it -- the one place this
 * layout breaks its own grid, where it costs no legibility.
 */
import { useContent, useContentCtx } from '@/content/use-content';
import { pathFor } from '@/content/index';
import { productsCopy } from '@/content/products';
import { homeCopy } from '@/content/home';
import { Board, cx } from '@/components/primitives';

export function Hero({ onEnquire }: { onEnquire: () => void }) {
  const { readiness } = useContent();
  const { locale } = useContentCtx();
  const { hero: actions, lineup, status } = productsCopy[locale];
  const hero = { ...actions, ...homeCopy[locale].hero };

  const lines = [
    { name: lineup.clinic.name, word: readiness.LIVE, note: hero.clinicNote, href: pathFor(locale, 'clinic'), tone: 'text-[var(--board-live)] border-[var(--board-live)]' },
    { name: lineup.growth.name, word: status.built, note: hero.growthNote, href: pathFor(locale, 'growth'), tone: 'text-[var(--board-ink)] border-[var(--board-ink-soft)]' },
    { name: lineup.vision.name, word: status.planned, note: hero.visionNote, href: pathFor(locale, 'vision'), tone: 'text-[var(--board-ink-soft)] border-[var(--steel-line)]' },
  ];

  return (
    <section id="top" className="frame frame-wide pb-10 pt-8 sm:pt-12">
      <Board className="px-5 py-8 sm:px-10 sm:py-11 lg:px-14 lg:py-12">
        {/* Two cells. On a desk: headline and lede, with the products and
            the action down the right. On a phone they stack, and what exists
            and the way to act still fit the first screen. (The split-flap
            departure line that used to sit here turns through the trades
            on the service chart, so it went to the Vision page with it.) */}
        <div className="grid gap-x-12 gap-y-9 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0">
            <h1 className="t-board t-display text-[var(--board-ink)]">
              {hero.headline.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </h1>
            <p className="t-lede mt-6 text-pretty text-[var(--board-ink-soft)]">{hero.lede}</p>
          </div>

          <div className="flex flex-col gap-7 border-t border-[var(--steel-line)] pt-7 lg:w-[21.5rem] lg:border-l lg:border-t-0 lg:pl-12 lg:pt-0">
            {/* What exists, in three lines, at the top of the page. */}
            <ul>
              {lines.map((l) => (
                <li key={l.href} className="border-b border-[var(--steel-line)] py-3.5 first:pt-0 last:border-b-0">
                  <a href={l.href} className="group block">
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <span
                        className="t-board text-[1.35rem] leading-none text-[var(--board-ink)] transition-colors group-hover:text-[var(--lamp)]"
                        style={{ transitionDuration: 'var(--dur)' }}
                      >
                        {l.name}
                      </span>
                      <span className={cx('t-label border px-1.5 py-0.5 !text-[0.625rem]', l.tone)}>{l.word}</span>
                    </span>
                    <span className="mt-1.5 block text-xs leading-snug text-[var(--board-ink-soft)]">{l.note}</span>
                  </a>
                </li>
              ))}
            </ul>

            <div className="mt-auto flex flex-wrap items-center gap-x-6 gap-y-3">
              <button type="button" onClick={onEnquire} className="plate">
                {hero.action}
              </button>
              <a href={pathFor(locale, 'clinic')} className="engraved">
                {hero.secondary}
              </a>
            </div>
          </div>

        </div>
      </Board>
    </section>
  );
}
