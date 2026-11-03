import { useEffect, useRef, useState } from 'react';
import { cx } from '@/components/primitives';
import type { SteelScene } from './steel-scene';

/**
 * The lit cladding behind the page, on machines that can afford it.
 *
 * The prerendered page already has its ground: `body::before` draws the
 * ribs in CSS, and that is what every phone, every crawler and every
 * visitor saving data gets -- complete, and nothing else downloaded. On a
 * desk with a mouse and WebGL2, three.js is fetched after the page is idle
 * and the same steel is drawn as a surface under a lamp that follows the
 * pointer, fading in over the CSS ground it replaces.
 *
 * The element is the same empty div on the server and the client, so it
 * never disturbs hydration; the canvas is added afterwards. Reduced motion
 * keeps the lamp where the CSS wash already is: lit, still.
 */
export function SteelGround() {
  const host = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
    const desk = window.matchMedia('(pointer: fine) and (min-width: 1024px)').matches;
    if (!desk || nav.connection?.saveData) return;
    try {
      if (!document.createElement('canvas').getContext('webgl2')) return;
    } catch {
      return;
    }
    const follow = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let scene: SteelScene | null = null;
    let cancelled = false;
    const start = () => {
      void import('./steel-scene')
        .then(({ createSteelScene }) => {
          if (cancelled || !host.current) return;
          scene = createSteelScene(host.current, { follow, onReady: () => setReady(true) });
        })
        .catch(() => undefined);
    };
    const hasIdle = 'requestIdleCallback' in window;
    const handle = hasIdle ? window.requestIdleCallback(start, { timeout: 2000 }) : window.setTimeout(start, 600);
    return () => {
      cancelled = true;
      if (hasIdle) window.cancelIdleCallback(handle);
      else window.clearTimeout(handle);
      scene?.dispose();
    };
  }, []);

  return (
    <div
      ref={host}
      aria-hidden="true"
      className={cx(
        'pointer-events-none fixed inset-0 z-0 transition-opacity duration-1000',
        ready ? 'opacity-100' : 'opacity-0',
      )}
    />
  );
}
