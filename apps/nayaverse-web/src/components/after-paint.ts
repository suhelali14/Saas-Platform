/**
 * Run something in idle time, but never before the first contentful paint.
 *
 * "Idle" alone is not enough. Measured on a desktop: every file had arrived
 * by about 140ms, and while the browser waited out the web fonts' swap
 * period the main thread looked idle -- so idle callbacks ran then, and the
 * three.js ground's 95ms of setup landed in front of the first frame. The
 * first paint, which is what a visitor actually waits for, came after work
 * that was meant to be optional.
 *
 * So this waits for the browser's own first-contentful-paint entry (or three
 * seconds, where paint timing is unavailable), then asks for idle time.
 * Returns a cancel function.
 */
export function afterFirstPaint(fn: () => void, idleTimeout = 2000): () => void {
  let cancelled = false;
  let idleHandle: number | undefined;
  let observer: PerformanceObserver | undefined;

  const idle = () => {
    if (cancelled) return;
    observer?.disconnect();
    window.clearTimeout(fallback);
    if ('requestIdleCallback' in window) {
      idleHandle = window.requestIdleCallback(() => !cancelled && fn(), { timeout: idleTimeout });
    } else {
      idleHandle = setTimeout(() => !cancelled && fn(), 200) as unknown as number;
    }
  };

  const fallback = window.setTimeout(idle, 3000);
  try {
    observer = new PerformanceObserver((list) => {
      if (list.getEntriesByName('first-contentful-paint').length) idle();
    });
    observer.observe({ type: 'paint', buffered: true });
  } catch {
    // No paint timing: the three-second fallback stands in.
  }

  return () => {
    cancelled = true;
    observer?.disconnect();
    window.clearTimeout(fallback);
    if (idleHandle !== undefined) {
      if ('cancelIdleCallback' in window) window.cancelIdleCallback(idleHandle);
      clearTimeout(idleHandle);
    }
  };
}
