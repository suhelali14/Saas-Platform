/**
 * The tops of the three product pages: Clinic, Growth and the Vision.
 *
 * Each opens on a board, like the home page, with the product's name, what
 * it is in two sentences, and where it stands. The standing is the first
 * thing after the name, not the last: somebody deciding whether to read on
 * should know at once whether this is running anywhere.
 *
 * Growth's body is prose in numbered sections because it has no film yet
 * and has to be explained in words. It says so rather than showing a
 * mock-up: every film on this site is a recording of the product.
 */
import type { ReactNode } from 'react';
import { useContent, useContentCtx } from '@/content/use-content';
import { Departures } from '@/components/Departures';
import { productsCopy } from '@/content/products';
import { Band, BandItem, Board, Heading, Panel, Stamp } from '@/components/primitives';

function PageBoard({
  title,
  lede,
  stamp,
  standing,
  action,
  onAction,
  children,
}: {
  title: string;
  lede: string;
  stamp?: string;
  standing: string;
  action?: string;
  onAction?: () => void;
  children?: ReactNode;
}) {
  return (
    <section className="frame frame-wide pb-10 pt-8 sm:pt-12">
      <Board className="px-5 py-8 sm:px-10 sm:py-11 lg:px-14">
        <h1 className="t-board text-[clamp(2.6rem,8vw,5rem)] text-[var(--board-ink)]">{title}</h1>
        <p className="t-lede mt-5 max-w-[52rem] text-pretty text-[var(--board-ink-soft)]">{lede}</p>
        <div className="mt-7 flex flex-wrap items-start gap-x-5 gap-y-3 border-t border-[var(--steel-line)] pt-6">
          {stamp && (
            <span className="t-label shrink-0 border border-[var(--lamp)] px-2 py-1 text-[var(--lamp)]">{stamp}</span>
          )}
          <p className="min-w-0 max-w-[46rem] flex-1 text-sm text-[var(--board-ink-soft)]">{standing}</p>
          {action && onAction && (
            <button type="button" onClick={onAction} className="plate">
              {action}
            </button>
          )}
        </div>
        {children && <div className="mt-8 min-w-0">{children}</div>}
      </Board>
    </section>
  );
}

export function ClinicTop({ onEnquire }: { onEnquire: () => void }) {
  const { readiness } = useContent();
  const { locale } = useContentCtx();
  const { clinicPage } = productsCopy[locale];
  return (
    <PageBoard
      title={clinicPage.title}
      lede={clinicPage.lede}
      stamp={readiness.LIVE}
      standing={clinicPage.liveNote}
      action={clinicPage.action}
      onAction={onEnquire}
    />
  );
}

/** What a clinic gets, in the words the plan pages already use, and how to see it. */
export function ClinicGets({ onEnquire }: { onEnquire: () => void }) {
  const { simplePages } = useContent();
  const { locale } = useContentCtx();
  const { clinicPage, lineup } = productsCopy[locale];
  const gets = simplePages.forClinics.sections.slice(0, 2);
  return (
    <section id="gets" className="frame void">
      <Panel>
        <Band>
          <BandItem>{lineup.clinic.name}</BandItem>
          <BandItem grow>{lineup.clinic.forWhom}</BandItem>
        </Band>
        <div className="px-4 py-7 sm:px-7">
          <Heading>{clinicPage.getsHeading}</Heading>
          <div className="mt-6 grid gap-x-10 gap-y-7 md:grid-cols-2">
            {gets.map((s) => (
              <article key={s.heading}>
                <h3 className="t-board text-[1.3rem] leading-none text-[var(--ink)]">{s.heading}</h3>
                {s.body.map((p) => (
                  <p key={p.slice(0, 24)} className="t-prose mt-3 text-[0.9375rem] text-[var(--ink-soft)]">
                    {p}
                  </p>
                ))}
              </article>
            ))}
          </div>
        </div>
        <div className="rule-total flex flex-wrap items-center justify-between gap-x-8 gap-y-4 px-4 py-6 sm:px-7">
          <div className="max-w-[62ch]">
            <h3 className="t-board text-[1.3rem] leading-none text-[var(--ink)]">{clinicPage.demoHeading}</h3>
            <p className="t-prose mt-2.5 text-sm text-[var(--ink-soft)]">{clinicPage.demoBody}</p>
          </div>
          <button type="button" onClick={onEnquire} className="plate">
            {clinicPage.action}
          </button>
        </div>
      </Panel>
    </section>
  );
}

export function GrowthPage({ onEnquire }: { onEnquire: () => void }) {
  const { locale } = useContentCtx();
  const { growthPage, status, film } = productsCopy[locale];
  return (
    <>
      <PageBoard
        title={growthPage.title}
        lede={growthPage.lede}
        stamp={status.built}
        standing={growthPage.statusNote}
        action={growthPage.action}
        onAction={onEnquire}
      />
      <section className="frame void">
        <Panel>
          <Band>
            <BandItem>{growthPage.sectionsBand}</BandItem>
            <BandItem grow>
              <span data-figures>{growthPage.sections.length}</span>
            </BandItem>
            <BandItem>
              <Stamp>{status.built}</Stamp>
            </BandItem>
          </Band>
          <div className="px-4 py-3 sm:px-7">
            {growthPage.sections.map((s, i) => (
              <article
                key={s.heading}
                className="rule-row grid gap-x-8 gap-y-3 py-7 last:border-b-0 md:grid-cols-[3rem_minmax(0,17rem)_minmax(0,1fr)]"
              >
                <span className="t-row text-[var(--ink-faint)]" data-figures>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h2 className="t-board text-[1.5rem] leading-[1.05] text-[var(--ink)]">{s.heading}</h2>
                <div>
                  {s.body.map((p, j) => (
                    <p key={j} className={'t-prose text-pretty text-[var(--ink-soft)] ' + (j ? 'mt-3.5' : '')}>
                      {p}
                    </p>
                  ))}
                </div>
              </article>
            ))}
          </div>
          <div className="rule-total flex flex-wrap items-center justify-between gap-x-8 gap-y-4 px-4 py-6 sm:px-7">
            <div className="max-w-[62ch]">
              <h3 className="t-board text-[1.3rem] leading-none text-[var(--ink)]">{growthPage.filmHeading}</h3>
              <p className="t-prose mt-2.5 text-sm text-[var(--ink-soft)]">{growthPage.filmNote}</p>
              <p className="sr-only">{film.band}</p>
            </div>
            <button type="button" onClick={onEnquire} className="plate">
              {growthPage.action}
            </button>
          </div>
        </Panel>
      </section>
    </>
  );
}

export function VisionTop() {
  const { locale } = useContentCtx();
  const { visionPage, status } = productsCopy[locale];
  return (
    <PageBoard title={visionPage.title} lede={visionPage.lede} stamp={status.planned} standing={visionPage.note}>
      {/* The split-flap line turns through rows of the chart below it, each
          with the status that row really has. */}
      <Departures />
    </PageBoard>
  );
}
