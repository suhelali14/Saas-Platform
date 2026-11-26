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
export function Tilt({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const still = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'center center'] });
  const rotateX = useTransform(scrollYProgress, [0, 1], [22, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.9, 1]);
  const y = useTransform(scrollYProgress, [0, 1], [60, 0]);
  return (
    <div ref={ref} className={`v-tilt ${className}`}>
      <m.div style={still ? undefined : { rotateX, scale, y, transformPerspective: 1400 }}>{children}</m.div>
    </div>
  );
}

/** The product screens in three.js on wide screens; the children are the fallback. */
export function Stage3D({ screens, children, className = '', camZ, labels }: { screens: SceneScreen[]; children: ReactNode; className?: string; camZ?: number; labels?: ReactNode }) {
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
        handle = mountScene(el, screens, { still: reduced(), camZ, onReady: () => setOn(true) });
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
