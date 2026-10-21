/**
 * Where it pays for itself.
 *
 * The section that normally carries three invented percentages in a row of
 * cards. There is one live customer and no published measurement, so there is
 * no honest number to put here, and the absence is stated rather than papered
 * over: a buyer who checks is exactly the buyer worth having.
 *
 * Set as an account. A ledger is the right form for "here is where the money
 * goes", and it is the one form with no slot shaped like a statistic.
 */
import { useContent } from '@/content/use-content';
import { Band, BandItem, Heading, Panel, Stamp } from '@/components/primitives';

export function Growth() {
  const { growth } = useContent();
  return (
    <section id="growth" className="frame void">
      <Panel>
        <Band>
          <BandItem>{growth.bandTitle}</BandItem>
          <BandItem grow>
            <span data-figures>{growth.rows.length}</span> {growth.entries}
          </BandItem>
        </Band>

        <div className="px-4 pb-4 pt-7 sm:px-7">
          <Heading>{growth.heading}</Heading>
          <p className="t-prose mt-4 text-pretty text-[var(--ink-soft)]">{growth.lede}</p>
        </div>
        <div className="w-full overflow-x-auto">

          <table className="w-full border-collapse text-left">
            <caption className="sr-only">{growth.heading}</caption>
            <thead>
              <tr className="t-label rule-head text-[var(--ink-soft)]">
                <th scope="col" className="py-2 pl-4 pr-3 font-semibold sm:pl-7">{growth.colLeak}</th>
                <th scope="col" className="py-2 pr-3 font-semibold">{growth.colFix}</th>
                <th scope="col" className="hidden py-2 pr-4 text-right font-semibold sm:pr-7 md:table-cell">
                  {growth.colRemoves}
                </th>
              </tr>
            </thead>
            <tbody>
              {growth.rows.map((r) => (
                <tr key={r.leak} className="rule-row align-top">
                  <td className="py-4 pl-4 pr-5 sm:pl-7 md:w-[15rem]">
                    <span className="text-[0.9375rem] font-semibold text-[var(--ink)]">{r.leak}</span>
                    <span className="t-label mt-1.5 block text-[var(--priority)] md:hidden">{r.removes}</span>
                  </td>
                  <td className="t-prose py-4 pr-3 text-[0.9375rem] text-[var(--ink-soft)]">{r.fix}</td>
                  <td className="hidden py-4 pr-4 text-right align-top sm:pr-7 md:table-cell">
                    <span className="t-label whitespace-nowrap text-[var(--priority)]">{r.removes}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rule-total flex flex-wrap items-start justify-between gap-5 px-4 py-6 sm:px-7">
          <p className="t-prose max-w-prose text-sm text-[var(--ink-soft)]">{growth.honesty}</p>
          <Stamp>{growth.stamp}</Stamp>
        </div>
      </Panel>
    </section>
  );
}
