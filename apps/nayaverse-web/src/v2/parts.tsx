/**
 * The redesigned site's shared parts (approved design, 26 November 2026).
 *
 * Motion, with Framer Motion (the `motion` package), and only where it
 * explains something: screens lean toward the pointer on a spring, the
 * stepper turns by itself until someone picks a row, and sections rise 16px
 * once as they are first scrolled to. All of it is off for anyone whose
 * device asks for less motion.
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { AnimatePresence, m, useMotionValue, useReducedMotion, useSpring } from 'motion/react';
export { Rise } from './motion';
import { useContentCtx } from '@/content/use-content';
import { localeNames, locales, localesFor, pathFor, type Page } from '@/content/index';
import { productsCopy, assistantFilms, clinicFilm, growthFilm, type FilmKey } from '@/content/products';
import { siteCopy } from '@/content/site';
import { contact, founder } from '@/content/contact';
import { Player } from '@/sections/Films';
import { Rise, ScrollLine, SideIn, Swipe, Tilt } from './motion';
import { shotBg, shotSize, type ShotName } from './shots';

export function useSite() {
  const { t, locale, page } = useContentCtx();
  return { t, locale, page, s: siteCopy[locale], p: productsCopy[locale], href: (to: Page) => pathFor(locale, to) };
}

/* ------------------------------------------------------------ small parts */

export type Status = 'live' | 'built' | 'trial' | 'building' | 'waitlist';

/** A status, in the words of the page's language. The words are the ones the
 *  build checks (scripts/prerender.mjs). */
export function Pill({ kind, children, className = '' }: { kind: Status; children: ReactNode; className?: string }) {
  const cls = { live: 'v-pill-live', built: 'v-pill-built', trial: 'v-pill-trial', building: 'v-pill-trial', waitlist: 'v-pill-wait' }[kind];
  return (
    <span className={`v-pill ${cls} ${className}`}>
      {kind === 'live' && <span className="v-dot" aria-hidden="true" />}
      <span>{children}</span>
    </span>
  );
}

export function Shot({ name, alt, crop, style, priority }: { name: ShotName; alt: string; crop?: number; style?: CSSProperties; priority?: boolean }) {
  const [w, h] = shotSize[name];
  return (
    <img
      src={`/shots/${name}.webp`}
      alt={alt}
      width={w}
      height={h}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      style={crop ? { height: crop, objectFit: 'cover', objectPosition: 'left top', ...style } : style}
    />
  );
}

/** The card every product screen sits in: rounded, with a quiet window bar. */
export function Frame({ title, tag, children, className = '' }: { title?: ReactNode; tag?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`v-frame ${className}`}>
      <div className="v-frame-bar">
        <span className="v-frame-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        {title && <span className="v-frame-title">{title}</span>}
        {tag}
      </div>
      {children}
    </div>
  );
}

/** A screen at depth that leans toward the pointer on a spring. */
export function Lean({ children, className = '', max = 5 }: { children: ReactNode; className?: string; max?: number }) {
  const still = useReducedMotion();
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const srx = useSpring(rx, { stiffness: 120, damping: 18 });
  const sry = useSpring(ry, { stiffness: 120, damping: 18 });
  return (
    <div
      className={`v-stage ${className}`}
      onPointerMove={(e) => {
        if (still || e.pointerType !== 'mouse') return;
        const r = e.currentTarget.getBoundingClientRect();
        rx.set(-((e.clientY - r.top) / r.height - 0.5) * max);
        ry.set(((e.clientX - r.left) / r.width - 0.5) * max * 1.6);
      }}
      onPointerLeave={() => {
        rx.set(0);
        ry.set(0);
      }}
    >
      <m.div className="v-stage-inner" style={{ rotateX: srx, rotateY: sry }}>
        {children}
      </m.div>
    </div>
  );
}

export function Arrow() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  );
}

function PlayGlyph() {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <path d="M3 1.5v11l9-5.5z" />
    </svg>
  );
}

function WaGlyph() {
  return (
    <svg aria-hidden="true" width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 18.5l1.2-3.9A7.6 7.6 0 1 1 7.6 17.4z" />
      <path d="M8.4 8.2c.2 2.8 2.6 5.2 5.4 5.4" />
    </svg>
  );
}

/* ---------------------------------------------------------- header, footer */

export function Header() {
  const { s, p, locale, page, href } = useSite();
  const [sheet, setSheet] = useState<null | 'menu' | 'lang'>(null);
  const links: [Page, string][] = [
    ['clinic', s.nav.clinic],
    ['growth', s.nav.growth],
    ['vision', s.nav.vision],
    ['pricing', s.nav.pricing],
  ];
  const langHref = (l: (typeof locales)[number]) => pathFor(l, page !== '404' && localesFor(page).includes(l) ? page : 'home');
  useEffect(() => {
    if (!sheet) return;
    const close = (e: KeyboardEvent) => e.key === 'Escape' && setSheet(null);
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [sheet]);
  return (
    <header className="v-head">
      <ScrollLine />
      <div className="v-wrap v-head-row">
        <a href={href('home')} className="v-logo" aria-label="Nayaversse">
          <img src="/wordmark.png" alt="Nayaversse" width={600} height={86} />
        </a>
        <nav aria-label="Main" className="v-nav v-nav-desk">
          {links.map(([to, label]) => (
            <a key={to} href={href(to)} aria-current={page === to ? 'page' : undefined}>
              {label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="v-langs v-only-desk" role="group" aria-label="Language">
            {locales.map((l) => (
              <a key={l} href={langHref(l)} lang={l} hrefLang={l} aria-current={l === locale ? 'true' : undefined}>
                {localeNames[l].short}
              </a>
            ))}
          </div>
          <button type="button" className="v-icon-btn v-only-phone" aria-expanded={sheet === 'lang'} aria-label={localeNames[locale].native} onClick={() => setSheet(sheet === 'lang' ? null : 'lang')}>
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <circle cx="8" cy="8" r="6.2" />
              <path d="M1.8 8h12.4M8 1.8c1.7 1.8 2.6 3.9 2.6 6.2S9.7 12.4 8 14.2M8 1.8C6.3 3.6 5.4 5.7 5.4 8s.9 4.4 2.6 6.2" />
            </svg>
            <span>{localeNames[locale].short}</span>
          </button>
          <button type="button" className="v-icon-btn v-only-phone" aria-expanded={sheet === 'menu'} aria-label="Menu" onClick={() => setSheet(sheet === 'menu' ? null : 'menu')}>
            <svg aria-hidden="true" width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {sheet === 'menu' ? <path d="M6 6l10 10M16 6L6 16" /> : <path d="M4 7h14M4 11h14M4 15h14" />}
            </svg>
          </button>
          <a href="#enquiry" className="v-btn v-only-desk">
            {s.nav.book}
          </a>
        </div>
      </div>
      <AnimatePresence>
        {sheet && (
          <m.div
            key={sheet}
            className="v-sheet v-only-phone"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            {sheet === 'menu' ? (
              <nav aria-label="Main">
                <a href={href('home')} aria-current={page === 'home' ? 'page' : undefined}>
                  Nayaversse
                </a>
                {links.map(([to, label]) => (
                  <a key={to} href={href(to)} aria-current={page === to ? 'page' : undefined}>
                    {to === 'clinic' ? p.lineup.clinic.name : to === 'growth' ? p.lineup.growth.name : label}
                  </a>
                ))}
                <a href="#enquiry" className="v-btn mt-4" onClick={() => setSheet(null)}>
                  {s.nav.book}
                </a>
                <span className="mt-2 flex gap-2">
                  <a className="v-btn-ghost flex-1 justify-center" href={`tel:${contact.phone.replace(/\s/g, '')}`}>
                    {s.about.call}
                  </a>
                  <a className="v-btn-ghost flex-1 justify-center" href={`https://wa.me/${contact.whatsapp}`} target="_blank" rel="noopener noreferrer">
                    WhatsApp
                  </a>
                </span>
              </nav>
            ) : (
              <nav aria-label="Language">
                {locales.map((l) => (
                  <a key={l} href={langHref(l)} lang={l} hrefLang={l} aria-current={l === locale ? 'page' : undefined}>
                    {localeNames[l].native}
                  </a>
                ))}
              </nav>
            )}
          </m.div>
        )}
      </AnimatePresence>
    </header>
  );
}

export function PhoneBar() {
  const { s } = useSite();
  const [show, setShow] = useState(false);
  useEffect(() => {
    let atForm = false;
    const update = () => setShow(window.scrollY > 560 && !atForm);
    const form = document.getElementById('enquiry');
    const io = form
      ? new IntersectionObserver(([e]) => {
          atForm = Boolean(e?.isIntersecting);
          update();
        })
      : null;
    if (form) io!.observe(form);
    window.addEventListener('scroll', update, { passive: true });
    update();
    return () => {
      io?.disconnect();
      window.removeEventListener('scroll', update);
    };
  }, []);
  return (
    <div className={`v-phonebar ${show ? 'on' : ''}`} inert={!show}>
      <a href="#enquiry" className="v-btn">
        {s.nav.book}
      </a>
      <a href={`https://wa.me/${contact.whatsapp}`} className="v-wa" aria-label={s.nav.whatsapp} target="_blank" rel="noopener noreferrer">
        <WaGlyph />
      </a>
    </div>
  );
}

export function Footer() {
  const { t, s, p, href } = useSite();
  return (
    <footer className="v-foot">
      <div className="v-wrap">
        <div className="v-foot-grid">
          <div>
            <a href={href('home')} className="v-logo" aria-label="Nayaversse">
              <img src="/wordmark.png" alt="Nayaversse" width={600} height={86} />
            </a>
            {t.footer.lines.map((l) => (
              <p key={l} className="mt-4 max-w-[40ch]">
                {l}
              </p>
            ))}
          </div>
          <div>
            <h3>{s.footer.products}</h3>
            <a href={href('clinic')}>{p.lineup.clinic.name}</a>
            <a href={href('growth')}>{p.lineup.growth.name}</a>
            <a href={href('vision')}>{s.nav.vision}</a>
            <a href={href('pricing')}>{s.nav.pricing}</a>
          </div>
          <div>
            <h3>{s.footer.company}</h3>
            <a href={href('about')}>{s.footer.about}</a>
            <a href={href('founder')}>{founder.name}</a>
            <a href={href('security')}>{t.simplePages.security.title}</a>
            <a href={href('guides')}>Guides</a>
          </div>
          <div>
            <h3>{s.footer.contact}</h3>
            <a href={`tel:${contact.phone.replace(/\s/g, '')}`}>{contact.phone}</a>
            <a href={`https://wa.me/${contact.whatsapp}`} target="_blank" rel="noopener noreferrer">
              WhatsApp
            </a>
            <a href="#enquiry">{s.nav.book}</a>
          </div>
        </div>
        <p className="mt-12 border-t border-[#2a2e35] pt-6 text-[13px]">{t.footer.legal}</p>
      </div>
    </footer>
  );
}

/* ---------------------------------------------------- phone: enlarge, fold */

/** On a phone a product screen is too small to read at the page's width.
 *  Tapping one opens it large, to be dragged around. Mounted once. */
export function Zoomer() {
  const { s } = useSite();
  const [img, setImg] = useState<{ src: string; alt: string } | null>(null);
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (window.innerWidth >= 900) return;
      const el = (e.target as HTMLElement | null)?.closest?.('.v-frame img, .v-swipe-card img') as HTMLImageElement | null;
      if (!el || el.closest('.v-float')) return;
      setImg({ src: el.currentSrc || el.src, alt: el.alt });
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);
  useEffect(() => {
    if (!img) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setImg(null);
    window.addEventListener('keydown', esc);
    document.documentElement.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', esc);
      document.documentElement.style.overflow = '';
    };
  }, [img]);
  return (
    <AnimatePresence>
      {img && (
        <m.div className="v-zoom" role="dialog" aria-modal="true" aria-label={img.alt} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          <div className="v-zoom-pan">
            <m.img src={img.src} alt={img.alt} initial={{ scale: 0.92 }} animate={{ scale: 1 }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }} />
          </div>
          <p className="v-zoom-hint">{s.phone.drag}</p>
          <button type="button" className="v-zoom-close" onClick={() => setImg(null)} aria-label={s.phone.close} autoFocus>
            <svg aria-hidden="true" width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l10 10M16 6L6 16" />
            </svg>
          </button>
        </m.div>
      )}
    </AnimatePresence>
  );
}

/** A group that folds away on a phone, where a long page costs the most.
 *  On a wide screen it is always open and the heading is not a button. */
export function Fold({ head, children, start = false, className = '', btnClass = '', bodyClass = '' }: { head: ReactNode; children: ReactNode; start?: boolean; className?: string; btnClass?: string; bodyClass?: string }) {
  const [open, setOpen] = useState(start);
  return (
    <div className={`v-fold ${open ? 'open' : ''} ${className}`}>
      <button type="button" className={`v-fold-btn ${btnClass}`} aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="min-w-0">{head}</span>
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M4 7l5 5 5-5" />
        </svg>
      </button>
      <div className={`v-fold-body ${bodyClass}`}>{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------- the stepper */

export function Stepper({ items }: { items: { title: string; text: string; alt: string; shot: ShotName; /** the whole screen, for the wide layout */ wide?: ShotName; tag?: ReactNode }[] }) {
  const [at, setAt] = useState(0);
  const [picked, setPicked] = useState(false);
  const still = useReducedMotion();
  const box = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setSeen(Boolean(e?.isIntersecting)), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (picked || still || !seen) return;
    const id = window.setInterval(() => setAt((a) => (a + 1) % items.length), 4500);
    return () => window.clearInterval(id);
  }, [picked, still, seen, items.length]);
  const cur = items[at]!;
  const wide = cur.wide ?? cur.shot;
  const running = !picked && !still && seen;
  return (
    <>
    <Swipe items={items} />
    <div ref={box} className="v-steps v-only-desk mt-14">
      <SideIn from="left">
      <div role="tablist" aria-orientation="vertical">
        {items.map((it, i) => (
          <button
            key={it.title}
            type="button"
            role="tab"
            id={`step-${i}`}
            aria-selected={i === at}
            aria-controls="step-panel"
            className="v-step"
            onClick={() => {
              setAt(i);
              setPicked(true);
            }}
          >
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="v-h3">{it.title}</span>
              {it.tag}
            </span>
            <p>{it.text}</p>
            {i === at && <span key={`bar-${at}`} className={`v-step-bar ${running ? 'run' : ''}`} aria-hidden="true" />}
          </button>
        ))}
      </div>
      </SideIn>
      <SideIn from="right">
      <div id="step-panel" role="tabpanel" aria-labelledby={`step-${at}`}>
        <Lean>
          <Frame title={cur.title} tag={cur.tag}>
            {/* One height for every step, so nothing below jumps; the whole
                screen is shown at the frame's width, and a taller one fades
                out at the foot instead of being cut. */}
            <div className="v-frame-view" style={{ ['--bg' as string]: shotBg[wide] }}>
              <AnimatePresence mode="wait" initial={false}>
                <m.div
                  key={wide}
                  initial={still ? false : { opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={still ? undefined : { opacity: 0, y: -8 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                >
                  <Shot name={wide} alt={cur.alt} style={{ width: '100%' }} />
                </m.div>
              </AnimatePresence>
            </div>
          </Frame>
        </Lean>
      </div>
      </SideIn>
    </div>
    </>
  );
}

/* ------------------------------------------------------------------- films */

export function AssistantFilms() {
  const { p, s } = useSite();
  const [key, setKey] = useState<FilmKey>('whole');
  const [asked, setAsked] = useState(false);
  const film = assistantFilms.find((f) => f.key === key)!;
  return (
    <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start">
      <div className="v-film">
        <Player src={film.src} poster={film.poster} label={p.film.items[key].title} play={p.film.play} ratio="16 / 9" autoStart={asked} />
      </div>
      <div>
        <p className="v-small mb-3">{s.assistant.pick}</p>
        <div className="v-chips" role="group" aria-label={s.assistant.pick}>
          {assistantFilms.map((f) => (
            <button
              key={f.key}
              type="button"
              className="v-chip"
              aria-pressed={f.key === key}
              onClick={() => {
                setKey(f.key);
                setAsked(true);
              }}
            >
              {p.film.items[f.key].title}
            </button>
          ))}
        </div>
        <p className="mt-5 text-[15px] text-[var(--v-body)]">{p.film.items[key].detail}</p>
        <p className="mt-5 text-[14px] text-[var(--v-muted)]">{p.film.honesty}</p>
      </div>
    </div>
  );
}

export function FilmsBand() {
  const { s, p, locale } = useSite();
  const clinic = clinicFilm[locale];
  return (
    <section id="films" className="v-sec v-dark">
      <div className="v-wrap">
        <Rise>
          <h2 className="v-h2">{s.films.heading}</h2>
          <p className="v-lead">{s.films.lede}</p>
        </Rise>
        <div className="v-grid2 mt-12">
          <Rise>
            <Tilt>
              <div className="v-film">
                <Player src={clinic.src} poster={clinic.poster} label={s.films.clinic} play={p.film.play} ratio="16 / 9" />
              </div>
            </Tilt>
            <h3 className="v-h3 mt-5 text-white">{s.films.clinic}</h3>
            <p className="v-small mt-1">{s.films.clinicNote}</p>
          </Rise>
          <Rise delay={0.08}>
            <Tilt>
              <div className="v-film">
                <Player src={growthFilm.src} poster={growthFilm.poster} label={s.films.growth} play={p.film.play} ratio="16 / 9" />
              </div>
            </Tilt>
            <h3 className="v-h3 mt-5 text-white">{s.films.growth}</h3>
            <p className="v-small mt-1">{s.films.growthNote}</p>
          </Rise>
        </div>
      </div>
    </section>
  );
}

export function PlayLink({ children }: { children: ReactNode }) {
  return (
    <a href="#films" className="v-btn-ghost v-play">
      <PlayGlyph />
      <span className="v-play-text">{children}</span>
    </a>
  );
}

/* --------------------------------------------------------------- questions */

export function Questions() {
  const { t, s } = useSite();
  // The old site's questions, kept, with the price answered and the WhatsApp
  // answer brought up to date now that Growth writes to customers.
  const list = t.conditions.map((c, i) => (i === 5 ? { q: c.q, a: s.questions.whatsapp } : c));
  list.splice(1, 0, s.questions.cost);
  const [open, setOpen] = useState(0);
  return (
    <section id="questions" className="v-sec v-white">
      <div className="v-wrap">
        <Rise>
          <h2 className="v-h2">{t.conditionsPanel.heading}.</h2>
          <p className="v-lead">{t.conditionsPanel.lede}</p>
        </Rise>
        <div className="v-qs v-acc mt-12">
          {list.map((c, i) => (
            <div key={c.q}>
              <h3 className="v-h3 m-0 text-[18px]">
                <button type="button" aria-expanded={open === i} aria-controls={`qa-${i}`} onClick={() => setOpen(open === i ? -1 : i)}>
                  <span>{c.q}</span>
                  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M4 7l5 5 5-5" />
                  </svg>
                </button>
              </h3>
              <p id={`qa-${i}`} className={open === i ? '' : 'v-closed'}>
                {c.a}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------- enquiry */

const LOGIN_BANDS = ['1-2', '3-10', '11-40', '40+'] as const;

/** Composes a WhatsApp message the visitor sends themselves. Nothing is posted
 *  or stored, which is the honest answer to "what happens to what I type". */
export function Enquiry({ heading, lede, about }: { heading?: string; lede?: string; about?: number }) {
  const { t, s } = useSite();
  const e = t.enquiry;
  const [f, setF] = useState({ business: '', kind: s.enquiry.options[about ?? 0], city: '', logins: LOGIN_BANDS[0] as string, person: '', phone: '' });
  const set = (k: keyof typeof f) => (ev: { target: { value: string } }) => setF((x) => ({ ...x, [k]: ev.target.value }));
  const message = [
    e.messageTitle,
    '',
    `${e.mBusiness}: ${f.business || '-'}`,
    `${s.enquiry.about}: ${f.kind}`,
    `${e.mCity}: ${f.city || '-'}`,
    `${e.mLogins}: ${f.logins}`,
    `${e.mFrom}: ${f.person || '-'}${f.phone ? ` - ${f.phone}` : ''}`,
  ].join('\n');
  const wa = `https://wa.me/${contact.whatsapp}?text=${encodeURIComponent(message)}`;
  return (
    <section id="enquiry" className="v-sec v-red">
      <div className="v-wrap flex flex-wrap items-start gap-x-16 gap-y-10">
        <div className="min-w-0 flex-[1_1_380px]">
          <h2 className="v-h1 text-[clamp(34px,4.2vw,58px)]">{heading ?? s.enquiry.heading}</h2>
          <p className="v-lead">{lede ?? s.enquiry.lede}</p>
          <a href={`tel:${contact.phone.replace(/\s/g, '')}`} className="mt-5 inline-flex min-h-[44px] items-center text-[18px] font-semibold">
            {s.enquiry.call} {contact.phone}
          </a>
        </div>
        <form
          className="v-form min-w-0 flex-[1_1_460px]"
          onSubmit={(ev) => {
            ev.preventDefault();
            window.open(wa, '_blank', 'noopener');
          }}
        >
          <label>
            {e.businessName}
            <input value={f.business} onChange={set('business')} placeholder={e.businessNamePlaceholder} autoComplete="organization" />
          </label>
          <label>
            {s.enquiry.about}
            <select value={f.kind} onChange={set('kind')}>
              {s.enquiry.options.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </label>
          <label>
            {e.city}
            <input value={f.city} onChange={set('city')} placeholder={contact.city} autoComplete="address-level2" />
          </label>
          <label>
            {e.loginsNeeded}
            <select value={f.logins} onChange={set('logins')}>
              {LOGIN_BANDS.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </label>
          <label>
            {e.yourName}
            <input value={f.person} onChange={set('person')} autoComplete="name" />
          </label>
          <label>
            {e.phone}
            <input value={f.phone} onChange={set('phone')} placeholder={e.phonePlaceholder} inputMode="tel" autoComplete="tel" />
          </label>
          <div className="v-full flex flex-wrap items-center gap-x-5 gap-y-3">
            <button type="submit" className="v-btn">
              {e.submit}
            </button>
            <span className="v-small flex-[1_1_220px]">{e.band}</span>
          </div>
        </form>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------- about */

export function About() {
  const { t, s } = useSite();
  return (
    <section id="about" className="v-sec v-alt">
      <div className="v-wrap">
        <Rise>
          <h2 className="v-h2">{s.about.heading}</h2>
        </Rise>
        <div className="mt-8 grid gap-x-14 gap-y-5 text-[17px] text-[var(--v-body)] md:grid-cols-2">
          <p className="m-0">{t.about.paragraphs[0]}</p>
          <p className="m-0">{t.about.paragraphs[1]}</p>
          <p className="m-0">{s.about.growthParagraph}</p>
          <p className="m-0 font-medium text-[var(--v-ink)]">{t.about.closing}</p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <Rise className="v-card">
            <p className="v-small m-0">{t.about.facts[0]!.label}</p>
            <h3 className="v-h3 mt-1 text-[24px]">{founder.name}</h3>
            <dl className="mt-4">
              {t.about.facts.slice(1).map((f) => (
                <div key={f.label} className="flex flex-wrap gap-x-4 border-t border-[var(--v-line)] py-3 text-[15px]">
                  <dt className="w-[150px] flex-none text-[var(--v-muted)]">{f.label}</dt>
                  <dd className="m-0 min-w-0 flex-1">{f.value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 flex gap-3">
              <a className="v-btn-ghost flex-1 justify-center" href={`tel:${contact.phone.replace(/\s/g, '')}`}>
                {s.about.call}
              </a>
              <a className="v-btn-ghost flex-1 justify-center" href={`https://wa.me/${contact.whatsapp}`} target="_blank" rel="noopener noreferrer">
                {s.about.whatsapp}
              </a>
            </div>
          </Rise>
          <Rise className="v-card" delay={0.06}>
            <h3 className="v-h3">{s.about.checks}</h3>
            <ul className="v-ticks">
              {s.facts.map((f) => (
                <li key={f.title}>
                  <span>
                    <strong className="font-semibold text-[var(--v-ink)]">{f.title}.</strong> {f.text}
                  </span>
                </li>
              ))}
            </ul>
          </Rise>
        </div>
      </div>
    </section>
  );
}
