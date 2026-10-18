import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, User, CornerDownLeft, AlertTriangle } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { cn } from '@/lib/utils';
import { CATEGORY_BADGES } from '../lib/categories';

/**
 * Jump to any patient or screen by typing. Ctrl+K.
 *
 * This exists because of volume, not polish. Reaching a patient meant
 * Patients → type in the search box → wait → click the row: four
 * actions and a mouse, repeated for every one of forty patients in a
 * day. The clinical work is the 7-10 minutes with the person; everything
 * around it is overhead, and this is the overhead that repeats most.
 *
 * Keyboard-only throughout. A doctor between patients has one hand on a
 * keyboard and is not looking for a mouse, and reception is often
 * holding a phone — so every path through this works without pointing at
 * anything: Ctrl+K, type, arrows, Enter.
 *
 * ── What it shows ────────────────────────────────────────────────────
 *
 * Patients first, because that is what is being looked for nine times
 * out of ten. Each row carries the UHID and phone, which is how two
 * people with the same name are told apart at a front desk — and an
 * allergy marker, because this is a list of patients a doctor is about
 * to open and that is the one fact worth seeing a moment early.
 *
 * Screens are matched too, so "bil" reaches Billing. They are listed
 * after patients and only when they match, rather than filling the
 * panel before anything has been typed.
 */

type PatientHit = {
  id: string;
  uhid: string;
  name: string;
  phone: string | null;
  category: string;
  allergies: string | null;
  lastSeen: string | null;
};

type Destination = { label: string; to: string; keywords: string };

/** The screens worth jumping to, with the words people actually type. */
const DESTINATIONS: Destination[] = [
  { label: 'Dashboard', to: '/', keywords: 'home today overview' },
  { label: "Today's Queue", to: '/queue', keywords: 'queue waiting appointments today' },
  { label: 'Patients', to: '/patients', keywords: 'patients records people' },
  { label: 'Billing', to: '/billing', keywords: 'billing invoice payment money cash' },
  { label: 'Pharmacy', to: '/pharmacy', keywords: 'pharmacy dispense stock inventory medicine' },
  { label: 'Labs', to: '/labs', keywords: 'labs tests results pathology' },
  { label: 'Reminders', to: '/reminders', keywords: 'reminders followups follow-up' },
  { label: 'Expenses', to: '/expenses', keywords: 'expenses spending profit loss' },
  { label: 'Analytics', to: '/analytics', keywords: 'analytics reports trends' },
  { label: 'Website', to: '/website', keywords: 'website public page blog gallery' },
  { label: 'Settings', to: '/settings', keywords: 'settings clinic profile password documents' },
];

export function QuickSwitcher() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [patients, setPatients] = useState<PatientHit[]>([]);
  const [cursor, setCursor] = useState(0);
  const [searching, setSearching] = useState(false);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Opening ───────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Reset on open rather than on close, so the panel never flashes the
  // previous search on its way out.
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setPatients([]);
    setCursor(0);
    // The input is rendered by this same pass, so focus waits a frame.
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open]);

  // ── Searching ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const term = query.trim();
    if (term.length < 2) {
      setPatients([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    // Debounced, and the result of a superseded search is discarded: at
    // typing speed an earlier, slower response can otherwise land after
    // a newer one and show results for a prefix.
    let cancelled = false;
    const t = setTimeout(() => {
      apiFetch<{ data: PatientHit[] }>(`/patients?search=${encodeURIComponent(term)}`)
        .then((r) => {
          if (cancelled) return;
          setPatients(r.data.slice(0, 8));
          setCursor(0);
        })
        .catch(() => { if (!cancelled) setPatients([]); })
        .finally(() => { if (!cancelled) setSearching(false); });
    }, 160);

    return () => { cancelled = true; clearTimeout(t); };
  }, [query, open]);

  const term = query.trim().toLowerCase();
  const screens = term
    ? DESTINATIONS.filter(
        (d) => d.label.toLowerCase().includes(term) || d.keywords.includes(term),
      ).slice(0, 4)
    : [];

  const rows = [
    ...patients.map((p) => ({ kind: 'patient' as const, patient: p })),
    ...screens.map((s) => ({ kind: 'screen' as const, screen: s })),
  ];

  const go = useCallback(
    (index: number) => {
      const row = rows[index];
      if (!row) return;
      setOpen(false);
      navigate(row.kind === 'patient' ? `/patients/${row.patient.id}` : row.screen.to);
    },
    [rows, navigate],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-4 pt-[12vh]"
      // A click outside closes it; a click inside must not.
      onClick={() => setOpen(false)}
      role="presentation"
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-xl border border-border/15 bg-popover shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Jump to a patient or screen"
      >
        <div className="flex items-center gap-2.5 border-b border-border/10 px-4">
          <Search size={15} className="shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, rows.length - 1)); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
              else if (e.key === 'Enter') { e.preventDefault(); go(cursor); }
            }}
            placeholder="Patient name, file number, phone — or a screen"
            // 16px on a touch device, like every other field: Safari
            // zooms the viewport below that and leaves it zoomed.
            className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60 [@media(pointer:coarse)]:text-base"
            aria-autocomplete="list"
            aria-controls="quick-switcher-results"
          />
          <kbd className="shrink-0 rounded border border-border/20 px-1.5 py-0.5 text-[10px] text-muted-foreground">esc</kbd>
        </div>

        <div id="quick-switcher-results" role="listbox" className="max-h-[52vh] overflow-y-auto">
          {rows.map((row, i) => {
            const selected = i === cursor;
            return (
              <button
                key={row.kind === 'patient' ? row.patient.id : row.screen.to}
                type="button"
                role="option"
                aria-selected={selected}
                onMouseEnter={() => setCursor(i)}
                onClick={() => go(i)}
                className={cn(
                  'flex w-full items-center gap-3 px-4 py-2.5 text-left',
                  selected ? 'bg-accent' : 'hover:bg-accent/50',
                )}
              >
                {row.kind === 'patient' ? (
                  <>
                    <User size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-sm">{row.patient.name}</span>
                        {row.patient.category !== 'GENERAL' && CATEGORY_BADGES[row.patient.category] && (
                          <span className={cn('shrink-0 rounded-full px-1.5 py-0.5 text-[10px]', CATEGORY_BADGES[row.patient.category]!.color)}>
                            {CATEGORY_BADGES[row.patient.category]!.label}
                          </span>
                        )}
                        {/* A moment early is the whole point: this is a
                            list of patients somebody is about to open. */}
                        {row.patient.allergies && (
                          <span
                            className="flex shrink-0 items-center gap-0.5 text-[10px] text-ink-danger"
                            title={`Allergic to ${row.patient.allergies}`}
                          >
                            <AlertTriangle size={9} aria-hidden="true" /> allergy
                          </span>
                        )}
                      </span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {row.patient.uhid}
                        {row.patient.phone ? ` · ${row.patient.phone}` : ''}
                        {row.patient.lastSeen
                          ? ` · last seen ${new Date(row.patient.lastSeen).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
                          : ' · never seen'}
                      </span>
                    </span>
                  </>
                ) : (
                  <>
                    <CornerDownLeft size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="flex-1 text-sm">{row.screen.label}</span>
                    <span className="text-[11px] text-muted-foreground">screen</span>
                  </>
                )}
              </button>
            );
          })}

          {rows.length === 0 && (
            <p className="px-4 py-6 text-center text-xs text-muted-foreground">
              {query.trim().length < 2
                ? 'Type a name, file number or phone number.'
                : searching
                  ? 'Searching…'
                  : `Nothing matching “${query.trim()}”.`}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-border/10 px-4 py-2 text-[10px] text-muted-foreground">
          <span><kbd className="rounded border border-border/20 px-1">↑</kbd> <kbd className="rounded border border-border/20 px-1">↓</kbd> move</span>
          <span><kbd className="rounded border border-border/20 px-1">↵</kbd> open</span>
          <span className="ml-auto">Ctrl K anywhere</span>
        </div>
      </div>
    </div>
  );
}
