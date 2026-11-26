/**
 * The five pages of the redesigned site. Status words come from the same
 * places the build checks (scripts/prerender.mjs): the service chart's
 * readiness words, and productsCopy's Built / In trial.
 */
import type { ReactNode } from 'react';
import { groupOrder, healthClasses, serviceRows } from '@/content/structure';
import { growthFilm } from '@/content/products';
import { prices, rupees } from '@/content/site';
import { Player } from '@/sections/Films';
import { DayCharts } from '@/sections/DayCharts';
import { About, Arrow, AssistantFilms, Enquiry, FilmsBand, Lean, Pill, PlayLink, Questions, Rise, Shot, Stepper, useSite } from './parts';
import type { ShotName } from './shots';

function Sec({ tone = 'white', id, children }: { tone?: 'white' | 'alt' | 'dark'; id?: string; children: ReactNode }) {
  return (
    <section id={id} className={`v-sec v-${tone}`}>
      <div className="v-wrap">{children}</div>
    </section>
  );
}

function Head({ h, lede }: { h: ReactNode; lede?: ReactNode }) {
  return (
    <Rise>
      <h2 className="v-h2">{h}</h2>
      {lede && <p className="v-lead">{lede}</p>}
    </Rise>
  );
}

function From({ n, custom }: { n?: number; custom?: boolean }) {
  const { s } = useSite();
  return (
    <p className="v-price m-0">
      {custom ? (
        s.money.custom
      ) : (
        <>
          <small>{s.money.from} </small>
          {rupees(n!)} <small>{s.money.perMonth}</small>
        </>
      )}
    </p>
  );
}

function Screen({ name, alt, caption, crop, bar }: { name: ShotName; alt: string; caption?: string; crop?: number; bar?: ReactNode }) {
  return (
    <figure className="m-0">
      <Lean>
        <div className="v-shot">
          {bar && <div className="v-shot-bar">{bar}</div>}
          <Shot name={name} alt={alt} crop={crop} style={{ width: '100%' }} />
        </div>
      </Lean>
      {caption && <figcaption className="v-cap">{caption}</figcaption>}
    </figure>
  );
}

function useDifferent() {
  const { s, p } = useSite();
  const shots: ShotName[] = ['d-queue', 'd-listening', 'visit-draft', 'site-mr'];
  return s.different.items.map((it, i) => ({ ...it, shot: shots[i]!, tag: i === 1 ? <Pill kind="trial">{p.status.trial}</Pill> : undefined }));
}

/* ======================================================================= home */

export function HomePage() {
  const { t, s, p, href } = useSite();
  const different = useDifferent();
  const counts = { LIVE: 0, BUILDING: 0, WAITLIST: 0 };
  for (const r of serviceRows) counts[r.status]++;
  return (
    <>
      <section className="v-white overflow-hidden">
        <div className="v-wrap pt-16 sm:pt-24">
          <h1 className="v-h1 max-w-[980px]">
            {s.hero.before}
            <span className="v-accent">{s.hero.accent}</span>
            {s.hero.after}
          </h1>
          <p className="v-lead text-[19px]">{s.hero.lede}</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <a href="#enquiry" className="v-btn">
              {s.hero.book}
            </a>
            <PlayLink>{s.hero.films}</PlayLink>
          </div>
          <Lean className="mt-16 pb-20 sm:pb-28" max={4}>
            <div className="v-book">
              <a href={href('clinic')}>
                <figure className="v-shot">
                  <figcaption className="v-shot-bar">
                    <span>
                      <span className="v-h3 block text-[19px]">{p.lineup.clinic.name}</span>
                      <span className="v-small">{s.hero.clinicLine}</span>
                    </span>
                    <Pill kind="live">{t.readiness.LIVE}</Pill>
                  </figcaption>
                  <Shot name="queue" alt={s.different.items[0]!.alt} priority />
                </figure>
              </a>
              <a href={href('growth')}>
                <figure className="v-shot">
                  <figcaption className="v-shot-bar">
                    <span>
                      <span className="v-h3 block text-[19px]">{p.lineup.growth.name}</span>
                      <span className="v-small">{s.hero.growthLine}</span>
                    </span>
                    <Pill kind="built">{p.status.built}</Pill>
                  </figcaption>
                  <Shot name="growth-home" alt={s.growthHow.caption} priority />
                </figure>
              </a>
            </div>
          </Lean>
        </div>
      </section>

      <section className="v-white">
        <div className="v-wrap">
          <div className="v-facts">
            {s.facts.map((f) => (
              <div key={f.title}>
                <div className="v-h3 text-[20px]">{f.title}</div>
                <p className="v-small mt-1.5 mb-0">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Sec tone="alt" id="products">
        <Head h={s.products.heading} lede={s.products.lede} />
        <div className="v-grid2 mt-12">
          <Rise className="v-card flex flex-col">
            <Pill kind="live">{t.readiness.LIVE}</Pill>
            <h3 className="v-h3 mt-4 text-[26px]">{p.lineup.clinic.name}</h3>
            <p className="v-small mt-1">{p.lineup.clinic.forWhom}</p>
            <p className="mt-3 text-[16px]">{p.lineup.clinic.body}</p>
            <div className="mt-3">
              <From n={prices.clinicClasses[0]} />
            </div>
            <ul className="v-ticks">
              {p.lineup.clinic.points.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
            <p className="v-small mt-3">{p.lineup.clinic.stands}</p>
            <a href={href('clinic')} className="v-link mt-auto pt-2">
              {s.clinic.more} <Arrow />
            </a>
          </Rise>
          <Rise className="v-card flex flex-col" delay={0.06}>
            <Pill kind="built">{p.status.built}</Pill>
            <h3 className="v-h3 mt-4 text-[26px]">{p.lineup.growth.name}</h3>
            <p className="v-small mt-1">{s.products.growthFor}</p>
            <p className="mt-3 text-[16px]">{s.products.growthLine}</p>
            <div className="mt-3">
              <From n={prices.growthFrom} />
            </div>
            <ul className="v-ticks">
              {s.products.growthPoints.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
            <p className="v-small mt-3">{p.lineup.growth.stands}</p>
            <a href={href('growth')} className="v-link mt-auto pt-2">
              {s.growthHow.more} <Arrow />
            </a>
          </Rise>
        </div>
      </Sec>

      <Sec>
        <Head h={s.different.heading} lede={s.different.lede} />
        <Stepper items={different} />
      </Sec>

      <Sec tone="alt">
        <Rise>
          <p className="m-0 flex flex-wrap items-center gap-2">
            <Pill kind="trial">{p.status.trial}</Pill>
            <span className="v-small">{s.assistant.pill}</span>
          </p>
          <h2 className="v-h2 mt-4">{s.assistant.heading}</h2>
          <p className="v-lead">{s.assistant.lede}</p>
        </Rise>
        <AssistantFilms />
        <p className="v-small mt-6 max-w-[720px]">{p.film.trialNote}</p>
      </Sec>

      <Sec id="growth-how">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <div>
            <Rise>
              <Pill kind="built">{p.status.built}</Pill>
              <h2 className="v-h2 mt-4">{s.growthHow.heading}</h2>
              <p className="v-lead">{s.growthHow.lede}</p>
            </Rise>
            <ol className="m-0 mt-8 list-none p-0">
              {s.growthHow.steps.map((st, i) => (
                <li key={st.title} className="flex gap-4 border-t border-[var(--v-line)] py-4">
                  <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-[var(--v-ink)] text-[14px] font-bold text-white">{i + 1}</span>
                  <span>
                    <strong className="block font-semibold">{st.title}</strong>
                    <span className="text-[15px] text-[var(--v-body)]">{st.text}</span>
                  </span>
                </li>
              ))}
            </ol>
            <a href={href('growth')} className="v-link mt-2">
              {s.growthHow.more} <Arrow />
            </a>
          </div>
          <Screen name="growth-statement" alt={s.growth.statementCaption} caption={s.growthHow.caption} />
        </div>
      </Sec>

      <FilmsBand />
      <About />

      <Sec>
        <div className="flex flex-wrap items-end justify-between gap-8">
          <Head h={s.visionTeaser.heading} lede={s.visionTeaser.lede} />
          <div className="flex flex-wrap items-center gap-2">
            <Pill kind="live">
              {counts.LIVE} {t.readiness.LIVE}
            </Pill>
            <Pill kind="building">
              {counts.BUILDING} {t.readiness.BUILDING}
            </Pill>
            <Pill kind="waitlist">
              {counts.WAITLIST} {t.readiness.WAITLIST}
            </Pill>
          </div>
        </div>
        <a href={href('vision')} className="v-btn-ghost mt-8">
          {s.visionTeaser.link} <Arrow />
        </a>
      </Sec>

      <Questions />
      <Enquiry />
    </>
  );
}

/* ===================================================================== clinic */

function Classes() {
  const { t, s, p, href } = useSite();
  return (
    <Sec>
      <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div>
          <Head h={s.clinic.classesHeading} lede={s.clinic.classesLede} />
          <div className="v-rules mt-9">
            {t.healthLine.classes.map((c, i) => (
              <div key={c.klass} className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
                <span className="v-h3 w-[150px] flex-none text-[18px]">{c.klass}</span>
                <span className="min-w-0 flex-[1_1_220px] text-[15px] text-[var(--v-body)]">{c.forWhom}</span>
                <From n={prices.clinicClasses[i]} />
                {healthClasses[i]?.live ? <Pill kind="live">{t.readiness.LIVE}</Pill> : <Pill kind="built">{p.status.built}</Pill>}
              </div>
            ))}
          </div>
          <a href={href('pricing')} className="v-link mt-4">
            {s.clinic.pricingLink} <Arrow />
          </a>
        </div>
        <div className="v-stack" aria-hidden="true">
          <div className="v-stack-in">
            {t.healthLine.classes.map((c, i) => (
              <div key={c.klass} className={`v-slab ${healthClasses[i]?.live ? 'v-slab-live' : ''}`} style={{ ['--z' as string]: `${i * 52}px` }}>
                {c.klass}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Sec>
  );
}

function Ledger() {
  const { t } = useSite();
  return (
    <Sec tone="alt">
      <Head h={t.growth.heading + '.'} lede={t.growth.lede} />
      <div className="v-table mt-12">
        <div className="v-table-row v-table-head">
          <span>{t.growth.colLeak}</span>
          <span>{t.growth.colFix}</span>
          <span>{t.growth.colRemoves}</span>
        </div>
        {t.growth.rows.map((r) => (
          <div key={r.leak} className="v-table-row">
            <span className="v-h3 text-[17px]">{r.leak}</span>
            <span className="text-[15px] text-[var(--v-body)]" data-label={t.growth.colFix}>
              {r.fix}
            </span>
            <span className="text-[14px] font-semibold" data-label={t.growth.colRemoves}>
              {r.removes}
            </span>
          </div>
        ))}
      </div>
      <p className="v-small mt-5 max-w-[760px]">{t.growth.honesty}</p>
    </Sec>
  );
}

export function ClinicPage() {
  const { t, s, p, locale } = useSite();
  const different = useDifferent();
  const gets: [ShotName, string][] = [
    ['patient', p.lineup.clinic.points[1]!],
    ['billing', p.lineup.clinic.points[2]!],
    ['pharmacy', p.lineup.clinic.points[2]!],
    ['livequeue', p.lineup.clinic.points[3]!],
  ];
  return (
    <>
      <section className="v-white overflow-hidden">
        <div className="v-wrap pt-16 sm:pt-24">
          <div className="flex flex-wrap items-center gap-3">
            <Pill kind="live">{t.readiness.LIVE}</Pill>
            <span className="v-small">{p.clinicPage.title}</span>
          </div>
          <h1 className="v-h1 mt-5 max-w-[980px]">
            {p.hero.headline[0]} <span className="v-accent">{p.hero.headline[1]}</span> {p.hero.headline[2]}
          </h1>
          <p className="v-lead text-[19px]">{p.clinicPage.lede}</p>
          <p className="v-small mt-3 max-w-[680px]">{p.clinicPage.liveNote}</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <a href="#enquiry" className="v-btn">
              {p.clinicPage.action}
            </a>
            <PlayLink>{s.hero.films}</PlayLink>
          </div>
          <div className="mt-16 pb-20 sm:pb-28">
            <Screen name="queue" alt={s.different.items[0]!.alt} />
          </div>
        </div>
      </section>

      <Sec tone="alt">
        <Head h={s.different.heading} lede={s.different.lede} />
        <Stepper items={different} />
      </Sec>

      <Sec>
        <Head h={p.clinicPage.getsHeading + '.'} lede={p.lineup.clinic.body} />
        <div className="v-grid2 mt-12">
          {gets.map(([name, alt], i) => (
            <Rise key={name} delay={(i % 2) * 0.06}>
              <div className="v-shot">
                <Shot name={name} alt={alt} crop={300} style={{ width: '100%' }} />
              </div>
              <p className="mt-4 text-[15px] text-[var(--v-body)]">{alt}</p>
            </Rise>
          ))}
        </div>
      </Sec>

      <Ledger />

      <Sec>
        <Rise>
          <p className="m-0 flex flex-wrap items-center gap-2">
            <Pill kind="trial">{p.status.trial}</Pill>
            <span className="v-small">{s.assistant.pill}</span>
          </p>
          <h2 className="v-h2 mt-4">{p.film.assistantHeading}</h2>
          <p className="v-lead">{p.film.assistantLede}</p>
        </Rise>
        <AssistantFilms />
      </Sec>

      <section id="films" className="v-sec v-dark">
        <div className="v-wrap">
          <Head h={p.film.clinicHeading + '.'} lede={p.film.clinicLede} />
          <div className="v-film mt-10">
            <Player src={`/video/clinic-${locale}.mp4`} poster="/video/clinic.jpg" label={p.film.clinicHeading} play={p.film.play} ratio="16 / 9" />
          </div>
        </div>
      </section>

      <Classes />
      <Sec tone="alt">
        <p className="v-small m-0 max-w-[760px]">{t.healthLine.honesty}</p>
      </Sec>
      <Enquiry about={0} />
    </>
  );
}

/* ===================================================================== growth */

export function GrowthPage() {
  const { s, p, href } = useSite();
  const g = s.growth;
  return (
    <>
      <section className="v-white overflow-hidden">
        <div className="v-wrap pt-16 sm:pt-24">
          <div className="flex flex-wrap items-end justify-between gap-10">
            <div className="min-w-0 flex-[1_1_560px]">
              <div className="flex flex-wrap items-center gap-3">
                <Pill kind="built">{p.status.built}</Pill>
                <span className="v-small">{p.growthPage.title}</span>
              </div>
              <h1 className="v-h1 mt-5">
                {g.before}
                <span className="v-accent">{g.accent}</span>
                {g.after}
              </h1>
              <p className="v-lead text-[19px]">{g.lede}</p>
              <div className="mt-9 flex flex-wrap gap-3">
                <a href="#enquiry" className="v-btn">
                  {g.pilot}
                </a>
                <PlayLink>{s.hero.films}</PlayLink>
              </div>
            </div>
            <div className="v-card max-w-[380px] flex-[1_1_300px] p-6">
              <div className="v-h3 text-[21px]">{g.standsTitle}</div>
              <p className="mb-0 mt-2 text-[15px] text-[var(--v-body)]">{g.standsText}</p>
            </div>
          </div>
          <div className="mx-auto mt-16 max-w-[820px] pb-20 sm:pb-28">
            <Screen name="growth-statement" alt={g.statementCaption} caption={g.statementCaption} />
          </div>
        </div>
      </section>

      <Sec tone="alt">
        <Head h={g.firmHeading} lede={g.firmLede} />
        <Rise className="v-table mt-12">
          <div className="v-table-row v-table-head">
            <span />
            <span>{g.colFirm}</span>
            <span>{g.colUs}</span>
          </div>
          {g.firm.map(([job, firm, us]) => (
            <div key={job} className="v-table-row">
              <span className="v-h3 text-[17px]">{job}</span>
              <span className="text-[15px] text-[var(--v-muted)]" data-label={g.colFirm}>
                {firm}
              </span>
              <span className="text-[15px]" data-label={g.colUs}>
                {us}
              </span>
            </div>
          ))}
        </Rise>
      </Sec>

      <Sec>
        <Head h={g.waysHeading} lede={g.waysLede} />
        <div className="v-grid2 mt-12">
          {g.ways.map((w, i) => (
            <Rise key={w.kicker} className="v-card" delay={i * 0.06}>
              <p className="m-0 text-[14px] font-semibold text-[var(--v-accent)]">{w.kicker}</p>
              <h3 className="v-h3 mt-2 text-[26px]">{w.title}</h3>
              <p className="mt-3 text-[16px] text-[var(--v-body)]">{w.text}</p>
              <ul className="v-ticks">
                {w.points.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </Rise>
          ))}
        </div>
        <p className="mt-8 max-w-[780px] text-[16px] text-[var(--v-muted)]">{g.waysRule}</p>
      </Sec>

      <Sec tone="alt">
        <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div>
            <Head h={g.shownHeading} lede={g.shownLede} />
            <div className="v-rules mt-9">
              {g.shown.map((x) => (
                <div key={x.q}>
                  <h3 className="v-h3">{x.q}</h3>
                  <p className="mb-0 mt-2 text-[15px] text-[var(--v-body)]">{x.a}</p>
                </div>
              ))}
            </div>
          </div>
          <Screen name="growth-home" alt={s.growthHow.caption} caption={s.growthHow.caption} />
        </div>
      </Sec>

      <Sec>
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div>
            <Head h={g.proofHeading} />
            {g.proof.map((x) => (
              <p key={x} className="mt-5 text-[17px] text-[var(--v-body)]">
                {x}
              </p>
            ))}
          </div>
          <Screen name="growth-proof" alt={g.proof[0]!} />
        </div>
      </Sec>

      <Sec tone="alt">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div>
            <Head h={g.repliesHeading} lede={g.repliesLede} />
            <ul className="v-ticks mt-8">
              {g.replies.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
          <Screen name="growth-autoreply" alt={g.repliesCaption} caption={g.repliesCaption} />
        </div>
      </Sec>

      <Sec>
        <Head h={g.whyHeading} lede={g.whyLede} />
        <div className="v-qs mt-12">
          {g.why.map((x) => (
            <div key={x.t}>
              <h3 className="v-h3">{x.t}</h3>
              <p>{x.d}</p>
            </div>
          ))}
        </div>
        <Rise className="mt-14 flex flex-wrap items-center justify-between gap-6 rounded-[20px] bg-[var(--v-alt)] p-8">
          <div className="min-w-0 flex-[1_1_420px]">
            <div className="text-[34px]">
              <From n={prices.growthFrom} />
            </div>
            <p className="mb-0 mt-2 max-w-[560px] text-[16px] text-[var(--v-body)]">{g.priceNote}</p>
          </div>
          <a href={href('pricing')} className="v-btn">
            {g.seePricing}
          </a>
        </Rise>
      </Sec>

      <section id="films" className="v-sec v-dark">
        <div className="v-wrap">
          <Head h={s.films.growth} lede={s.films.growthNote} />
          <div className="v-film mt-10">
            <Player src={growthFilm.src} poster={growthFilm.poster} label={s.films.growth} play={p.film.play} ratio="16 / 9" />
          </div>
        </div>
      </section>

      <Sec tone="alt">
        <Head h={g.standingHeading} />
        <div className="v-grid3 mt-10">
          {g.standing.map((x) => (
            <Rise key={x.t} className="v-card">
              <h3 className="v-h3">{x.t}</h3>
              <p className="mb-0 mt-2 text-[15px] text-[var(--v-body)]">{x.d}</p>
            </Rise>
          ))}
        </div>
      </Sec>

      <Enquiry heading={g.pilotHeading} lede={g.pilotLede} about={1} />
    </>
  );
}

/* ===================================================================== vision */

const toneOf = { LIVE: 'serving', BUILDING: 'waiting', WAITLIST: 'done' } as const;
const pillOf = { LIVE: 'live', BUILDING: 'building', WAITLIST: 'waitlist' } as const;

export function VisionPage() {
  const { t, p } = useSite();
  return (
    <>
      <section className="v-white">
        <div className="v-wrap pb-16 pt-16 sm:pt-24">
          <h1 className="v-h1 max-w-[900px]">{p.visionPage.title}.</h1>
          <p className="v-lead text-[19px]">{p.visionPage.lede}</p>
          <p className="v-small mt-4 max-w-[680px]">{p.visionPage.note}</p>
        </div>
      </section>

      <Sec tone="alt">
        <Head h={t.servicePanel.heading + '.'} lede={t.servicePanel.lede} />
        <div className="mt-12 rounded-[20px] border border-[var(--v-line)] bg-white px-5 sm:px-8">
          {groupOrder.map((g, gi) => {
            const rows = serviceRows.filter((r) => r.group === g);
            if (!rows.length) return null;
            return (
              <div key={g} className={`flex flex-wrap gap-x-8 py-5 ${gi ? 'border-t border-[var(--v-ink)]' : ''}`}>
                <h3 className="v-h3 w-[170px] flex-none py-3 text-[20px]">{t.groups[g]}</h3>
                <div className="min-w-0 flex-[1_1_520px]">
                  {rows.map((r, i) => (
                    <div key={r.code} className={`flex flex-wrap items-baseline gap-x-6 gap-y-1 py-3 ${i ? 'border-t border-[var(--v-line)]' : ''}`}>
                      <span className="w-[210px] flex-none font-semibold">{t.services[r.code as keyof typeof t.services].name}</span>
                      <span className="min-w-0 flex-[1_1_300px] text-[15px] text-[var(--v-body)]">{t.services[r.code as keyof typeof t.services].detail}</span>
                      <span className={`cell cell-wide cell-${toneOf[r.status]} v-pill v-status v-pill-${pillOf[r.status] === 'live' ? 'live' : pillOf[r.status] === 'building' ? 'trial' : 'wait'}`}>
                        {t.readiness[r.status]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-6 grid gap-3 text-[14px] text-[var(--v-muted)] md:grid-cols-3">
          {(['LIVE', 'BUILDING', 'WAITLIST'] as const).map((k) => (
            <p key={k} className="m-0">
              <strong className="text-[var(--v-ink)]">{t.readiness[k]}.</strong> {t.readinessMeaning[k]}
            </p>
          ))}
        </div>
      </Sec>

      <div className="v-white py-10">
        <DayCharts />
      </div>

      <Sec tone="alt">
        <Head h={t.routePanel.heading} lede={t.routePanel.lede} />
        <ol className="mt-12 grid list-none gap-0 border-t border-[var(--v-ink)] p-0 sm:grid-cols-2 lg:grid-cols-3">
          {t.routePanel.stops.map((x, i) => (
            <li key={x} className="border-b border-[var(--v-line)] py-6 pr-6">
              <span className="v-h3 text-[var(--v-accent)]">{i + 1}</span>
              <p className="mb-0 mt-2 text-[15px] text-[var(--v-body)]">{x}</p>
            </li>
          ))}
        </ol>
        <p className="v-small mt-5">{t.routePanel.note}</p>
      </Sec>

      <Sec>
        <Head h={t.manifestPanel.heading + '.'} lede={t.manifestPanel.lede} />
        <div className="v-rules mt-12">
          {t.manifest.map((grp) => (
            <div key={grp.heading} className="flex flex-wrap gap-x-14 gap-y-4">
              <div className="w-[260px] flex-none">
                <h3 className="v-h3 text-[22px]">{grp.heading}</h3>
                <p className="v-small mt-2">{grp.note}</p>
              </div>
              <div className="grid min-w-0 flex-[1_1_520px] gap-x-10 gap-y-5 sm:grid-cols-2">
                {grp.items.map((it) => (
                  <div key={it.name}>
                    <div className="font-semibold">{it.name}</div>
                    <p className="mb-0 mt-1 text-[15px] text-[var(--v-body)]">{it.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Sec>

      <Sec tone="alt">
        <Head h={t.servicesOffer.heading + '.'} lede={t.servicesOffer.lede} />
        <div className="v-qs mt-12">
          {t.servicesOffer.included.map((x) => (
            <div key={x.name}>
              <h3 className="v-h3">{x.name}</h3>
              <p>{x.detail}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap gap-x-16 gap-y-6 rounded-[20px] bg-white p-8">
          <div className="min-w-0 flex-[1_1_420px]">
            {t.servicesOffer.availability.map((a, i) => (
              <div key={a.klass} className={`flex flex-wrap items-baseline gap-x-6 py-3 ${i ? 'border-t border-[var(--v-line)]' : ''}`}>
                <span className="v-h3 w-[170px] flex-none text-[17px]">{a.klass}</span>
                <span className="text-[15px] text-[var(--v-body)]">{a.what}</span>
              </div>
            ))}
          </div>
          <p className="m-0 min-w-0 flex-[1_1_300px] self-center text-[15px] text-[var(--v-body)]">{t.servicesOffer.honesty}</p>
        </div>
      </Sec>

      <Sec>
        <Head h={t.farePanel.heading + '.'} lede={t.farePanel.lede} />
        <div className="v-rules mt-12">
          {t.fares.map((f) => (
            <div key={f.code} className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
              <span className="v-h3 w-[180px] flex-none text-[19px]">{f.klass}</span>
              <span className="min-w-0 flex-[1_1_320px] text-[15px] text-[var(--v-body)]">
                {f.forWhom} <span className="text-[var(--v-muted)]">{f.size}.</span>
                <span className="mt-1 block text-[14px] text-[var(--v-muted)]">{f.includes}</span>
              </span>
              <span className="v-price">
                {f.fare} <small>{f.period}</small>
              </span>
            </div>
          ))}
        </div>
        <p className="v-small mt-5 max-w-[760px]">{t.farePanel.note}</p>
      </Sec>

      <Enquiry about={3} />
    </>
  );
}

/* ==================================================================== pricing */

export function PricingPage() {
  const { t, s, p, href } = useSite();
  const pr = s.pricing;
  return (
    <>
      <section className="v-white">
        <div className="v-wrap pb-16 pt-16 sm:pt-24">
          <h1 className="v-h1">{pr.title}</h1>
          <p className="v-lead text-[19px]">{pr.lede}</p>
        </div>
      </section>

      <Sec tone="alt">
        <Head h={pr.clinicHeading} lede={pr.clinicLede} />
        <div className="v-grid3 mt-12">
          {t.healthLine.classes.map((c, i) => (
            <Rise key={c.klass} className="v-card flex flex-col" delay={(i % 3) * 0.05}>
              <div className="flex items-center justify-between gap-3">
                <h3 className="v-h3 text-[24px]">{c.klass}</h3>
                {healthClasses[i]?.live ? <Pill kind="live">{t.readiness.LIVE}</Pill> : <Pill kind="built">{p.status.built}</Pill>}
              </div>
              <p className="v-small mt-1">{c.forWhom}</p>
              <div className="mt-4">
                <From n={prices.clinicClasses[i]} />
              </div>
              <p className="mt-4 text-[15px] text-[var(--v-body)]">{c.carries}</p>
              <p className="v-small mt-auto pt-3">{c.stands}</p>
            </Rise>
          ))}
          <Rise className="v-card flex flex-col">
            <h3 className="v-h3 text-[24px]">{s.money.custom}</h3>
            <p className="v-small mt-1">{pr.customFor}</p>
            <a href="#enquiry" className="v-btn mt-auto">
              {s.nav.book}
            </a>
          </Rise>
        </div>
        <p className="v-small mt-6 max-w-[760px]">{t.healthLine.honesty}</p>
      </Sec>

      <Sec>
        <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <Pill kind="built">{p.status.built}</Pill>
            <h2 className="v-h2 mt-4">{pr.growthHeading}</h2>
            <p className="v-lead">{pr.growthLede}</p>
            <div className="mt-6 text-[34px]">
              <From n={prices.growthFrom} />
            </div>
            <p className="v-small mt-2 max-w-[520px]">{s.growth.priceNote}</p>
            <a href={href('growth')} className="v-link mt-3">
              {s.growthHow.more} <Arrow />
            </a>
          </div>
          <ul className="v-ticks m-0">
            {pr.growthPoints.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
      </Sec>

      <Sec tone="alt">
        <Head h={pr.howHeading} />
        <div className="v-qs mt-10">
          {pr.how.map((x) => (
            <div key={x.t}>
              <h3 className="v-h3">{x.t}</h3>
              <p>{x.d}</p>
            </div>
          ))}
        </div>
      </Sec>

      <Sec>
        <div className="flex flex-wrap items-end justify-between gap-8">
          <Head h={pr.platformHeading} lede={pr.platformLede} />
          <a href={href('vision')} className="v-btn-ghost">
            {pr.platformLink} <Arrow />
          </a>
        </div>
      </Sec>

      <About />
      <Questions />
      <Enquiry />
    </>
  );
}
