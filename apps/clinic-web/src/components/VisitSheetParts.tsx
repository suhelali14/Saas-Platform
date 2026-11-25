import { useEffect, useRef, useState } from 'react';
import { Plus, RotateCcw, X } from 'lucide-react';
import { apiFetch } from '../lib/api';
import type { DraftMedicine } from '../contexts/ScribeContext';

/**
 * The parts of the visit sheet that make it quicker than a pen.
 *
 * A doctor writing on paper does not open a form for the complaint, another
 * for the medicines and a third for the tests. They write one sheet, top to
 * bottom, and most of what they write they have written a hundred times.
 * The sheet (ScribePanel's review state) is that one page; these are the
 * shortcuts on it:
 *
 *   - a medicine's name completes from the clinic's own list as it is typed;
 *   - the doctor's usual prescriptions, and this patient's last one, are one
 *     press each;
 *   - the diagnoses this doctor writes most are one press each;
 *   - a test is added by typing a few letters of its name.
 *
 * None of them saves anything. They fill the sheet; the doctor reads it and
 * confirms, exactly as for a note the assistant wrote by listening.
 */

interface Drug { id: string; name: string; composition: string | null; approximate?: boolean }
interface UsualItem { drugId?: string; drugName: string; dosage: string; frequency: string; duration: string; instructions: string | null }
interface Usual { id: string; name: string; items: UsualItem[] }

/** A blank line on the sheet. */
export const blankMedicine = (): DraftMedicine => ({
  spoken: '', drugId: null, drugName: '', composition: null, match: 'none', approximate: false,
  alternatives: [], dosage: '', frequency: 'OD', duration: '', instructions: '', source: '', notes: [],
});

const asLine = (it: UsualItem): DraftMedicine => ({
  ...blankMedicine(),
  drugId: it.drugId ?? null, drugName: it.drugName, dosage: it.dosage, frequency: it.frequency,
  duration: it.duration, instructions: it.instructions ?? '', match: it.drugId ? 'catalogue' : 'none',
});

/**
 * A medicine's name, completing from the clinic's list.
 *
 * One search per pause in typing, and an earlier one is cancelled when a
 * later one starts: the list under the box must never be the answer to
 * something typed three letters ago, because the pick attaches the row
 * the pharmacy takes stock from (the reasoning is in ClinicalForms.tsx).
 */
export function MedicineName({
  value, className, onType, onPick,
}: {
  value: string;
  className?: string;
  /** Typed by hand: the link to the list is broken until a row is picked. */
  onType: (name: string) => void;
  onPick: (drug: Drug) => void;
}) {
  const [found, setFound] = useState<Drug[]>([]);
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const flying = useRef<AbortController | undefined>(undefined);
  useEffect(() => () => { clearTimeout(timer.current); flying.current?.abort(); }, []);

  const search = (name: string) => {
    onType(name);
    clearTimeout(timer.current);
    flying.current?.abort();
    if (name.trim().length < 2) { setFound([]); setOpen(false); return; }
    timer.current = setTimeout(async () => {
      const controller = new AbortController();
      flying.current = controller;
      try {
        const res = await apiFetch<{ data: Drug[] }>(`/drugs?search=${encodeURIComponent(name.trim())}`, { signal: controller.signal });
        setFound(res.data.slice(0, 8));
        setAt(0);
        setOpen(res.data.length > 0);
      } catch { /* cancelled by the next keystroke */ }
    }, 180);
  };
  const pick = (d: Drug) => { onPick(d); setOpen(false); setFound([]); };

  return (
    <div className={`relative ${className ?? ''}`}>
      <input
        aria-label="Medicine name" placeholder="Medicine" value={value} autoComplete="off"
        role="combobox" aria-expanded={open} aria-autocomplete="list"
        onChange={(e) => search(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === 'ArrowDown') { e.preventDefault(); setAt((i) => Math.min(found.length - 1, i + 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setAt((i) => Math.max(0, i - 1)); }
          else if (e.key === 'Enter' && found[at]) { e.preventDefault(); pick(found[at]!); }
          else if (e.key === 'Escape') setOpen(false);
        }}
        className="w-full px-2 py-2 rounded-lg bg-foreground/5 border border-border/10 text-[13px] outline-none focus:border-primary"
      />
      {open && (
        <ul role="listbox" className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-auto rounded-lg border border-border/20 bg-background shadow-overlay">
          {found.map((d, i) => (
            <li key={d.id} role="option" aria-selected={i === at}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(d)}
                className={`block w-full px-3 py-2 text-left ${i === at ? 'bg-accent' : 'hover:bg-accent/60'}`}>
                <span className="block text-[13.5px] font-medium">{d.name}</span>
                {d.composition && <span className="block truncate text-[12px] text-muted-foreground">{d.composition}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * What this doctor usually writes, and what this patient was last given.
 * One press adds the lines to the sheet; they can still be changed.
 */
export function Usuals({ patientId, onAdd }: { patientId: string | null; onAdd: (lines: DraftMedicine[]) => void }) {
  const [usuals, setUsuals] = useState<Usual[]>([]);
  const [last, setLast] = useState<{ createdAt?: string; items: UsualItem[] } | null>(null);
  useEffect(() => {
    apiFetch<{ data: Usual[] }>('/prescription-templates').then((r) => setUsuals(r.data)).catch(() => {});
  }, []);
  useEffect(() => {
    if (!patientId) return;
    apiFetch<{ prescription: { createdAt?: string; items: UsualItem[] } | null }>(`/patients/${patientId}/last-prescription`)
      .then((r) => setLast(r.prescription)).catch(() => {});
  }, [patientId]);
  if (usuals.length === 0 && !last) return null;
  const chip = 'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-foreground/5 hover:bg-foreground/10 text-[12.5px] text-foreground/85';
  return (
    <div className="mb-3 flex flex-wrap items-center gap-1.5">
      {last && last.items.length > 0 && (
        <button type="button" className={`${chip} font-medium`} onClick={() => onAdd(last.items.map(asLine))}>
          <RotateCcw size={12} aria-hidden="true" /> Same as last time ({last.items.length})
        </button>
      )}
      {usuals.map((u) => (
        <button type="button" key={u.id} className={chip} onClick={() => onAdd(u.items.map(asLine))} title={u.items.map((i) => i.drugName).join(', ')}>
          <Plus size={12} aria-hidden="true" /> {u.name}
        </button>
      ))}
    </div>
  );
}

/** The diagnoses this doctor writes most, one press each. */
export function FrequentDiagnoses({ onPick }: { onPick: (diagnosis: string) => void }) {
  const [list, setList] = useState<string[]>([]);
  useEffect(() => {
    apiFetch<{ data: string[] }>('/diagnoses/frequent').then((r) => setList(r.data.slice(0, 8))).catch(() => {});
  }, []);
  if (list.length === 0) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {list.map((d) => (
        <button type="button" key={d} onClick={() => onPick(d)} className="px-2 py-1 rounded-lg bg-foreground/5 hover:bg-foreground/10 text-[12px] text-foreground/80">{d}</button>
      ))}
    </div>
  );
}

/** The tests on the sheet, and a box that adds one by a few letters of its name. */
export function Tests({ tests, onChange }: { tests: string[]; onChange: (tests: string[]) => void }) {
  const [catalog, setCatalog] = useState<string[]>([]);
  const [typed, setTyped] = useState('');
  useEffect(() => {
    apiFetch<{ data: { name: string }[] }>('/lab-tests').then((r) => setCatalog(r.data.map((t) => t.name))).catch(() => {});
  }, []);
  const want = typed.trim().toLowerCase();
  const offered = want.length < 2 ? [] : catalog.filter((n) => n.toLowerCase().includes(want) && !tests.includes(n)).slice(0, 6);
  const add = (name: string) => {
    const clean = name.trim();
    if (clean && !tests.some((t) => t.toLowerCase() === clean.toLowerCase())) onChange([...tests, clean]);
    setTyped('');
  };
  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        {tests.map((t) => (
          <span key={t} className="flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-lg bg-foreground/5 text-[12.5px]">
            {t}
            <button type="button" onClick={() => onChange(tests.filter((x) => x !== t))} aria-label={`Do not order ${t}`} className="p-1 rounded hover:bg-foreground/10"><X size={11} /></button>
          </span>
        ))}
        <input
          aria-label="Add a test" placeholder={tests.length ? 'Another test' : 'Type a test: CBC, sugar, X-ray…'} value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(offered[0] ?? typed); } }}
          className="min-w-[12rem] flex-1 px-2.5 py-1.5 rounded-lg bg-foreground/5 border border-border/10 text-[13px] outline-none focus:border-primary"
        />
      </div>
      {offered.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {offered.map((n) => (
            <button type="button" key={n} onClick={() => add(n)} className="flex items-center gap-1 px-2 py-1 rounded-lg border border-border/20 hover:bg-accent text-[12px]">
              <Plus size={11} aria-hidden="true" /> {n}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
