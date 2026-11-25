/**
 * The films.
 *
 * Every film on this site was recorded from the product itself, on a demo
 * clinic with made-up patients, and the band says so. That is the whole
 * claim: not a mock-up, not a render of what it might look like.
 *
 * Nothing loads until somebody presses play. A film is a megabyte or more,
 * and the page has to be readable on a phone on mobile data first, so the
 * poster is a still, the <video> has preload="none", and the file is asked
 * for only on the press. No autoplay: these have sound, and a page that
 * starts talking is a page people close.
 *
 * The assistant's films are a list with one player rather than six players:
 * one feature, one short film, picked from the list beside it, so a reader
 * can watch the thirty seconds they care about.
 *
 * The assistant is IN TRIAL and carries that stamp, never Live: it is not
 * switched on at the paying clinic (content/products.ts).
 */
import { useEffect, useRef, useState } from 'react';
import { useContentCtx } from '@/content/use-content';
import { assistantFilms, clinicFilm, productsCopy } from '@/content/products';
import { Band, BandItem, Heading, Panel, Stamp, cx } from '@/components/primitives';

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

/** One film in a 16:10 or 16:9 frame: a still with a play plate until it is asked for. */
export function Player({
  src,
  poster,
  label,
  play,
  ratio,
  autoStart,
}: {
  src: string;
  poster: string;
  label: string;
  play: string;
  ratio: '16 / 9' | '16 / 10';
  /** Start as soon as it is shown: the reader has already pressed something. */
  autoStart?: boolean;
}) {
  const [started, setStarted] = useState(Boolean(autoStart));
  const video = useRef<HTMLVideoElement>(null);

  // A different film was picked: it was asked for by a press, so it plays.
  useEffect(() => {
    setStarted(Boolean(autoStart));
  }, [src, autoStart]);
  useEffect(() => {
    if (started) void video.current?.play().catch(() => undefined);
  }, [started, src]);

  return (
    <div className="relative w-full overflow-hidden bg-[var(--board)] ring-1 ring-[color-mix(in_srgb,var(--rule)_34%,transparent)]" style={{ aspectRatio: ratio }}>
      {started ? (
        <video
          ref={video}
          key={src}
          src={src}
          poster={poster}
          controls
          playsInline
          preload="none"
          aria-label={label}
          className="absolute inset-0 h-full w-full"
        />
      ) : (
        <button
          type="button"
          onClick={() => setStarted(true)}
          aria-label={`${play}: ${label}`}
          className="group absolute inset-0 h-full w-full"
        >
          <img src={poster} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
          <span className="absolute inset-0 bg-[color-mix(in_srgb,var(--board)_22%,transparent)] transition-colors group-hover:bg-transparent" style={{ transitionDuration: 'var(--dur)' }} />
          <span className="plate absolute bottom-2 left-2 flex items-center gap-2 max-sm:!px-2.5 max-sm:!py-1.5 max-sm:!text-[0.8125rem] sm:bottom-4 sm:left-4 sm:gap-2.5">
            <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true" fill="currentColor">
              <path d="M2.5 1.2 10.5 6l-8 4.8z" />
            </svg>
            {play}
          </span>
        </button>
      )}
    </div>
  );
}

/** The clinic product's own film, in the language of the page. */
export function ClinicFilm() {
  const { locale } = useContentCtx();
  const { film } = productsCopy[locale];
  const f = clinicFilm[locale];
  return (
    <section id="film" className="frame void">
      <Panel>
        <Band>
          <BandItem>{film.bandTitle}</BandItem>
          <BandItem grow>{film.band}</BandItem>
          <BandItem>
            <span data-figures>3:56</span>
          </BandItem>
        </Band>
        <div className="grid gap-x-10 gap-y-6 px-4 py-7 sm:px-7 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)] lg:items-start">
          <div>
            <Heading>{film.clinicHeading}</Heading>
            <p className="t-prose mt-4 text-pretty text-[var(--ink-soft)]">{film.clinicLede}</p>
            <p className="t-label mt-5 text-[var(--ink-faint)]">{film.sound}</p>
          </div>
          <Player src={f.src} poster={f.poster} label={film.clinicHeading} play={film.play} ratio="16 / 9" />
        </div>
      </Panel>
    </section>
  );
}

/** The assistant: the whole film, and one short film for each thing it does. */
export function AssistantFilms() {
  const { locale } = useContentCtx();
  const { film, status } = productsCopy[locale];
  const [picked, setPicked] = useState(0);
  // The first film waits for its own play press; one picked from the list
  // has been asked for already.
  const [asked, setAsked] = useState(false);
  const current = assistantFilms[picked]!;
  const words = film.items[current.key];

  return (
    <section id="assistant" className="frame void">
      <Panel>
        <Band>
          <BandItem>{film.bandTitle}</BandItem>
          <BandItem grow>{film.band}</BandItem>
          <BandItem>
            <Stamp>{status.trial}</Stamp>
          </BandItem>
        </Band>

        <div className="px-4 pb-5 pt-7 sm:px-7">
          <Heading>{film.assistantHeading}</Heading>
          <p className="t-prose mt-4 max-w-[62ch] text-pretty text-[var(--ink-soft)]">{film.assistantLede}</p>
          <p className="notice notice-building t-prose mt-4 px-3.5 py-2.5 text-[0.9375rem]">{film.trialNote}</p>
        </div>

        <div className="grid gap-x-8 gap-y-6 px-4 pb-7 sm:px-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,21rem)] lg:items-start">
          <div>
            <Player
              src={current.src}
              poster={current.poster}
              label={words.title}
              play={film.play}
              ratio="16 / 9"
              autoStart={asked}
            />
            <p className="t-label mt-3 text-[var(--ink-faint)]">
              {film.sound}
              {locale !== 'en' && <> · {film.englishOnly}</>}
            </p>
          </div>

          <ol className="lg:-mt-1">
            {assistantFilms.map((f, i) => {
              const on = i === picked;
              const w = film.items[f.key];
              return (
                <li key={f.key} className="rule-row">
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      setPicked(i);
                      setAsked(true);
                    }}
                    className={cx(
                      'flex w-full items-baseline gap-3 py-3 text-left transition-colors',
                      on ? 'text-[var(--ink)]' : 'text-[var(--ink-soft)] hover:text-[var(--ink)]',
                    )}
                    style={{ transitionDuration: 'var(--dur)' }}
                  >
                    <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true" fill="currentColor" className={cx('mt-1.5 shrink-0 self-start', on ? 'text-[var(--priority)]' : 'text-[var(--ink-faint)]')}>
                      <path d="M2.5 1.2 10.5 6l-8 4.8z" />
                    </svg>
                    <span className="min-w-0 flex-1">
                      <span className="t-board block text-[1.2rem] leading-none">{w.title}</span>
                      <span className={cx('mt-1.5 block text-sm', on ? 'text-[var(--ink-soft)]' : 'text-[var(--ink-faint)]')}>
                        {w.detail}
                      </span>
                    </span>
                    <span className="t-label shrink-0 text-[var(--ink-faint)]" data-figures>
                      {clock(f.seconds)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="rule-total px-4 py-6 sm:px-7">
          <p className="t-prose max-w-[70ch] text-sm text-[var(--ink-soft)]">{film.honesty}</p>
        </div>
      </Panel>
    </section>
  );
}
