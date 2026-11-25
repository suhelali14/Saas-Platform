/**
 * The screening: both products at work, on one lit screen.
 *
 * The home page is about the company, and a company is believed by what it
 * has made. So directly under the board that says who Nayaversse is, a
 * second board carries one large screen and a two-way indicator: Clinic,
 * Growth. Each plays a film recorded from the product itself. Beside the
 * screen the product's name turns over on a split-flap unit, with the one
 * word that says where it stands, what it is for, and where to read more.
 *
 * The movement here is the page's one authored moment, and it comes from
 * the material: the screen is glass, so a band of light crosses it and it
 * draws up to its full size as the reader reaches it, driven by the scroll
 * and not by a timer. Changing film wipes the new picture across the old
 * and turns the name over. Nothing else on the page performs.
 *
 * Under server rendering, and for anyone who asked for less motion, the
 * screen is simply at full size with no band of light: the prerendered
 * page is complete (see components/Reveal.tsx for why that is a rule).
 *
 * Status is the same honest word as everywhere else: Clinic carries the
 * chart's Live, Growth carries Built and the sentence that no business
 * uses it yet.
 */
import { useRef, useState } from 'react';
import { m, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { useContent, useContentCtx } from '@/content/use-content';
import { pathFor } from '@/content/index';
import { clinicFilm, growthFilm, productsCopy } from '@/content/products';
import { homeCopy } from '@/content/home';
import { Board, Chevron, cx } from '@/components/primitives';
import { FlapWheel } from '@/components/Flap';
import { useHydrated } from '@/components/Reveal';
import { Player } from '@/sections/Films';

export function Screening() {
  const { readiness } = useContent();
  const { locale } = useContentCtx();
  const p = productsCopy[locale];
  const words = homeCopy[locale].screening;

  const [which, setWhich] = useState(0);
  // The first film waits for its own play press. A film chosen on the
  // indicator after one has already been started plays at once.
  const [asked, setAsked] = useState(false);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  const films = [
    {
      key: 'clinic', short: p.nav.clinic, words: p.lineup.clinic, status: readiness.LIVE, tone: 'var(--lamp)',
      film: clinicFilm[locale], length: '3:56', english: false, href: pathFor(locale, 'clinic'),
    },
    {
      key: 'growth', short: p.nav.growth, words: p.lineup.growth, status: p.status.built, tone: 'var(--board-ink)',
      film: growthFilm, length: '1:17', english: locale !== 'en', href: pathFor(locale, 'growth'),
    },
  ] as const;
  const now = films[which]!;

  /* The screen draws up and the light crosses it as the section arrives. */
  const stage = useRef<HTMLDivElement>(null);
  const hydrated = useHydrated();
  const still = useReducedMotion();
  const moving = hydrated && !still;
  const { scrollYProgress } = useScroll({ target: stage, offset: ['start end', 'start 0.18'] });
  const scale = useTransform(scrollYProgress, [0, 1], [0.92, 1]);
  const light = useTransform(scrollYProgress, [0, 1], ['-40%', '150%']);

  const pick = (i: number) => {
    if (i === which) return;
    setWhich(i);
  };
  const onKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const to = i === 0 ? 1 : 0;
    pick(to);
    tabs.current[to]?.focus();
  };

  return (
    <section id="films" className="frame frame-wide pb-10 pt-2 sm:pt-4">
      <Board className="px-5 py-8 sm:px-10 sm:py-11 lg:px-14 lg:py-14">
        <div className="grid gap-x-12 gap-y-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:items-end">
          <div>
            <h2 className="t-board text-[clamp(2.4rem,7vw,4.6rem)] text-[var(--board-ink)]">{words.heading}</h2>
            <p className="t-lede mt-4 max-w-[40rem] text-pretty text-[var(--board-ink-soft)]">{words.lede}</p>
          </div>

          <div role="tablist" aria-label={words.switchLabel} className="indicator">
            {films.map((f, i) => (
              <button
                key={f.key}
                ref={(el) => {
                  tabs.current[i] = el;
                }}
                type="button"
                role="tab"
                id={`film-tab-${f.key}`}
                aria-selected={i === which}
                aria-controls="film-panel"
                tabIndex={i === which ? 0 : -1}
                onClick={() => pick(i)}
                onKeyDown={(e) => onKey(e, i)}
              >
                <span className="t-board text-[1.5rem] leading-none">{f.short}</span>
                <span className="t-label !text-[0.625rem]" style={{ color: i === which ? f.tone : undefined }}>
                  {f.status}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div
          id="film-panel"
          role="tabpanel"
          aria-labelledby={`film-tab-${now.key}`}
          className="mt-9"
        >
          {/* The screen takes the whole width of the board: the film is the
              argument, so it is the largest thing on the page. */}
          <div ref={stage} className="min-w-0 px-5 py-5 sm:px-6 sm:py-6">
            <m.div className="screen" style={moving ? { scale, transformOrigin: '50% 100%' } : undefined}>
              <span className="screen-tick tl" aria-hidden="true" />
              <span className="screen-tick tr" aria-hidden="true" />
              <span className="screen-tick bl" aria-hidden="true" />
              <span className="screen-tick br" aria-hidden="true" />
              {/* The new picture wipes across the old one, left to right. */}
              <m.div
                key={now.key}
                initial={moving ? { clipPath: 'inset(0 100% 0 0)' } : false}
                animate={{ clipPath: 'inset(0 0% 0 0)' }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                onClickCapture={() => setAsked(true)}
              >
                <Player
                  src={now.film.src}
                  poster={now.film.poster}
                  label={now.words.name}
                  play={p.film.play}
                  ratio="16 / 9"
                  autoStart={asked}
                />
              </m.div>
              {moving && (
                <span className="screen-glare" aria-hidden="true">
                  <m.span style={{ left: light }} />
                </span>
              )}
            </m.div>
            <p className="t-label mt-5 flex flex-wrap gap-x-4 gap-y-1 text-[var(--board-ink-soft)]">
              <span>{words.recorded}</span>
              <span data-figures>{now.length}</span>
              <span>{p.film.sound}</span>
              {now.english && <span>{words.englishOnly}</span>}
            </p>
          </div>

          {/* Under the screen, what is playing: the name on its drum, what
              it is for, and what it does, read left to right. */}
          <div className="mt-8 grid gap-x-12 gap-y-8 px-5 sm:px-6 lg:grid-cols-[auto_minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start">
            <div className="min-w-0">
              {/* One drum, two cards: the name turns over when the film does. */}
              <div className="screening-title" aria-hidden="true">
                <FlapWheel items={films.map((f) => f.short)} index={which} step={220} />
              </div>
              <h3 className="sr-only">{now.words.name}</h3>
              <p className={cx('mt-4 max-w-[17rem] text-sm font-semibold')} style={{ color: now.tone }}>
                {now.words.stands}
              </p>
            </div>

            <div className="min-w-0">
              <p className="text-sm text-[var(--board-ink-soft)]">{now.words.forWhom}</p>
              <p className="t-lede mt-3 text-pretty !text-[1.1875rem] text-[var(--board-ink)]">{now.words.body}</p>
              <div className="mt-6">
                <a href={now.href} className="engraved">
                  {now.words.link}
                </a>
              </div>
            </div>

            <ul className="min-w-0 border-t border-[var(--steel-line)]">
              {now.words.points.map((point) => (
                <li key={point} className="flex gap-2.5 border-b border-[var(--steel-line)] py-2.5 text-[0.9375rem] text-[var(--board-ink-soft)]">
                  <Chevron className="mt-[0.4rem] text-[var(--lamp)]" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-x-8 gap-y-3 border-t border-[var(--steel-line)] pt-6">
          <p className="max-w-[46rem] text-sm text-[var(--board-ink-soft)]">{words.visionLine}</p>
          <a href={pathFor(locale, 'vision')} className="engraved">
            {p.lineup.vision.link}
          </a>
        </div>
      </Board>
    </section>
  );
}
