import { useEffect, useRef } from 'react';

/**
 * Runs when the assistant has just changed something.
 *
 * The assistant works from a bar that sits over whatever screen is open.
 * When it records vitals, takes a payment or checks somebody in, the
 * screen underneath is showing what was true a moment ago. A screen that
 * does not move after "done" reads as nothing having happened, so every
 * screen that lists things the assistant can change reloads itself here.
 *
 * The bar announces a change with a window event (AssistantBar.tsx), so
 * screens need not know the bar exists, and the bar need not know which
 * screen is open.
 */
export const ASSISTANT_CHANGED = 'assistant:changed';

export function useAssistantChanged(reload: () => void) {
  // The newest reload, without re-subscribing on every render.
  const latest = useRef(reload);
  latest.current = reload;
  useEffect(() => {
    const run = () => latest.current();
    window.addEventListener(ASSISTANT_CHANGED, run);
    return () => window.removeEventListener(ASSISTANT_CHANGED, run);
  }, []);
}
