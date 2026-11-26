/**
 * Motion for the redesigned site, with Framer Motion (the `motion` package)
 * and three.js. The pages are prerendered, so everything here starts from
 * the finished, readable state and only moves once the page is live in the
 * browser:
 *
 *   - Rise: a block below the fold is hidden as the page loads and rises
 *     40px into place the first time it is scrolled to (children one after
 *     another with `each`). Anything already on screen is left alone, so
 *     nothing that has been read blinks.
 *   - Tilt: a screen tips back as it enters and straightens as it reaches
 *     the middle of the window, driven by the scroll itself.
 *   - Stage3D: the real product screens as objects in space (scene3d.ts),
 *     on wide screens with WebGL; the prerendered screens are the fallback.
 *   - Deck: on a phone, three screens as a deck of cards that turns by
 *     itself and can be swiped.
 *
 * Every one of them stops for a reader whose device asks for less motion.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { animate, stagger } from 'motion';
import { m, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { useHydrated } from '@/components/Reveal';
import type { SceneScreen } from './scene3d';
import { shotSize, type ShotName } from './shots';

const EASE = [0.16, 1, 0.3, 1] as const;
const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Hide-then-reveal for a block below the fold. */
function useArmed(ref: React.RefObject<HTMLElement | null>, onIn: (el: HTMLElement) => void, onArm?: (el: HTMLElement) => void) {
  useEffect(() => {
    const el = ref.current;
    if (!el || reduced()) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return;
    onArm?.(el);
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        io.disconnect();
        onIn(el);
      },
      { threshold: 0.12, rootMargin: '0px 0px -6% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export function Rise({ children, className, delay = 0, as = 'div', each }: { children: ReactNode; className?: string; delay?: number; as?: 'div' | 'section' | 'li' | 'ol' | 'ul'; each?: boolean }) {
  const ref = useRef<HTMLElement>(null);
  const parts = (el: HTMLElement) => (each ? (Array.from(el.children) as HTMLElement[]) : [el]);
  useArmed(
    ref,
    (el) => {
      const ts = parts(el);
      animate(ts, { opacity: [0, 1], transform: ['translateY(40px)', 'translateY(0px)'] }, { duration: 0.9, ease: EASE, delay: each ? stagger(0.09, { startDelay: delay }) : delay }).then(() =>
        ts.forEach((t) => {
          t.style.opacity = '';
          t.style.transform = '';
        }),
      );
    },
    (el) =>
      parts(el).forEach((t) => {
        t.style.opacity = '0';
        t.style.transform = 'translateY(40px)';
      }),
  );
  const Tag = as as 'div';
  return (
    <Tag ref={ref as React.RefObject<HTMLDivElement>} className={className}>
      {children}
    </Tag>
  );
}

/** Adds `in` to an `armed` element when it is first scrolled to (CSS does the rest). */
export function Arm({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useArmed(
    ref,
    (el) => el.classList.add('in'),
    (el) => el.classList.add('armed'),
  );
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

/** A screen that tips back as it enters and straightens at the middle of the window. */
/** True once the page is live in the browser and motion is wanted. Scroll-
 *  linked styles are applied only then, so the prerendered page is at rest. */
function useLive() {
  const hydrated = useHydrated();
  const still = useReducedMotion();
  return hydrated && !still;
}

export function Tilt({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const live = useLive();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'center center'] });
  const rotateX = useTransform(scrollYProgress, [0, 1], [18, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.92, 1]);
  const y = useTransform(scrollYProgress, [0, 1], [50, 0]);
  return (
    <div ref={ref} className={`v-tilt ${className}`}>
      <m.div style={live ? { rotateX, scale, y, transformPerspective: 1400 } : undefined}>{children}</m.div>
    </div>
  );
}

/** A layer that moves with the scroll at its own speed: above 0 it lags
 *  behind the page, below 0 it runs ahead. Layers at different speeds are
 *  what reads as depth. */
export function Parallax({ children, speed = 0.3, className = '' }: { children: ReactNode; speed?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const live = useLive();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], [speed * 140, speed * -140]);
  return (
    <div ref={ref} className={className}>
      <m.div style={live ? { y } : undefined}>{children}</m.div>
    </div>
  );
}

/** Slides in from one side as it is scrolled to, and settles by the time it
 *  is a third of the way up the window. Driven by the scroll, so it follows
 *  the reader's own pace in both directions. */
export function SideIn({ children, from = 'left', className = '', far = 90 }: { children: ReactNode; from?: 'left' | 'right'; className?: string; far?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const live = useLive();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'start 0.62'] });
  const x = useTransform(scrollYProgress, [0, 1], [from === 'left' ? -far : far, 0]);
  const opacity = useTransform(scrollYProgress, [0, 0.7], [0, 1]);
  return (
    <div ref={ref} className={className}>
      <m.div style={live ? { x, opacity } : undefined}>{children}</m.div>
    </div>
  );
}

/** How far down the page the reader is, as a line under the header. */
export function ScrollLine() {
  const live = useLive();
  const { scrollYProgress } = useScroll();
  if (!live) return null;
  return <m.div className="v-progress" style={{ scaleX: scrollYProgress }} aria-hidden="true" />;
}

/** A headline whose words rise into place one after another as the page
 *  opens. Plain CSS, so it plays before any script has loaded. */
export function Words({ parts, className = '' }: { parts: [string, boolean][]; className?: string }) {
  // words, each made of pieces that may differ in colour ("on" + ".")
  const words: { text: string; accent: boolean }[][] = [[]];
  for (const [text, accent] of parts) {
    for (const piece of text.split(/(\s+)/)) {
      if (!piece) continue;
      if (/^\s+$/.test(piece)) words.push([]);
      else words[words.length - 1]!.push({ text: piece, accent });
    }
  }
  const list = words.filter((w) => w.length);
  return (
    <h1 className={`v-h1 v-words ${className}`}>
      {list.map((w, i) => (
        <span key={i}>
          <span className="v-word">
            <span style={{ animationDelay: `${0.05 + i * 0.055}s` }}>
              {w.map((s, j) => (
                <span key={j} className={s.accent ? 'v-accent' : undefined}>
                  {s.text}
                </span>
              ))}
            </span>
          </span>
          {i < list.length - 1 ? ' ' : ''}
        </span>
      ))}
    </h1>
  );
}

/** Two rows of chips drifting in opposite directions, pushed further by the
 *  scroll. Without motion they wrap into an ordinary list. */
export function Marquee({ rows }: { rows: ReactNode[][] }) {
  const live = useLive();
  const { scrollY } = useScroll();
  const a = useTransform(scrollY, (v) => -(v * 0.08) % 600);
  const b = useTransform(scrollY, (v) => ((v * 0.08) % 600) - 600);
  return (
    <div className="v-marquee">
      {rows.map((row, r) => (
        <m.div key={r} className="v-marquee-row" style={live ? { x: r % 2 ? b : a } : undefined}>
          <div className={`v-marquee-run ${r % 2 ? 'rev' : ''}`}>
            {row.map((chip, i) => (
              <span key={i} className="v-marquee-chip">
                {chip}
              </span>
            ))}
            {row.map((chip, i) => (
              <span key={`c${i}`} className="v-marquee-chip v-marquee-copy" aria-hidden="true">
                {chip}
              </span>
            ))}
          </div>
        </m.div>
      ))}
    </div>
  );
}

/** The product screens in three.js on wide screens; the children are the fallback. */
export function Stage3D({ screens, children, className = '', fit, labels, hint }: { screens: SceneScreen[]; children: ReactNode; className?: string; /** world units the page's content width shows */ fit?: number; labels?: ReactNode; /** shown under the stage once the screens can be pressed */ hint?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = host.current;
    if (!el || window.innerWidth < 900) return;
    const probe = document.createElement('canvas');
    if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) return;
    let dead = false;
    let handle: { dispose: () => void } | undefined;
    const go = () =>
      import('./scene3d').then(({ mountScene }) => {
        if (dead) return;
        handle = mountScene(el, screens, { still: reduced(), fit, onReady: () => setOn(true) });
      });
    const w = window as Window & { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(go, { timeout: 700 });
    else window.setTimeout(go, 150);
    return () => {
      dead = true;
      handle?.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div ref={host} className={`v-3d ${on ? 'is-3d' : ''} ${className}`}>
      <div className="v-3d-fallback">{children}</div>
      {labels && <div className="v-3d-labels">{labels}</div>}
      {hint && <p className="v-3d-hint">{hint}</p>}
    </div>
  );
}

/** A screen for the 3D stage, from the screenshot's own size. */
export function scr(name: ShotName, width: number, pos: [number, number, number], rot?: [number, number, number], extra?: Partial<SceneScreen>): SceneScreen {
  const [w, h] = shotSize[name];
  return { src: `/shots/${name}.webp`, w, h, width, pos, rot, ...extra };
}

/* --------------------------------------------------------------- the deck */

const SPOTS = [
  'translate3d(0,0,60px) rotateZ(-1.5deg)',
  'translate3d(-26px,-8px,-30px) rotateZ(-5deg)',
  'translate3d(30px,-18px,-80px) rotateZ(4deg)',
];

export function Deck({ cards, label }: { cards: { shot: ShotName; title: string; tag: ReactNode; alt: string; href?: string }[]; label: string }) {
  const [front, setFront] = useState(0);
  const [touched, setTouched] = useState(false);
  const still = useReducedMotion();
  const startX = useRef<number | null>(null);
  const n = cards.length;
  useEffect(() => {
    if (still || touched) return;
    const id = window.setInterval(() => setFront((f) => (f + 1) % n), 3600);
    return () => window.clearInterval(id);
  }, [still, touched, n]);
  return (
    <div className="v-deck" role="region" aria-roledescription="carousel" aria-label={label}>
      <div
        className="v-deck-stack"
        onPointerDown={(e) => {
          startX.current = e.clientX;
        }}
        onPointerUp={(e) => {
          if (startX.current === null) return;
          const dx = e.clientX - startX.current;
          startX.current = null;
          if (Math.abs(dx) < 36) return;
          setTouched(true);
          setFront((f) => (f + (dx < 0 ? 1 : n - 1)) % n);
        }}
      >
        {cards.map((c, i) => {
          const spot = (i - front + n) % n;
          const [w, h] = shotSize[c.shot];
          const Tag = c.href ? 'a' : 'div';
          return (
            <Tag
              key={c.shot}
              href={c.href}
              className={`v-deck-card ${spot === 0 ? 'v-deck-front' : ''}`}
              style={{ transform: SPOTS[spot], zIndex: n - spot, opacity: spot === 2 ? 0.9 : 1 }}
              aria-hidden={spot !== 0}
              tabIndex={spot === 0 ? undefined : -1}
              onClick={(e: React.MouseEvent) => {
                // a card behind comes to the front; only the front one opens its page
                if (spot === 0) return;
                e.preventDefault();
                setTouched(true);
                setFront(i);
              }}
            >
              <span className="v-deck-cap">
                <span>{c.title}</span>
                {c.tag}
              </span>
              <img src={`/shots/${c.shot}.webp`} alt={c.alt} width={w} height={h} loading="eager" decoding="async" draggable={false} />
            </Tag>
          );
        })}
      </div>
      <div className="v-deck-dots">
        {cards.map((c, i) => (
          <button
            key={c.shot}
            type="button"
            aria-label={c.title}
            aria-pressed={i === front}
            onClick={() => {
              setTouched(true);
              setFront(i);
            }}
          />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------- cards you swipe */

export function Swipe({ items }: { items: { title: string; text: string; alt: string; shot: ShotName; tag?: ReactNode }[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState(0);
  return (
    <div className="v-swipe-wrap">
      <div
        ref={ref}
        className="v-swipe"
        onScroll={(e) => {
          const el = e.currentTarget;
          const w = (el.firstElementChild as HTMLElement | null)?.offsetWidth ?? el.clientWidth;
          setAt(Math.min(items.length - 1, Math.round(el.scrollLeft / (w + 14))));
        }}
      >
        {items.map((it) => {
          const [w, h] = shotSize[it.shot];
          return (
            <article key={it.title} className="v-swipe-card">
              <img src={`/shots/${it.shot}.webp`} alt={it.alt} width={w} height={h} loading="lazy" decoding="async" />
              <div className="p-5">
                <h3 className="v-h3 flex flex-wrap items-center gap-2">
                  {it.title} {it.tag}
                </h3>
                <p className="mb-0 mt-2 text-[15px] text-[var(--v-body)]">{it.text}</p>
              </div>
            </article>
          );
        })}
      </div>
      <div className="v-swipe-count" aria-hidden="true">
        <span className="v-deck-dots">
          {items.map((it, i) => (
            <button
              key={it.title}
              type="button"
              tabIndex={-1}
              aria-pressed={i === at}
              onClick={() => {
                const el = ref.current;
                const card = el?.children[i] as HTMLElement | undefined;
                if (el && card) el.scrollTo({ left: card.offsetLeft - el.offsetLeft - 16, behavior: 'smooth' });
              }}
            />
          ))}
        </span>
        <span>
          {at + 1} / {items.length} →
        </span>
      </div>
    </div>
  );
}
