/**
 * The health line: clinic to multi-specialty hospital.
 *
 * The one row of the service chart that is live, and the row it grows into,
 * set out as classes on a line rather than a feature grid. A doctor reading
 * this wants to know which class is theirs, what switching it on gives them,
 * and whether anyone actually runs it -- so the last column says exactly that,
 * in words, and only where every part of a class runs for a paying clinic is
 * it stamped Live (structure.ts `healthClasses`).
 *
 * Its stamps are deliberately not the service chart's status cells: the build
 * counts those to prove the page never claims more than one live business,
 * and this section is about classes of one product, not businesses.
 *
 * No price. Clinics and hospitals pay a setup and then a yearly fee, quoted
 * after the walkthrough; a figure appears here only once the owner has set
 * one, and never one made up to fill the column.
 */
import { useContent } from '@/content/use-content';
import { healthClasses } from '@/content/structure';
import { Band, BandItem, Heading, Panel, Ruling, Stamp } from '@/components/primitives';

export function HealthLine({ onEnquire }: { onEnquire: () => void }) {
  const { healthLine, readiness } = useContent();

  return (
    <section id="health" className="frame void">
      <Panel>
        <Band>
          <BandItem>{healthLine.bandTitle}</BandItem>
          <BandItem grow>{healthLine.band}</BandItem>
        </Band>

        <div className="px-4 pb-4 pt-7 sm:px-7">
          <Heading>{healthLine.heading}</Heading>
          <p className="t-prose mt-4 text-pretty text-[var(--ink-soft)]">{healthLine.lede}</p>
        </div>

        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">{healthLine.heading}</caption>
            <thead>
              <tr className="t-label rule-head text-[var(--ink-soft)]">
                <th scope="col" className="w-10 py-2 pl-4 pr-2 font-semibold sm:pl-7">
                  <span className="sr-only">{healthLine.colClass}</span>
                </th>
                <th scope="col" className="py-2 pr-3 font-semibold">
                  {healthLine.colClass} · {healthLine.colCarries}
                </th>
                <th scope="col" className="hidden w-[15rem] py-2 pr-4 font-semibold sm:pr-7 md:table-cell">
                  {healthLine.colStands}
                </th>
              </tr>
            </thead>
            <tbody>
              {healthClasses.map((c, i) => {
                const words = healthLine.classes[i]!;
                const stamp = (
                  <Stamp rotate={false} tone={c.live ? 'confirmed' : 'stamp'}>
                    {c.live ? readiness.LIVE : healthLine.built}
                  </Stamp>
                );
                const logins = c.logins === '∞' ? healthLine.noLimit : `${c.logins} ${healthLine.logins}`;
                return (
                  <tr key={c.code} className="rule-row align-top">
                    <td className="t-row py-4 pl-4 pr-2 text-[var(--ink-faint)] sm:pl-7">{c.code}</td>
                    <td className="py-4 pr-4 sm:pr-7 md:pr-3">
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
                        <h3 className="t-board text-[1.3rem] leading-none text-[var(--ink)]">{words.klass}</h3>
                        <span className="t-label text-[var(--ink-faint)]" data-figures>{logins}</span>
                      </div>
                      <p className="mt-1.5 text-sm text-[var(--ink-soft)]">{words.forWhom}</p>
                      <p className="t-prose mt-2.5 text-[0.9375rem] text-[var(--ink)]">{words.carries}</p>
                      {/* Below md the third column folds in here, so a phone
                          still says whether anyone runs it. */}
                      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 md:hidden">
                        {stamp}
                        <span className="text-sm text-[var(--ink-soft)]">{words.stands}</span>
                      </div>
                    </td>
                    <td className="hidden py-4 pr-4 sm:pr-7 md:table-cell">
                      {stamp}
                      <p className="mt-2 text-sm text-[var(--ink-soft)]">{words.stands}</p>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="px-4 pb-2 pt-7 sm:px-7">
          <h3 className="t-board text-[1.3rem] leading-none text-[var(--ink)]">{healthLine.termsHeading}</h3>
          <div className="mt-4">
            <Ruling />
          </div>
          <dl>
            {healthLine.terms.map((term) => (
              <div
                key={term.label}
                className="rule-row grid gap-x-8 gap-y-1 py-3.5 sm:grid-cols-[14rem_minmax(0,1fr)]"
              >
                <dt className="text-[0.9375rem] font-semibold text-[var(--ink)]">{term.label}</dt>
                <dd className="t-prose text-[0.9375rem] text-[var(--ink-soft)]">{term.detail}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="rule-total flex flex-wrap items-center justify-between gap-5 px-4 py-6 sm:px-7">
          <p className="t-prose max-w-[62ch] text-sm text-[var(--ink-soft)]">{healthLine.honesty}</p>
          <button type="button" onClick={onEnquire} className="plate">
            {healthLine.action}
          </button>
        </div>
      </Panel>
    </section>
  );
}
