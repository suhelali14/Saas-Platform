import { useEffect, useState } from 'react';
import { Search, AlertTriangle } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { Input } from './ui/input';

/** ₹1,23,456 -- Indian grouping, no paise unless there are some. */
export function rupees(v: number | string | null | undefined): string {
  const n = Number(v ?? 0);
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export function shortDate(iso: string | Date | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function dateTime(iso: string | Date | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

/** "2 days", "5 hours" -- how long since. */
export function since(iso: string | Date): string {
  const h = Math.max(0, (Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  if (h < 36) return `${Math.round(h)} h`;
  return `${Math.round(h / 24)} days`;
}

/** The page title row: the condensed title, a line under it, actions on the right. */
export function PageHeader({ title, sub, children }: { title: string; sub?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1>{title}</h1>
        {sub && <p className="mt-2 text-[15px] text-muted-foreground">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

/** A card with a plain heading. */
export function Panel({ title, aside, children, className = '' }: { title?: React.ReactNode; aside?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-border/15 bg-card p-4 sm:p-5 ${className}`}>
      {(title || aside) && (
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          {title && <h2 className="text-[16px] font-semibold">{title}</h2>}
          {aside && <div className="text-[13px] text-muted-foreground">{aside}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

const TONE: Record<string, string> = {
  good: 'tone-success', warn: 'tone-warning', bad: 'tone-danger', info: 'tone-info', quiet: 'tone-neutral',
};

export function Chip({ tone = 'quiet', children }: { tone?: keyof typeof TONE; children: React.ReactNode }) {
  return <span className={`inline-block rounded px-1.5 py-0.5 text-[12px] font-semibold ${TONE[tone]}`}>{children}</span>;
}

/** A field label above an input, as everywhere in the portal. */
export function FieldLabel({ htmlFor, children, hint }: { htmlFor?: string; children: React.ReactNode; hint?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-medium">
      {children}{hint && <span className="font-normal text-muted-foreground"> {hint}</span>}
    </label>
  );
}

export const FIELD = 'w-full h-9 px-3 rounded-md bg-background border border-input/60 text-[14px] outline-none focus:border-ring';

export interface PickedPatient { id: string; uhid: string; name: string; phone: string | null; age: number | null; gender: string | null; allergies: string | null }

/** Find a patient by name, phone or file number. */
export function PatientPicker({ value, onChange, autoFocus }: { value: PickedPatient | null; onChange: (p: PickedPatient | null) => void; autoFocus?: boolean }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<PickedPatient[]>([]);
  useEffect(() => {
    if (value || q.trim().length < 2) { setHits([]); return; }
    const t = setTimeout(async () => {
      try { setHits((await apiFetch<{ data: PickedPatient[] }>(`/patients?search=${encodeURIComponent(q.trim())}`)).data.slice(0, 6)); } catch { setHits([]); }
    }, 220);
    return () => clearTimeout(t);
  }, [q, value]);

  if (value) {
    return (
      <div className="flex items-start justify-between gap-3 rounded-lg bg-accent/60 px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold">{value.name} <span className="text-[13px] font-normal text-muted-foreground">· {value.uhid}</span></p>
          <p className="text-[13px] text-muted-foreground">{[value.age != null ? `${value.age}y` : null, value.gender, value.phone].filter(Boolean).join(' · ')}</p>
          {value.allergies && <p className="mt-0.5 flex items-center gap-1 text-[13px] font-medium text-ink-danger"><AlertTriangle size={13} /> Allergic to {value.allergies}</p>}
        </div>
        <button type="button" onClick={() => { onChange(null); setQ(''); }} className="shrink-0 text-[13px] text-muted-foreground hover:text-foreground">Change</button>
      </div>
    );
  }
  return (
    <div className="relative">
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, phone or file number" className="pl-9" autoFocus={autoFocus} autoComplete="off" aria-label="Find the patient" />
      {hits.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border/20 bg-popover shadow-lg">
          {hits.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => onChange(p)} className="block w-full px-3 py-2 text-left text-[14px] hover:bg-accent">
                {p.name} <span className="text-[12.5px] text-muted-foreground">· {p.uhid}{p.phone ? ` · ${p.phone}` : ''}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** A row of label/value pairs, for money summaries. */
export function Sums({ rows }: { rows: { label: string; value: React.ReactNode; strong?: boolean; tone?: 'warn' | 'good' }[] }) {
  return (
    <dl className="space-y-1.5 text-[14px] tabular-nums">
      {rows.map((r) => (
        <div key={r.label} className={`flex items-baseline justify-between gap-4 ${r.strong ? 'border-t border-border/15 pt-1.5 text-[15px] font-semibold' : ''}`}>
          <dt className={r.strong ? '' : 'text-muted-foreground'}>{r.label}</dt>
          <dd className={r.tone === 'warn' ? 'font-semibold text-ink-warning' : r.tone === 'good' ? 'font-semibold text-ink-success' : ''}>{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}
