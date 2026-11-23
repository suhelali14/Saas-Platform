/**
 * The renderer for the ten secondary pages.
 *
 * One component for About, Features, Security, Why Nayaversse, the four
 * per-plan pages, Stories and the Blog. Their shape is identical --
 * headline, lede, sections of heading + body, a closing action -- so there
 * is one page here instead of ten, and a copy edit in content/en.ts shows
 * up without a component change.
 *
 * Everything else is sized for a stranger, not for someone already using
 * the counter: wider measure on the prose than the service chart uses,
 * one column rather than a grid, so the reader is not scanning across the
 * page while they read it.
 */
import { useContent } from '@/content/use-content';
import { content, pathFor, type Locale, type Page } from '@/content/index';
import type { SimplePages } from '@/content/simple-pages';
import { Band, BandItem, Heading, Panel } from '@/components/primitives';

/** Which `simplePages` key renders which Page. */
const PAGE_TO_KEY: Partial<Record<Page, keyof SimplePages>> = {
  about: 'about',
  founder: 'founder',
  features: 'features',
  security: 'security',
  'why-nayaversse': 'whyNayaversse',
  'for-clinics': 'forClinics',
  'for-polyclinics': 'forPolyclinics',
  'for-hospitals': 'forHospitals',
  'for-multi-specialty': 'forMultiSpecialty',
  stories: 'stories',
  blog: 'blog',
};

export function pageToSimpleKey(page: Page): keyof SimplePages | undefined {
  return PAGE_TO_KEY[page];
}

/** The band title shown on each page -- the generic label, same shape as
 *  every other section's band on this site. */
const BAND_TITLE: Record<Locale, string> = {
  en: 'Chart',
  hi: 'सूची',
  mr: 'यादी',
};

export function SimplePage({ locale, page }: { locale: Locale; page: Page }) {
  const t = useContent();
  const key = pageToSimpleKey(page);
  if (!key) return null;
  const copy = t.simplePages[key];
  const bandTitle = BAND_TITLE[locale];

  return (
    <>
      <section className="frame frame-wide pb-10 pt-8 sm:pt-12">
        <Panel>
          <Band>
            <BandItem>{bandTitle}</BandItem>
            <BandItem grow>{copy.title}</BandItem>
          </Band>
          <div className="px-5 py-8 sm:px-10 sm:py-11">
            <Heading as="h1" className="text-[clamp(2.2rem,6vw,3.6rem)] text-[var(--ink)]">
              {copy.title}
            </Heading>
            <p className="t-lede mt-5 max-w-[48rem] text-pretty text-[var(--ink-soft)]">
              {copy.lede}
            </p>
          </div>
        </Panel>
      </section>

      <section className="frame void">
        <Panel>
          <div className="px-5 py-8 sm:px-10 sm:py-11">
            <div className="grid gap-10 lg:grid-cols-[14rem_minmax(0,1fr)]">
              {/* A left rail of jump links, so long-form pages are
                  navigable on the way down. On small screens the rail
                  collapses to nothing; the reader just scrolls. */}
              <nav aria-label="Sections" className="hidden self-start lg:block">
                <ol className="space-y-2 text-[0.9375rem]">
                  {copy.sections.map((s, i) => (
                    <li key={s.heading}>
                      <a
                        href={`#s-${i}`}
                        className="engraved text-[var(--ink-soft)] hover:text-[var(--ink)]"
                      >
                        {s.heading}
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>

              <div>
                {copy.sections.map((s, i) => (
                  <article
                    key={s.heading}
                    id={`s-${i}`}
                    className="scroll-mt-20 border-t border-[color-mix(in_srgb,var(--rule)_22%,transparent)] py-8 first:border-t-0 first:pt-0"
                  >
                    <h2 className="t-prose text-[1.5rem] font-semibold text-[var(--ink)]">
                      {s.heading}
                    </h2>
                    {s.body.map((p, j) => (
                      <p
                        key={j}
                        className="t-prose mt-4 max-w-[46rem] text-pretty text-[var(--ink-soft)]"
                      >
                        {p}
                      </p>
                    ))}
                  </article>
                ))}

                <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-[color-mix(in_srgb,var(--rule)_22%,transparent)] pt-8">
                  <a href={copy.cta.href} className="engraved text-[var(--ink)]">
                    {copy.cta.label}
                  </a>
                  <a
                    href={pathFor(locale, 'home')}
                    className="engraved text-[var(--ink-faint)]"
                  >
                    {content[locale].notFound.chart}
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
