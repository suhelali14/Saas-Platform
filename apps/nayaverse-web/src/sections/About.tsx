/**
 * About.
 *
 * The one section where a small vendor is tempted to sound bigger than it is,
 * and the one where doing so would undo every honest thing on the rest of the
 * page. Prose on the left, particulars on the right: the facts a buyer would
 * otherwise have to ask for, including the ones that are not flattering.
 */
import { useContent } from '@/content/use-content';
import { Band, BandItem, Heading, Panel } from '@/components/primitives';

export function About() {
  const { about } = useContent();
  return (
    <section id="about" className="frame void">
      <Panel>
        <Band>
          <BandItem>{about.bandTitle}</BandItem>
          <BandItem grow>{about.band}</BandItem>
        </Band>

        <div className="grid gap-x-12 gap-y-9 px-4 py-7 sm:px-7 lg:grid-cols-[minmax(0,1fr)_19rem]">
          <div>
            <Heading>{about.heading}</Heading>
            {about.paragraphs.map((p) => (
              <p key={p.slice(0, 24)} className="t-prose mt-4 text-pretty text-[var(--ink-soft)]">
                {p}
              </p>
            ))}
            <p className="t-prose mt-6 text-[1.0625rem] text-[var(--ink)]">{about.closing}</p>
          </div>

          <dl className="self-start lg:border-l lg:border-[color-mix(in_srgb,var(--rule)_22%,transparent)] lg:pl-10">
            {about.facts.map((f) => (
              <div key={f.label} className="rule-row py-3 first:pt-0">
                <dt className="t-label text-[var(--ink-faint)]">{f.label}</dt>
                <dd className="mt-1 text-[0.9375rem] text-[var(--ink)]">{f.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Panel>
    </section>
  );
}
