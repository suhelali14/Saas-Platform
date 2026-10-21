/**
 * The fare chart.
 *
 * Four rows, not three cards. The question a visitor actually has is "which
 * row am I", and a row is read across: class, who it is for, what it carries,
 * what it costs. Three boxes side by side answer a different question, the one
 * where you compare features you do not yet understand.
 *
 * The "find your row" moment: say how many people need a login and the
 * matching row is stamped. That is the ritual this kind of chart is for.
 */
import { useState } from 'react';
import { useContent } from '@/content/use-content';
import { fareSeats, seatSteps } from '@/content/structure';
import { Band, BandItem, Heading, Panel, Stamp, cx } from '@/components/primitives';

const rowIndexFor = (seats: number) => {
  const i = fareSeats.findIndex(([lo, hi]) => seats >= lo && seats <= hi);
  return i < 0 ? fareSeats.length - 1 : i;
};

export function Fares({ onEnquire }: { onEnquire: () => void }) {
  const { farePanel, fares } = useContent();
  const [seats, setSeats] = useState<number | null>(null);
  const picked = seats === null ? null : rowIndexFor(seats);

  return (
    <section id="fares" className="frame void">
      <Panel>
        <Band>
          <BandItem>{farePanel.bandTitle}</BandItem>
          <BandItem grow>{farePanel.band}</BandItem>
        </Band>

        <div className="px-4 pb-4 pt-7 sm:px-7">
          <Heading>{farePanel.heading}</Heading>
          <p className="t-prose mt-4 text-pretty text-[var(--ink-soft)]">{farePanel.lede}</p>

          <fieldset className="mt-7">
            <legend className="t-label text-[var(--ink-faint)]">{farePanel.selectorLabel}</legend>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {seatSteps.map((n) => {
                const active = seats === n;
                return (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSeats(active ? null : n)}
                    className={cx(
                      't-row min-w-[2.9rem] border px-2.5 py-1.5 transition-colors',
                      active
                        ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--chart)]'
                        : 'border-[color-mix(in_srgb,var(--rule)_34%,transparent)] text-[var(--ink-soft)] hover:border-[var(--ink-soft)] hover:text-[var(--ink)]',
                    )}
                    style={{ transitionDuration: 'var(--dur)', transitionTimingFunction: 'var(--ease)' }}
                  >
                    <span data-figures>{n === 45 ? '45+' : n}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        </div>
        <div className="w-full overflow-x-auto">

          <table className="w-full border-collapse text-left">
            <caption className="sr-only">{farePanel.heading}</caption>
            <thead>
              <tr className="t-label rule-head text-[var(--ink-soft)]">
                <th scope="col" className="w-10 py-2 pl-4 pr-2 font-semibold sm:pl-7">
                  <span className="sr-only">{farePanel.colClass}</span>
                </th>
                <th scope="col" className="py-2 pr-3 font-semibold">{farePanel.colClass}</th>
                <th scope="col" className="hidden py-2 pr-3 font-semibold md:table-cell">
                  {farePanel.colLogins}
                </th>
                <th scope="col" className="py-2 pr-4 text-right font-semibold sm:pr-7">
                  {farePanel.colFare}
                </th>
              </tr>
            </thead>
            <tbody>
              {fares.map((f, i) => {
                const isPicked = picked === i;
                return (
                  <tr
                    key={f.code}
                    className={cx(
                      'rule-row align-top transition-colors',
                      isPicked && 'bg-[color-mix(in_srgb,var(--confirmed)_8%,transparent)]',
                    )}
                    style={{ transitionDuration: 'var(--dur)', transitionTimingFunction: 'var(--ease)' }}
                  >
                    <td className="t-row py-4 pl-4 pr-2 text-[var(--ink-faint)] sm:pl-7">{f.code}</td>
                    <td className="py-4 pr-3">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                        <h3 className="t-board text-[1.3rem] leading-none text-[var(--ink)]">{f.klass}</h3>
                        {isPicked && <Stamp pressed tone="confirmed">{farePanel.yourRow}</Stamp>}
                      </div>
                      <p className="mt-1.5 text-sm text-[var(--ink-soft)]">{f.forWhom}</p>
                      <p className="t-prose mt-2.5 text-[0.9375rem] text-[var(--ink)]">{f.includes}</p>
                      <p className="t-label mt-2.5 text-[var(--ink-faint)] md:hidden">{f.size}</p>
                    </td>
                    <td className="t-row hidden py-4 pr-3 text-[var(--ink-soft)] md:table-cell">
                      <span data-figures>{f.size}</span>
                    </td>
                    <td className="py-4 pr-4 text-right sm:pr-7">
                      <div
                        className="t-board whitespace-nowrap text-[clamp(1.5rem,2.6vw,2.1rem)] leading-none text-[var(--ink)]"
                        data-figures
                      >
                        {f.fare}
                      </div>
                      <div className="mt-1.5 text-xs text-[var(--ink-soft)]">{f.period}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="rule-total flex flex-wrap items-center justify-between gap-5 px-4 py-6 sm:px-7">
          <p className="t-prose text-sm text-[var(--ink-soft)]">{farePanel.note}</p>
          <button type="button" onClick={onEnquire} className="plate">
            {farePanel.action}
          </button>
        </div>
      </Panel>
    </section>
  );
}
