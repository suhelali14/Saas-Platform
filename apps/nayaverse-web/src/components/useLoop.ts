import { useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

/**
 * Whether a repeating piece of motion should be running right now.
 *
 * Everything that loops on this site goes through here, so the rules are
 * written once:
 *
 *   - Never before hydration. The prerendered page is the product and it
 *     is still; a loop only starts once the browser has proved it runs code.
 *   - Never off screen. A loop nobody can see is battery on a phone in a
 *     shop, for nothing.
 *   - Never in a background tab.
 *   - Never under reduced motion. Someone who asked their machine for less
 *     movement gets the still picture, which is complete on its own.
 *   - And never once the reader has pressed pause. Anything that moves on its
 *     own for longer than five seconds has to offer that (WCAG 2.2.2).
 *   - With `holdWhileRead`, not while the pointer is over it or focus is in
 *     it, for loops that change what they say rather than how they look.
 */
export function useLoop<T extends HTMLElement>(threshold = 0.2, { holdWhileRead = false } = {}) {
  const ref = useRef<T>(null);
  const still = useReducedMotion() ?? false;
  const [ready, setReady] = useState(false);
  const [inView, setInView] = useState(false);
  const [shown, setShown] = useState(true);
  const [held, setHeld] = useState(false);
  const [reading, setReading] = useState(false);

  useEffect(() => setReady(true), []);

  // Content that changes what it says waits while someone is pointing at it
  // or has focus inside it: they are reading that row, so it must not turn.
  useEffect(() => {
    const el = ref.current;
    if (!el || !holdWhileRead) return;
    let pointer = false;
    let focus = false;
    const sync = () => setReading(pointer || focus);
    const enter = () => ((pointer = true), sync());
    const leave = () => ((pointer = false), sync());
    const focusIn = () => ((focus = true), sync());
    const focusOut = (e: FocusEvent) => {
      focus = el.contains(e.relatedTarget as Node | null);
      sync();
    };
    el.addEventListener('pointerenter', enter);
    el.addEventListener('pointerleave', leave);
    el.addEventListener('focusin', focusIn);
    el.addEventListener('focusout', focusOut);
    return () => {
      el.removeEventListener('pointerenter', enter);
      el.removeEventListener('pointerleave', leave);
      el.removeEventListener('focusin', focusIn);
      el.removeEventListener('focusout', focusOut);
    };
  }, [holdWhileRead]);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {
      threshold,
    });
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);

  useEffect(() => {
    const sync = () => setShown(document.visibilityState !== 'hidden');
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);

  return {
    ref,
    /** Hydrated and allowed to move at all: the pause control is useful. */
    live: ready && !still,
    held,
    toggle: () => setHeld((h) => !h),
    running: ready && !still && inView && shown && !held && !reading,
  };
}
