import { useEffect, useRef } from 'react';

/**
 * Poll while the page is actually being looked at.
 *
 * ── Why this is not just setInterval ────────────────────────────────
 *
 * Three screens in this app refresh on a timer: the reminder count in the
 * shell, the dashboard, and the waiting-room queue display. All three
 * used a bare `setInterval`, which keeps firing in a tab nobody is
 * looking at -- and these tabs stay open. A doctor opens the dashboard in
 * the morning and leaves it open; the front desk keeps the portal in a
 * background tab all day.
 *
 * Two things follow from that, and the second one costs money:
 *
 *  - Work for nothing. A request, a JSON parse and a re-render per
 *    minute, per open tab, rendering pixels no one can see.
 *  - The clinic's database never gets to sleep. Each clinic runs on a
 *    Neon project whose compute suspends after five minutes idle. A
 *    forgotten background tab polling every sixty seconds means it is
 *    never idle for five minutes, so it never suspends, and the clinic
 *    burns its quota holding a connection open for a tab in someone's
 *    pocket.
 *
 * Pausing while hidden fixes both. The refresh on becoming visible again
 * is the part that makes it better rather than merely cheaper: coming
 * back to the tab shows current data immediately, instead of whatever
 * was true up to a minute ago until the next tick happens to land.
 *
 * @param fn         What to run. Re-reads from a ref each tick, so a
 *                   callback that changes identity every render does not
 *                   restart the timer.
 * @param intervalMs Gap between ticks while visible.
 * @param enabled    Pass false to stop entirely.
 */
export function usePolling(
  fn: () => void | Promise<void>,
  intervalMs: number,
  enabled = true,
) {
  const latest = useRef(fn);
  latest.current = fn;

  useEffect(() => {
    if (!enabled) return;

    let timer: ReturnType<typeof setInterval> | undefined;
    const run = () => void latest.current();

    const start = () => {
      if (timer !== undefined) return;
      timer = setInterval(run, intervalMs);
    };
    const stop = () => {
      if (timer === undefined) return;
      clearInterval(timer);
      timer = undefined;
    };

    // The first load happens straight away whether or not the tab is
    // focused: a page that mounts hidden (restored session, opened in a
    // background tab) must still have its data when it is first shown.
    run();
    if (!document.hidden) start();

    const onVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        // Fresh on arrival, then resume the cadence.
        run();
        start();
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [intervalMs, enabled]);
}
