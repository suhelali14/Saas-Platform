/**
 * The destination board.
 *
 * A board bolted to the cladding, carrying the route it runs, the headline
 * painted across it, and at its right the state of the chart, the fare and
 * the action.
 *
 * The three counts are the honest headline fact, and the thing a competitor's
 * landing page would never put at the top: one trade live, twenty being built,
 * two not planned. They are counted from the service chart rather than typed
 * here, so they cannot drift from the rows they summarise.
 *
 * Deliberately not full height: the board's lower edge sits above the fold so
 * the chart panel beneath it starts in the first viewport. A hero that fills
 * the screen teaches a visitor there is nothing under it.
 *
 * The board is also wider than every panel below it -- the one place this
 * layout breaks its own grid, where it costs no legibility.
 */
import { useContent } from '@/content/use-content';
import { serviceRows, type Readiness } from '@/content/structure';
import { Board, Chevron, cx } from '@/components/primitives';

const TALLY: Readiness[] = ['LIVE', 'BUILDING', 'WAITLIST'];

const COUNT: Record<Readiness, number> = {
  LIVE: serviceRows.filter((r) => r.status === 'LIVE').length,
  BUILDING: serviceRows.filter((r) => r.status === 'BUILDING').length,
  WAITLIST: serviceRows.filter((r) => r.status === 'WAITLIST').length,
};

const TONE: Record<Readiness, string> = {
  LIVE: 'text-[var(--lamp)]',
  BUILDING: 'text-[var(--board-ink)]',
  WAITLIST: 'text-[var(--board-ink-soft)]',
};

export function Hero({ onEnquire }: { onEnquire: () => void }) {
  const { hero, readiness } = useContent();
  const note: Record<Readiness, string> = {
    LIVE: hero.tally.live,
    BUILDING: hero.tally.building,
    WAITLIST: hero.tally.waitlist,
  };

  return (
    <section id="top" className="frame frame-wide pb-10 pt-8 sm:pb-14 sm:pt-12">
      <Board className="px-5 py-8 sm:px-10 sm:py-12 lg:px-14 lg:py-14">
        <ul className="t-label flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[var(--board-ink-soft)]">
          {hero.route.map((stop, i) => (
            <li key={stop} className="flex items-center gap-2">
              {i > 0 && <Chevron className="text-[var(--lamp)]" />}
              <span>{stop}</span>
            </li>
          ))}
        </ul>

        <div className="mt-7 grid gap-x-12 gap-y-9 lg:mt-9 lg:grid-cols-[minmax(0,1fr)_auto]">
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

          <div className="flex flex-col gap-7 border-t border-[var(--steel-line)] pt-7 lg:w-[20.5rem] lg:border-l lg:border-t-0 lg:pl-12 lg:pt-0">
            {/* The state of the chart, in three lines, at the top of the page. */}
            <dl>
              {TALLY.map((status) => (
                <div
                  key={status}
                  className="flex items-baseline gap-3 border-b border-[var(--steel-line)] py-2.5 first:pt-0 last:border-b-0"
                >
                  <dt className="t-label w-[5.6rem] shrink-0 text-[var(--board-ink-soft)]">
                    {readiness[status]}
                  </dt>
                  <dd className="flex min-w-0 items-baseline gap-2.5">
                    <span
                      className={cx('t-board shrink-0 text-[1.6rem] leading-none', TONE[status])}
                      data-figures
                    >
                      {COUNT[status]}
                    </span>
                    <span className="min-w-0 text-xs leading-tight text-[var(--board-ink-soft)]">
                      {note[status]}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>

            <div className="mt-auto">
              <div className="t-label text-[var(--board-ink-soft)]">{hero.fareLabel}</div>
              <div
                className="t-board mt-1.5 text-[clamp(2.4rem,6vw,3.4rem)] text-[var(--lamp)]"
                data-figures
              >
                {hero.fareFrom}
              </div>
              <div className="mt-1 text-sm text-[var(--board-ink-soft)]">{hero.farePeriod}</div>

              <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2">
                <button type="button" onClick={onEnquire} className="plate">
                  {hero.action}
                </button>
                <a href="#services" className="engraved">
                  {hero.secondary}
                </a>
              </div>
            </div>
          </div>
        </div>
      </Board>
    </section>
  );
}
