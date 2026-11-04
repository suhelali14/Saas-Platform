import { LazyMotion, m, useReducedMotion, type Transition } from 'motion/react';
import { useEffect, useState, type ReactNode } from 'react';

/**
 * The feature set, loaded on demand.
 *
 * The full `motion` import costs about 44KB gzipped, which on a site sold to
 * clinics in Sangli on mobile data is most of a second before anything is
 * readable -- for an effect. `m` is the same component with no features
 * bundled, and `LazyMotion` fetches only the DOM animation set, after the
 * page is already up.
 *
 * `domAnimation` and not `domMax`: this needs opacity, transform and
 * whileInView. Nothing here drags, pans, or animates layout, and `domMax`
 * is roughly twice the weight for exactly those.
 */
const features = () => import('@/components/motion-features').then((mod) => mod.default);

/**
 * Motion for this site, with one rule above all others.
 *
 * ── Nothing hidden may reach the prerendered HTML ───────────────────
 *
 * Every page here is rendered to static markup at build time -- about 99KB
 * of it per page, in three languages -- and that markup is the product. It
 * is what a search engine indexes, what a slow phone on a Sangli 3G
 * connection paints first, and what a visitor sees if the JavaScript never
 * arrives.
 *
 * The ordinary way to write a scroll reveal is `initial={{ opacity: 0 }}`.
 * Under server rendering that writes `opacity: 0` into the static HTML, so
 * the page ships invisible and *stays* invisible until a bundle loads and
 * hydrates. For a marketing site whose entire argument is that the
 * prerendered page is complete, that trades the thing that works for an
 * effect.
 *
 * So `initial` is `false` until the client says otherwise. With `false`,
 * Motion renders the animate state directly and writes no hidden styles --
 * the prerendered page is fully visible, and the reveal is strictly an
 * enhancement for anyone whose browser got as far as running code.
 *
 * ── Why the flag is set in an effect ────────────────────────────────
 *
 * An effect only runs after hydration, which is precisely the proof needed:
 * JavaScript is alive. Anything already on screen by then renders visible
 * with no animation, which is correct -- a hero that fades in after the
 * reader has started on it is a delay dressed as polish. Sections further
 * down have not been in view yet, so they animate as they arrive.
 */

/**
 * Wraps the app so the lazy feature bundle has somewhere to load into.
 *
 * `strict` makes a plain `motion.div` anywhere in the tree a build-time
 * error rather than a silent regression: importing one would pull the full
 * feature set back in and quietly undo the saving above, and nobody would
 * notice until somebody measured the bundle again.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={features} strict>
      {children}
    </LazyMotion>
  );
}

/** Was this rendered by a browser that is actually running code? */
function useHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}

/**
 * The house transition.
 *
 * Short, and eased out only. This site's visual world is a laminated chart
 * board in a steel frame -- things on it are printed, stamped and ruled, not
 * sprung. An overshoot or a bounce would say "web app", which is the one
 * thing the design is built to avoid.
 */
const BOARD: Transition = { duration: 0.42, ease: [0.16, 1, 0.3, 1] };

export interface RevealProps {
  children: ReactNode;
  /** Seconds to wait, for staggering siblings by hand. */
  delay?: number;
  /** How far it travels. Small by default: this is a settle, not an entrance. */
  y?: number;
  className?: string;
  /** Rendered element. A reveal around a table row must still be a row. */
  as?: 'div' | 'section' | 'li' | 'tr' | 'span';
  /** A whole section below the hero: skip its layout for the first paint
   *  (see components/settle.ts). */
  defer?: boolean;
}

/**
 * Fades and settles its children the first time they are scrolled to.
 *
 * `once: true` because re-animating on the way back up turns a material
 * detail into a fidget -- the same reasoning the existing `Ruling` was
 * written with, and the reason its observer disconnects on first hit.
 */
export function Reveal({ children, delay = 0, y = 10, className, as = 'div', defer }: RevealProps) {
  const hydrated = useHydrated();
  // Motion's own hook, which reads the OS setting and keeps reading it.
  // Someone who has asked their machine for less movement has asked this
  // page too, and the answer is no movement rather than less.
  const still = useReducedMotion();

  const Tag = m[as];
  const animate = { opacity: 1, y: 0 };

  return (
    <Tag
      className={className}
      data-defer={defer ? '' : undefined}
      initial={hydrated && !still ? { opacity: 0, y } : false}
      whileInView={animate}
      // A third of the block, so a tall section starts moving when its top
      // is genuinely on screen rather than when one pixel of it is.
      viewport={{ once: true, amount: 0.3 }}
      transition={{ ...BOARD, delay }}
    >
      {children}
    </Tag>
  );
}

/**
 * The violet stamp, pressed rather than faded.
 *
 * A rubber stamp arrives all at once and slightly too hard. The scale comes
 * down from above 1 so it reads as pressure on the panel, which is the one
 * place on this board where a spring is right -- it is modelling something
 * physical, not decorating a transition.
 */
export function Stamp({ children, className }: { children: ReactNode; className?: string }) {
  const hydrated = useHydrated();
  const still = useReducedMotion();

  return (
    <m.span
      className={className}
      initial={hydrated && !still ? { opacity: 0, scale: 1.35, rotate: -7 } : false}
      whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
      viewport={{ once: true, amount: 0.8 }}
      transition={{ type: 'spring', stiffness: 520, damping: 26, mass: 0.7 }}
    >
      {children}
    </m.span>
  );
}

/**
 * A run of rows that settle one after another.
 *
 * Capped deliberately: the service chart has 23 rows, and 23 × 60ms is a
 * second and a half of staggering, by the end of which the reader is
 * waiting for a table rather than reading one. After the cap everything
 * lands together.
 */
export function RevealRows({
  children,
  step = 0.055,
  cap = 8,
}: {
  children: ReactNode[];
  step?: number;
  cap?: number;
}) {
  return (
    <>
      {children.map((child, i) => (
        <Reveal key={i} as="tr" delay={Math.min(i, cap) * step} y={6}>
          {child}
        </Reveal>
      ))}
    </>
  );
}
