/**
 * What we make: two products and what comes after.
 *
 * The page used to open on a chart of twenty-three kinds of business with
 * one of them live. That was honest, and it buried the thing a visitor can
 * actually buy under twenty-two they cannot. So the products come first, each
 * with the one word that says where it stands, and the chart of everything
 * else moved to its own page, the Vision.
 *
 * Clinic is stamped with the chart's own "Live", the same word the service
 * chart uses, because it is the same claim: running in production for a
 * business that pays. Growth is "Built" and nothing stronger. No business
 * uses it yet, and the sentence under the stamp says exactly that.
 */
import { useContent, useContentCtx } from '@/content/use-content';
import { pathFor } from '@/content/index';
import { productsCopy } from '@/content/products';
import { Band, BandItem, Chevron, Heading, Panel, Stamp } from '@/components/primitives';

export function Lineup() {
  const { readiness } = useContent();
  const { locale } = useContentCtx();
  const { lineup, status } = productsCopy[locale];

  const products = [
    { key: 'clinic', words: lineup.clinic, stamp: <Stamp rotate={false} tone="confirmed">{readiness.LIVE}</Stamp>, href: pathFor(locale, 'clinic'), code: 'P1' },
    { key: 'growth', words: lineup.growth, stamp: <Stamp rotate={false}>{status.built}</Stamp>, href: pathFor(locale, 'growth'), code: 'P2' },
  ] as const;

  return (
    <section id="products" className="frame void">
      <Panel>
        <Band>
          <BandItem>{lineup.bandTitle}</BandItem>
          <BandItem grow>{lineup.band}</BandItem>
        </Band>

        <div className="px-4 pb-6 pt-7 sm:px-7">
          <Heading>{lineup.heading}</Heading>
          <p className="t-prose mt-4 max-w-[62ch] text-pretty text-[var(--ink-soft)]">{lineup.lede}</p>
        </div>

        <div className="grid border-t border-[color-mix(in_srgb,var(--rule)_52%,transparent)] md:grid-cols-2">
          {products.map((p, i) => (
            <article
              key={p.key}
              className={
                'flex flex-col px-4 py-7 sm:px-7 ' +
                (i === 1 ? 'border-t border-[color-mix(in_srgb,var(--rule)_20%,transparent)] md:border-l md:border-t-0' : '')
              }
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="t-row text-[var(--ink-faint)]">{p.code}</span>
                {p.stamp}
              </div>
              <h3 className="t-board mt-4 text-[clamp(1.7rem,4vw,2.2rem)] leading-none text-[var(--ink)]">{p.words.name}</h3>
              <p className="mt-2 text-sm text-[var(--ink-faint)]">{p.words.forWhom}</p>
              <p className="t-prose mt-4 text-pretty text-[var(--ink)]">{p.words.body}</p>
              <ul className="mt-4 flex-1">
                {p.words.points.map((point) => (
                  <li key={point} className="rule-row flex gap-2.5 py-2.5 text-[0.9375rem] text-[var(--ink-soft)]">
                    <Chevron className="mt-[0.4rem] text-[var(--priority)]" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-sm font-semibold text-[var(--ink)]">{p.words.stands}</p>
              <div className="mt-5">
                <a href={p.href} className="engraved text-[var(--ink)]">
                  {p.words.link}
                </a>
              </div>
            </article>
          ))}
        </div>

        <div className="rule-total flex flex-wrap items-center justify-between gap-x-8 gap-y-4 px-4 py-6 sm:px-7">
          <div className="max-w-[62ch]">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="t-board text-[1.3rem] leading-none text-[var(--ink)]">{lineup.vision.name}</h3>
              <Stamp rotate={false} tone="priority">{status.planned}</Stamp>
            </div>
            <p className="t-prose mt-2.5 text-sm text-[var(--ink-soft)]">{lineup.vision.body}</p>
          </div>
          <a href={pathFor(locale, 'vision')} className="engraved text-[var(--ink)]">
            {lineup.vision.link}
          </a>
        </div>
      </Panel>
    </section>
  );
}
