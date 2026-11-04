/**
 * Off-screen sections, laid out after the first paint rather than before it.
 *
 * Measured on a mid-range phone profile (4x CPU, slow 4G): the browser spent
 * about 400ms laying out the whole prerendered page before it drew its first
 * frame, almost all of it for sections nobody could see yet. Every section
 * below the hero therefore ships with `data-defer`, which the stylesheet
 * turns into `content-visibility: auto`: the first frame lays out only what
 * is on screen. First paint came in about 100ms earlier than before this
 * site had its departure board and route model at all.
 *
 * The catch with content-visibility is that a skipped section has a
 * placeholder height, so anything that scrolls past it to a target computes
 * the wrong distance. So the deferral is temporary:
 *
 *   - once the page is idle, sections are laid out one per idle callback,
 *     top to bottom, so no single task is long and real heights are in
 *     place within a second or two;
 *   - any in-page jump (a nav link, the enquiry action) lays everything out
 *     first, so it lands where it was aimed;
 *   - a page opened at a #section does the same, then re-aims, because
 *     Safari has no scroll anchoring to hold the target still for it.
 *
 * The attribute is removed directly on the DOM, not through React state:
 * a jump has to have real heights before the browser starts scrolling, in
 * the same click, and a state update would land a frame too late.
 */

import { afterFirstPaint } from '@/components/after-paint';

const idle = (fn: () => void) =>
  'requestIdleCallback' in window
    ? window.requestIdleCallback(fn, { timeout: 2000 })
    : setTimeout(fn, 200);

/** Lay out every deferred section now. */
export function settleAll() {
  for (const el of document.querySelectorAll('[data-defer]')) el.removeAttribute('data-defer');
}

let started = false;

/** Called once, after hydration. */
export function startSettling() {
  if (started) return;
  started = true;

  if (window.location.hash) {
    settleAll();
    const target = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
    target?.scrollIntoView({ behavior: 'instant', block: 'start' });
    return;
  }

  // Capture phase, so it runs before the browser follows the link.
  document.addEventListener(
    'click',
    (e) => {
      const link = (e.target as Element | null)?.closest?.('a[href*="#"]');
      if (link) settleAll();
    },
    true,
  );

  const queue = [...document.querySelectorAll('[data-defer]')];
  const next = () => {
    const el = queue.shift();
    if (!el) return;
    el.removeAttribute('data-defer');
    if (queue.length) idle(next);
  };
  // Not one section before the first frame is on screen.
  afterFirstPaint(next);
}
