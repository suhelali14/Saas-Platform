import { useEffect, useRef, useState } from 'react';

/**
 * True once the element has been on screen, and true for good afterwards.
 *
 * Not a scroll-animation helper. It exists for one behaviour: a ruled line
 * draws itself the first time you reach it, the way a ruling pen lays one
 * down. Re-triggering on the way back up would turn a material detail into a
 * fidget, so the observer disconnects on the first hit.
 *
 * Returns true immediately where there is no observer -- during the build
 * render, and on anything old enough to lack one -- so the line is simply
 * already drawn rather than missing.
 */
export function useInView<T extends HTMLElement>(threshold = 0.4) {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    if (typeof IntersectionObserver === 'undefined') {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [seen, threshold]);

  return { ref, seen };
}
