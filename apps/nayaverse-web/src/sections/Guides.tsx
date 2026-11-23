/**
 * The guides: an index, and one long-form page per guide.
 *
 * Same panels, band and prose measure as the secondary pages, so a guide
 * reads as part of the site rather than a blog bolted onto it. Two things a
 * secondary page does not have, both for the reader before the crawler: a
 * byline with a date, because advice about law and tax is only as good as
 * when it was written and by whom; and the questions at the end, written as
 * a person would ask them.
 */
import { guides, guidesIndex, guideBySlug } from '@/content/guides';
import { guideSlug, pathFor, type GuidePage } from '@/content/index';
import { founder } from '@/content/contact';
import { Band, BandItem, Heading, Panel } from '@/components/primitives';

const rule = 'border-[color-mix(in_srgb,var(--rule)_22%,transparent)]';

const longDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

function Byline({ updated }: { updated: string }) {
  return (
    <p className="mt-5 text-[0.9375rem] text-[var(--ink-soft)]">
      By{' '}
      <a href={pathFor('en', 'founder')} className="engraved text-[var(--ink)]">
        {founder.name}
      </a>
      , founder of Nayaversse · Updated <time dateTime={updated}>{longDate(updated)}</time>
    </p>
  );
}

export function GuidesIndex() {
  return (
    <>
      <section className="frame frame-wide pb-10 pt-8 sm:pt-12">
        <Panel>
          <Band>
            <BandItem>Guides</BandItem>
            <BandItem grow>{guides.length} guides</BandItem>
          </Band>
          <div className="px-5 py-8 sm:px-10 sm:py-11">
            <Heading as="h1" className="text-[clamp(2.2rem,6vw,3.6rem)] text-[var(--ink)]">
              {guidesIndex.title}
            </Heading>
            <p className="t-lede mt-5 max-w-[48rem] text-pretty text-[var(--ink-soft)]">
              {guidesIndex.lede}
            </p>
          </div>
        </Panel>
      </section>

      <section className="frame void">
        <Panel>
          <ol className="px-5 py-4 sm:px-10 sm:py-6">
            {guides.map((g) => (
              <li key={g.slug} className={`border-t py-7 first:border-t-0 ${rule}`}>
                <h2 className="t-prose text-[1.375rem] font-semibold text-[var(--ink)]">
                  <a href={pathFor('en', `guide:${g.slug}`)} className="engraved">
                    {g.title}
                  </a>
                </h2>
                <p className="t-prose mt-3 max-w-[46rem] text-pretty text-[var(--ink-soft)]">{g.description}</p>
              </li>
            ))}
          </ol>
        </Panel>
      </section>
    </>
  );
}

export function GuideArticle({ page }: { page: GuidePage }) {
  const g = guideBySlug(guideSlug(page));
  if (!g) return null;

  return (
    <>
      <section className="frame frame-wide pb-10 pt-8 sm:pt-12">
        <Panel>
          <Band>
            <BandItem>
              <a href={pathFor('en', 'guides')} className="engraved text-[inherit]">
                Guides
              </a>
            </BandItem>
            <BandItem grow>{g.title}</BandItem>
          </Band>
          <div className="px-5 py-8 sm:px-10 sm:py-11">
            <Heading as="h1" className="text-[clamp(2rem,5.5vw,3.3rem)] text-[var(--ink)]">
              {g.title}
            </Heading>
            <p className="t-lede mt-5 max-w-[48rem] text-pretty text-[var(--ink-soft)]">{g.description}</p>
            <Byline updated={g.updated} />
          </div>
        </Panel>
      </section>

      <section className="frame void">
        <Panel>
          <div className="px-5 py-8 sm:px-10 sm:py-11">
            <div className="grid gap-10 lg:grid-cols-[14rem_minmax(0,1fr)]">
              <nav aria-label="In this guide" className="hidden self-start lg:block">
                <ol className="space-y-2 text-[0.9375rem]">
                  {g.sections.map((s, i) => (
                    <li key={s.heading}>
                      <a href={`#s-${i}`} className="engraved text-[var(--ink-soft)] hover:text-[var(--ink)]">
                        {s.heading}
                      </a>
                    </li>
                  ))}
                  <li>
                    <a href="#questions" className="engraved text-[var(--ink-soft)] hover:text-[var(--ink)]">
                      Questions
                    </a>
                  </li>
                </ol>
              </nav>

              <div>
                {g.sections.map((s, i) => (
                  <section
                    key={s.heading}
                    id={`s-${i}`}
                    className={`scroll-mt-20 border-t py-8 first:border-t-0 first:pt-0 ${rule}`}
                  >
                    <h2 className="t-prose text-[1.5rem] font-semibold text-[var(--ink)]">{s.heading}</h2>
                    {s.body.map((p, j) => (
                      <p key={j} className="t-prose mt-4 max-w-[46rem] text-pretty text-[var(--ink-soft)]">
                        {p}
                      </p>
                    ))}
                    {s.list && (
                      <ul className="t-prose mt-4 max-w-[46rem] list-disc space-y-2 pl-6 text-[var(--ink-soft)]">
                        {s.list.map((item) => (
                          <li key={item} className="text-pretty">
                            {item}
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                ))}

                <section id="questions" className={`scroll-mt-20 border-t py-8 ${rule}`}>
                  <h2 className="t-prose text-[1.5rem] font-semibold text-[var(--ink)]">Questions</h2>
                  <dl className="mt-2">
                    {g.faqs.map((f) => (
                      <div key={f.q} className="mt-6">
                        <dt className="t-prose font-semibold text-[var(--ink)]">{f.q}</dt>
                        <dd className="t-prose mt-2 max-w-[46rem] text-pretty text-[var(--ink-soft)]">{f.a}</dd>
                      </div>
                    ))}
                  </dl>
                </section>

                <div className={`mt-4 flex flex-wrap items-center gap-x-6 gap-y-3 border-t pt-8 ${rule}`}>
                  <a href={pathFor('en', 'for-clinics')} className="engraved text-[var(--ink)]">
                    See the clinic software
                  </a>
                  <a href={pathFor('en', 'guides')} className="engraved text-[var(--ink-faint)]">
                    All guides
                  </a>
                </div>
              </div>
            </div>
          </div>
        </Panel>
      </section>
    </>
  );
}
