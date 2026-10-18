import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

/**
 * Toasts for the result of an action.
 *
 * The app had 46 inline success/error banners, each pushing the page around
 * as it appeared and disappeared, and each only visible if you happened to
 * be looking at that part of the screen. A receptionist who saves a patient
 * and immediately scrolls has no idea whether it worked.
 *
 * What stays inline, deliberately:
 *  - **Field-level validation.** "Phone number is too long" belongs next to
 *    the phone field, not in the corner of the screen.
 *  - **Blocking states.** "This clinic is not configured" is the content of
 *    the page, not a notification about it.
 *
 * What becomes a toast: the outcome of something you did. Saved, deleted,
 * dispensed, failed.
 */

type ToastKind = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  /** Errors stay far longer than confirmations: a success is a glance, a
   * failure has to be read and usually acted on. */
  duration: number;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const DURATION: Record<ToastKind, number> = {
  success: 3500,
  info: 4500,
  error: 9000,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = nextId.current++;
    setToasts((prev) => {
      // Saving the same form twice should not stack two identical toasts.
      const deduped = prev.filter((t) => !(t.kind === kind && t.message === message));
      // Cap the stack: beyond four, the oldest are unread anyway and they
      // start covering the content they are describing.
      return [...deduped, { id, kind, message, duration: DURATION[kind] }].slice(-4);
    });
  }, []);

  const api = useRef<ToastApi>({
    success: (m) => push('success', m),
    error: (m) => push('error', m),
    info: (m) => push('info', m),
  });
  // Keep the closure fresh without changing the object identity, so
  // consumers never re-render just because a toast appeared.
  api.current = {
    success: (m) => push('success', m),
    error: (m) => push('error', m),
    info: (m) => push('info', m),
  };

  return (
    <ToastContext.Provider value={api.current}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastViewport({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    // Bottom on phones (reachable with a thumb, clear of the top bar),
    // bottom-right on desktop. `pointer-events-none` on the stack so it
    // never blocks a click on the page behind it; each toast re-enables it.
    <div
      className="fixed inset-x-0 bottom-0 sm:inset-x-auto sm:right-4 sm:bottom-4 z-[100] flex flex-col items-center sm:items-end gap-2 p-3 pointer-events-none"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))' }}
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

const STYLE: Record<ToastKind, { ring: string; icon: React.ReactNode }> = {
  success: { ring: 'border-ink-success/30', icon: <CheckCircle2 size={16} className="text-ink-success" /> },
  error: { ring: 'border-ink-danger/40', icon: <AlertTriangle size={16} className="text-ink-danger" /> },
  info: { ring: 'border-border/15', icon: <Info size={16} className="text-foreground/80" /> },
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(() => onDismiss(toast.id), toast.duration);
    return () => clearTimeout(timer);
    // Re-arming on unpause restarts the full duration, which is the
    // forgiving behaviour: someone who hovered to read it gets to finish.
  }, [paused, toast.id, toast.duration, onDismiss]);

  return (
    <div
      role="status"
      // Errors interrupt a screen reader; confirmations wait their turn.
      aria-live={toast.kind === 'error' ? 'assertive' : 'polite'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className={`pointer-events-auto w-full sm:w-auto sm:min-w-[280px] sm:max-w-sm flex items-start gap-2.5 px-3.5 py-3 rounded-xl border bg-popover shadow-overlay toast-enter ${STYLE[toast.kind].ring}`}
    >
      <span className="shrink-0 mt-0.5">{STYLE[toast.kind].icon}</span>
      <p className="flex-1 text-sm text-popover-foreground leading-snug">{toast.message}</p>
      <button
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 -mr-1 -mt-0.5 p-1 rounded-md text-muted-foreground/70 hover:text-foreground hover:bg-foreground/10"
        aria-label="Dismiss"
      >
        <X size={13} />
      </button>
    </div>
  );
}

/**
 * Returns a no-op API rather than throwing when used outside the provider.
 *
 * A missing provider should never be the reason a save fails — losing the
 * confirmation is a far smaller problem than losing the action.
 */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (ctx) return ctx;
  return { success: () => {}, error: () => {}, info: () => {} };
}
