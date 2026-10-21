/**
 * The manifest: what is loaded behind every row on the chart.
 *
 * A ruled list, not a grid of cards. Each entry is a label in the margin and
 * the thing itself beside it, which is how a manifest has always been set and
 * is simply denser and easier to scan than twenty boxes.
 */
import { useContent } from '@/content/use-content';
import { languages } from '@/content/structure';
import { Band, BandItem, Heading, Panel, Ruling } from '@/components/primitives';

export function Manifest() {
  const { manifestPanel, manifest } = useContent();
  return (
    <section id="manifest" className="frame void">
      <Panel>
        <Band>
          <BandItem>{manifestPanel.bandTitle}</BandItem>
          <BandItem grow>
            <span data-figures>{manifest.reduce((n, g) => n + g.items.length, 0)}</span>{' '}
            {manifestPanel.entries} <span data-figures>{manifest.length}</span>{' '}
            {manifestPanel.parts}
          </BandItem>
        </Band>

        <div className="px-4 pb-4 pt-7 sm:px-7">
          <Heading>{manifestPanel.heading}</Heading>
          <p className="t-prose mt-4 text-pretty text-[var(--ink-soft)]">{manifestPanel.lede}</p>
        </div>

        <div className="px-4 pb-8 sm:px-7">
          {manifest.map((group) => (
            <section key={group.heading} className="mt-9 first:mt-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 pb-1.5">
                <h3 className="t-board text-[1.3rem] leading-none text-[var(--ink)]">{group.heading}</h3>
                <p className="text-sm text-[var(--ink-soft)]">{group.note}</p>
              </div>
              <Ruling />

              <dl>
                {group.items.map((item) => (
                  <div
                    key={item.name}
                    className="rule-row grid gap-x-8 gap-y-1 py-3.5 sm:grid-cols-[13rem_minmax(0,1fr)]"
                  >
                    <dt className="text-[0.9375rem] font-semibold text-[var(--ink)]">{item.name}</dt>
                    <dd className="t-prose text-[0.9375rem] text-[var(--ink-soft)]">{item.detail}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>

        {/* The twelve scripts, set in themselves. A list that says "Marathi"
            where it could say the word in its own script has shown nothing. */}
        <div className="border-t border-[color-mix(in_srgb,var(--rule)_30%,transparent)] bg-[var(--chart-band)] px-4 py-5 sm:px-7">
          <ul className="flex flex-wrap items-baseline gap-x-5 gap-y-2.5">
            {languages.map((l) => (
              <li key={l.code} className="flex items-baseline gap-1.5">
                <span lang={l.code} className="text-[1.0625rem] text-[var(--ink)]">{l.native}</span>
                <span className="t-label text-[var(--ink-faint)]">{l.latin}</span>
              </li>
            ))}
          </ul>
        </div>
      </Panel>
    </section>
  );
}
