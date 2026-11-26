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
import { About, Arrow, AssistantFilms, Enquiry, FilmsBand, Frame, Lean, Pill, PlayLink, Questions, Rise, Shot, Stepper, useSite } from './parts';
import type { ShotName } from './shots';
import { Arm, Deck, Marquee, Parallax, SideIn, Stage3D, Tilt, Words, scr } from './motion';

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

/** A product screen in its frame. It tips up into place as it is scrolled to,
 *  and can carry a smaller screen floating over one corner, which moves at
 *  its own speed so the two read as layers. */
function Screen({ name, alt, caption, crop, title, float, phone }: { name: ShotName; alt: string; caption?: string; crop?: number; title?: ReactNode; float?: { name: ShotName; side: 'left' | 'right'; crop?: number }; /** the same screen captured at a phone's width */ phone?: ShotName }) {
  return (
    <figure className="v-screen m-0">
      <Tilt>
        <Lean>
          <Frame title={title}>
            {phone ? (
              <>
                <span className="v-only-desk block">
                  <Shot name={name} alt={alt} crop={crop} style={{ width: '100%' }} />
                </span>
                <span className="v-only-phone block">
                  <Shot name={phone} alt={alt} style={{ width: '100%' }} />
                </span>
              </>
            ) : (
              <Shot name={name} alt={alt} crop={crop} style={{ width: '100%' }} />
            )}
          </Frame>
        </Lean>
      </Tilt>
      {float && (
        <Parallax speed={-0.45} className={`v-float v-float-${float.side}`}>
          <Frame>
            <Shot name={float.name} alt="" crop={float.crop} style={{ width: '100%' }} />
          </Frame>
        </Parallax>
      )}
      {caption && <figcaption className="v-cap">{caption}</figcaption>}
    </figure>
  );
}

function useDifferent() {
  const { s, p } = useSite();
  const shots: ShotName[] = ['d-queue', 'd-listening', 'visit-draft', 'site-mr'];
  const whole: ShotName[] = ['queue', 'listening', 'visit-draft', 'site-mr'];
  return s.different.items.map((it, i) => ({ ...it, shot: shots[i]!, wide: whole[i]!, tag: i === 1 ? <Pill kind="trial">{p.status.trial}</Pill> : undefined }));
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
        <div className="v-wrap pt-12 sm:pt-16">
          <Words
            className="max-w-[980px]"
            parts={[
              [s.hero.before, false],
              [s.hero.accent, true],
              [s.hero.after, false],
            ]}
          />
          <p className="v-lead v-hero-in text-[19px]" style={{ animationDelay: '0.45s' }}>
            {s.hero.lede}
          </p>
          <div className="v-hero-in mt-9 flex flex-wrap gap-3" style={{ animationDelay: '0.58s' }}>
            <a href="#enquiry" className="v-btn v-only-desk">
              {s.hero.book}
            </a>
            <PlayLink>{s.hero.films}</PlayLink>
          </div>
          <div className="v-only-phone mt-8 pb-14">
            <Deck
              label={s.products.heading}
              cards={[
                { shot: 'd-queue', title: p.lineup.clinic.name, tag: <Pill kind="live">{t.readiness.LIVE}</Pill>, alt: s.different.items[0]!.alt, href: href('clinic') },
                { shot: 'd-growth', title: p.lineup.growth.name, tag: <Pill kind="built">{p.status.built}</Pill>, alt: s.growthHow.caption, href: href('growth') },
                { shot: 'd-assistant', title: s.assistant.heading, tag: <Pill kind="trial">{p.status.trial}</Pill>, alt: s.assistant.lede },
              ]}
            />
          </div>
          <Stage3D
            hint={s.hero.stageHint}
            className="v-hero-stage v-only-desk v-hero-in mt-10"
            screens={[
              // Two wheels, one per product. In each, the first screen is in
              // front and the rest follow in the order they come round: on a
              // turn (a press, or every few seconds by itself) each one moves
              // to the next place and a new one arrives in front.
              scr('queue', 7.0, [-3.78, -0.3, 0], [0, 0.15, 0], { href: href('clinic'), main: true, group: 0 }),
              scr('site-mr', 2.5, [-1.7, 2.5, -6.5], undefined, { crop: 0.9, group: 0 }),
              scr('rx', 3.0, [-5.5, 2.25, -3.2], [0, 0.2, 0.02], { group: 0 }),
              scr('listening', 2.9, [-10.4, -0.1, -2.2], [0, 0.32, 0], { crop: 0.78, group: 0 }),
              scr('growth-home', 7.0, [3.78, -0.3, 0], [0, -0.15, 0], { href: href('growth'), main: true, crop: 0.65, group: 1 }),
              scr('growth-customers', 2.5, [1.7, 2.5, -6.5], undefined, { crop: 0.76, group: 1 }),
              scr('growth-autoreply', 3.4, [5.6, 2.3, -3.6], [0, -0.2, -0.02], { group: 1 }),
              scr('growth-proof', 3.0, [10.5, 0, -2.6], [0, -0.32, 0], { crop: 0.76, group: 1 }),
            ]}
            labels={
              <>
                <a href={href('clinic')} data-label="">
                  <span className="v-h3 text-[16px]">{p.lineup.clinic.name}</span>
                  <Pill kind="live">{t.readiness.LIVE}</Pill>
                </a>
                <a href={href('growth')} data-label="">
                  <span className="v-h3 text-[16px]">{p.lineup.growth.name}</span>
                  <Pill kind="built">{p.status.built}</Pill>
                </a>
              </>
            }
          >
          <Lean max={4}>
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
          </Stage3D>
        </div>
      </section>

      <section className="v-white">
        <div className="v-wrap">
          <Rise className="v-facts" each>
            {s.facts.map((f) => (
              <div key={f.title}>
                <div className="v-h3 text-[20px]">{f.title}</div>
                <p className="v-small mt-1.5 mb-0">{f.text}</p>
              </div>
            ))}
          </Rise>
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
          <SideIn from="left">
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
          </SideIn>
          <Screen name="growth-statement" alt={s.growth.statementCaption} caption={s.growthHow.caption} title={p.lineup.growth.name} float={{ name: 'growth-autoreply', side: 'left' }} phone="d-growth" />
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
        <Marquee
          rows={[serviceRows.slice(0, 12), serviceRows.slice(12)].map((row) =>
            row.map((r) => (
              <>
                <i className={`v-chip-dot v-chip-${r.status.toLowerCase()}`} aria-hidden="true" />
                {t.services[r.code as keyof typeof t.services].name}
                <span className="sr-only">: {t.readiness[r.status]}</span>
              </>
            )),
          )}
        />
        <a href={href('vision')} className="v-btn-ghost mt-10">
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
        <Arm className="v-stack" >
          <div className="v-stack-in" aria-hidden="true">
            {t.healthLine.classes.map((c, i) => (
              <div key={c.klass} className={`v-slab ${healthClasses[i]?.live ? 'v-slab-live' : ''}`} style={{ ['--z' as string]: `${i * 52}px` }}>
                {c.klass}
              </div>
            ))}
          </div>
        </Arm>
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
        <div className="v-wrap pt-12 sm:pt-16">
          <div className="flex flex-wrap items-center gap-3">
            <Pill kind="live">{t.readiness.LIVE}</Pill>
            <span className="v-small">{p.clinicPage.title}</span>
          </div>
          <Words
            className="mt-5 max-w-[980px]"
            parts={[
              [p.hero.headline[0] + ' ', false],
              [p.hero.headline[1]!, true],
              [' ' + p.hero.headline[2], false],
            ]}
          />
          <p className="v-lead text-[19px]">{p.clinicPage.lede}</p>
          <p className="v-small mt-3 max-w-[680px]">{p.clinicPage.liveNote}</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <a href="#enquiry" className="v-btn">
              {p.clinicPage.action}
            </a>
            <PlayLink>{s.hero.films}</PlayLink>
          </div>
          <Stage3D
            hint={s.hero.stageHint}
            className="v-hero-stage mt-10 pb-16"
            screens={[
              // one wheel: the front, then the places round it, clockwise
              scr('queue', 8.6, [0, -0.25, 0], [0.03, 0, 0], { main: true }),
              scr('listening', 2.8, [8.7, -2.2, -1.6], [0, -0.34, 0], { crop: 0.78 }),
              scr('billing', 3.1, [7.7, 1.0, -2.8], [0, -0.3, -0.02], { crop: 0.62 }),
              scr('site-mr', 2.8, [3.4, 2.7, -6.4], [0, -0.1, 0], { crop: 0.9 }),
              scr('rx', 2.8, [-3.2, 2.7, -6], [0, 0.1, 0]),
              scr('patient', 3.3, [-7.6, 0.9, -2.4], [0, 0.3, 0.02], { crop: 0.7 }),
              scr('pharmacy', 3.0, [-8.6, -2.3, -1.4], [0, 0.34, 0], { crop: 0.88 }),
            ]}
          >
            <Screen name="queue" alt={s.different.items[0]!.alt} />
          </Stage3D>
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
            <SideIn key={name} from={i % 2 ? 'right' : 'left'} far={60}>
              <Frame>
                <Shot name={name} alt={alt} crop={300} style={{ width: '100%' }} />
              </Frame>
              <p className="mt-4 text-[15px] text-[var(--v-body)]">{alt}</p>
            </SideIn>
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
        <div className="v-wrap pt-12 sm:pt-16">
          <div className="flex flex-wrap items-end justify-between gap-10">
            <div className="min-w-0 flex-[1_1_560px]">
              <div className="flex flex-wrap items-center gap-3">
                <Pill kind="built">{p.status.built}</Pill>
                <span className="v-small">{p.growthPage.title}</span>
              </div>
              <Words
                className="mt-5"
                parts={[
                  [g.before, false],
                  [g.accent, true],
                  [g.after, false],
                ]}
              />
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
          <Stage3D
            hint={s.hero.stageHint}
            className="v-hero-stage mt-10 pb-16"
            screens={[
              // what went out and came back, beside an enquiry being answered;
              // each side's other screens come round behind it
              scr('growth-statement', 5.3, [-4.5, -0.3, 0], [0, 0.15, 0], { main: true, crop: 0.6, group: 0 }),
              scr('growth-customers', 3.2, [-5.6, 2.3, -3.4], [0, 0.2, 0.02], { crop: 0.84, group: 0 }),
              scr('growth-home', 3.2, [-10.4, -0.4, -2.2], [0, 0.32, 0], { crop: 0.74, group: 0 }),
              scr('growth-autoreply', 7.6, [2.9, -0.3, 0], [0, -0.13, 0], { main: true, group: 1 }),
              scr('growth-proof', 3.2, [5.4, 2.3, -3.6], [0, -0.2, -0.02], { crop: 0.68, group: 1 }),
              scr('growth-reports', 2.9, [10.6, -0.1, -2.6], [0, -0.32, 0], { crop: 0.6, group: 1 }),
            ]}
          >
            <div className="mx-auto max-w-[820px]">
              <Screen name="growth-statement" alt={g.statementCaption} caption={g.statementCaption} title={p.growthPage.title} phone="d-growth" />
            </div>
          </Stage3D>
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
          <Screen name="growth-home" alt={s.growthHow.caption} caption={s.growthHow.caption} title={p.lineup.growth.name} float={{ name: 'growth-optin', side: 'left' }} />
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
          <Screen name="growth-proof" alt={g.proof[0]!} float={{ name: 'growth-customers', side: 'right', crop: 150 }} />
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
