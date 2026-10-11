import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * Wraps an async handler so a form knows it is busy.
 *
 * `<Button>` manages its own pending state, but a `<form onSubmit>` submits
 * through the form element, not through the button's onClick -- pressing
 * Enter in a text field bypasses the button entirely. So the form needs its
 * own guard, or Enter-mashing fires a request per keypress.
 *
 * Re-entry is blocked while a call is in flight. Combined with the
 * deduplication in `apiFetch`, that is two independent layers: this one
 * stops the handler running twice, and that one stops a duplicate request
 * reaching the server even if some other path does run it twice.
 */
export function useAsync<A extends unknown[]>(
  handler: (...args: A) => Promise<unknown>,
): [(...args: A) => Promise<void>, boolean] {
  const [pending, setPending] = useState(false);
  const running = useRef(false);
  const mounted = useRef(true);

  useEffect(() => () => { mounted.current = false; }, []);

  const run = useCallback(
    async (...args: A) => {
      if (running.current) return;
      running.current = true;
      setPending(true);
      try {
        await handler(...args);
      } finally {
        running.current = false;
        // The component may have unmounted -- deleting the row its form
        // lived in is the common case.
        if (mounted.current) setPending(false);
      }
    },
    [handler],
  );

  return [run, pending];
}
