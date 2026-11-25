import { useEffect, useMemo, useState } from 'react';
import { History, Search, X } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { toDateInput } from '../lib/date';

/**
 * Narrowing a patient's history to what the doctor is looking for.
 *
 * A patient who has come for six years has sixty days on file. The doctor
 * in front of them wants one thing out of it: every time metformin was
 * changed, the lab reports from this year, the last time it was called
 * gastritis. Scrolling sixty cards for that is the work the software is
 * supposed to take away.
 *
 * So three things, each one tap or a few letters:
 *
 *   what      notes, medicines, tests, forms, certificates, bills
 *   when      the last three months, six months, a year, or all of it
 *   words     a diagnosis, a medicine or a test, typed
 *
 * Used in two places: on the patient's file, above the days; and inside
 * a consultation ("Past visits"), so the doctor does not leave the visit
 * to look something up.
 *
 * The narrowing happens in the browser, on a history that is already
 * loaded: it is instant and costs nothing. The server takes the same
 * `from` and `to` for a history too long to send whole.
 */

export type HistoryKind = 'all' | 'notes' | 'medicines' | 'tests' | 'forms' | 'certificates' | 'bills';
export type HistoryPeriod = 'all' | '3m' | '6m' | '1y';
export interface HistoryFilter { kind: HistoryKind; period: HistoryPeriod; words: string }
export const NO_FILTER: HistoryFilter = { kind: 'all', period: 'all', words: '' };
export const isFiltered = (f: HistoryFilter) => f.kind !== 'all' || f.period !== 'all' || f.words.trim() !== '';

/** The shape of a day that both screens share. Each list may be empty. */
export interface FilterableDay {
  key: string;
  appointments: { reason?: string | null }[];
  caseSheets: { chiefComplaint?: string | null; diagnosis?: string | null; notes?: string | null; hopi?: string | null }[];
  prescriptions: { items: { drugName: string }[] }[];
  certificates: { type: string }[];
  labOrders: { items: { testName: string; resultText?: string | null }[] }[];
  bills: unknown[];
  records: { title: string; summary?: string }[];
}

const KINDS: { value: HistoryKind; label: string }[] = [
  { value: 'all', label: 'Everything' },
  { value: 'notes', label: 'Notes' },
  { value: 'medicines', label: 'Medicines' },
  { value: 'tests', label: 'Tests' },
  { value: 'forms', label: 'Forms' },
  { value: 'certificates', label: 'Certificates' },
  { value: 'bills', label: 'Bills' },
];
const PERIODS: { value: HistoryPeriod; label: string }[] = [
  { value: 'all', label: 'All time' },
  { value: '3m', label: '3 months' },
  { value: '6m', label: '6 months' },
  { value: '1y', label: '1 year' },
];
const MONTHS_BACK: Record<HistoryPeriod, number> = { all: 0, '3m': 3, '6m': 6, '1y': 12 };

function since(period: HistoryPeriod): string | null {
  if (period === 'all') return null;
  const d = new Date();
  d.setMonth(d.getMonth() - MONTHS_BACK[period]);
  return toDateInput(d);
}

/**
 * The days that match, each holding only what was asked for.
 *
 * Choosing "Medicines" does not just pick the days that had a
 * prescription: it leaves only the prescription on each, so the list
 * reads as the patient's medicines over time. The booking stays, because
 * it is what dates the day and names the doctor.
 */
export function filterDays<D extends FilterableDay>(days: D[], filter: HistoryFilter): D[] {
  if (!isFiltered(filter)) return days;
  const from = since(filter.period);
  const words = filter.words.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const has = (...texts: (string | null | undefined)[]) => {
    const all = texts.filter(Boolean).join(' ').toLowerCase();
    return words.every((w) => all.includes(w));
  };
  const out: D[] = [];
  for (const day of days) {
    if (from && day.key < from) continue;
    const keep = (kind: HistoryKind) => filter.kind === 'all' || filter.kind === kind;
    let d: D = {
      ...day,
      caseSheets: keep('notes') ? day.caseSheets : [],
      prescriptions: keep('medicines') ? day.prescriptions : [],
      labOrders: keep('tests') ? day.labOrders : [],
      records: keep('forms') ? day.records : [],
      certificates: keep('certificates') ? day.certificates : [],
      bills: keep('bills') ? day.bills : [],
    };
    if (words.length > 0) {
      // With words, a day is kept for the parts of it that contain them.
      d = {
        ...d,
        caseSheets: d.caseSheets.filter((c) => has(c.chiefComplaint, c.diagnosis, c.notes, c.hopi)),
        prescriptions: d.prescriptions.filter((p) => has(...p.items.map((i) => i.drugName))),
        labOrders: d.labOrders.filter((l) => has(...l.items.flatMap((i) => [i.testName, i.resultText]))),
        records: d.records.filter((r) => has(r.title, r.summary)),
        certificates: d.certificates.filter((c) => has(c.type.replace(/_/g, ' '))),
        bills: [],
      };
    }
    const something = d.caseSheets.length + d.prescriptions.length + d.labOrders.length + d.records.length + d.certificates.length + d.bills.length > 0;
    // Unfiltered by kind and words, a day that was only a booking still counts.
    if (something || (filter.kind === 'all' && words.length === 0)) out.push(d);
  }
  return out;
}

const CHIP = 'rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors min-h-[34px]';
const CHIP_ON = 'border-foreground bg-foreground text-background';
const CHIP_OFF = 'border-border/20 bg-background hover:bg-accent';

export function HistoryFilters({ value, onChange, showing, of, kinds }: {
  value: HistoryFilter;
  onChange: (next: HistoryFilter) => void;
  /** How many days are shown, and out of how many, so a filter that
   *  hides most of the record says so. */
  showing: number;
  of: number;
  /** Leave some kinds out where the screen cannot show them. */
  kinds?: HistoryKind[];
}) {
  const offered = kinds ? KINDS.filter((k) => kinds.includes(k.value)) : KINDS;
  return (
    <div className="mb-3 space-y-2">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Show">
        {offered.map((k) => (
          <button key={k.value} type="button" aria-pressed={value.kind === k.value} onClick={() => onChange({ ...value, kind: k.value })} className={`${CHIP} ${value.kind === k.value ? CHIP_ON : CHIP_OFF}`}>
            {k.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="From">
          {PERIODS.map((p) => (
            <button key={p.value} type="button" aria-pressed={value.period === p.value} onClick={() => onChange({ ...value, period: p.value })} className={`${CHIP} ${value.period === p.value ? CHIP_ON : CHIP_OFF}`}>
              {p.label}
            </button>
          ))}
        </div>
        <label className="relative min-w-[11rem] flex-1">
          <span className="sr-only">Find a diagnosis, medicine or test in the history</span>
          <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={value.words}
            onChange={(e) => onChange({ ...value, words: e.target.value })}
            placeholder="Find a diagnosis, medicine or test"
            className="h-[34px] w-full rounded-full border border-border/20 bg-background pl-8 pr-3 text-[13px] outline-none focus:border-ring"
          />
        </label>
      </div>
      {isFiltered(value) && (
        <p className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground" role="status">
          {showing === 0 ? 'Nothing in the history matches.' : `Showing ${showing} of ${of} day${of === 1 ? '' : 's'}.`}
          <button type="button" onClick={() => onChange(NO_FILTER)} className="inline-flex items-center gap-1 font-medium text-foreground underline-offset-4 hover:underline">
            <X size={12} aria-hidden="true" /> Show everything
          </button>
        </p>
      )}
    </div>
  );
}

// ── Inside a consultation ─────────────────────────────────────────────

interface PastSheet { id: string; createdAt: string; chiefComplaint: string | null; diagnosis: string | null; notes: string | null; hopi?: string | null; vitals?: Record<string, string> | null; doctor: { name: string } }
interface PastRx { id: string; createdAt: string; items: { drugName: string; dosage: string; frequency: string; duration: string }[] }
interface PastLab { id: string; createdAt: string; items: { id: string; testName: string; resultText: string | null }[] }
interface PastCert { id: string; createdAt: string; type: string }
interface PastHistory { caseSheets: PastSheet[]; prescriptions: PastRx[]; labOrders: PastLab[]; certificates: PastCert[] }
interface PastDay extends FilterableDay { caseSheets: PastSheet[]; prescriptions: PastRx[]; labOrders: PastLab[]; certificates: PastCert[] }

const dayOf = (iso: string) => toDateInput(new Date(iso));
const readDay = (key: string) => new Date(`${key}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * The patient's earlier visits, to look through without leaving this one.
 *
 * Closed until asked for: most consultations need only "Last visit",
 * which the screen already shows. Loaded when first opened, so a doctor
 * who never opens it costs the server nothing.
 */
export function PastVisits({ patientId, today }: { patientId: string; today?: string }) {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<PastHistory | null>(null);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<HistoryFilter>(NO_FILTER);

  useEffect(() => {
    if (!open || history) return;
    apiFetch<PastHistory>(`/patients/${patientId}/history`).then(setHistory).catch(() => setFailed(true));
  }, [open, history, patientId]);
  // Another patient's visit opened in the same screen: start again.
  useEffect(() => { setHistory(null); setFailed(false); setFilter(NO_FILTER); }, [patientId]);

  const days = useMemo<PastDay[]>(() => {
    if (!history) return [];
    const map = new Map<string, PastDay>();
    const day = (iso: string) => {
      const key = dayOf(iso);
      let d = map.get(key);
      if (!d) { d = { key, appointments: [], caseSheets: [], prescriptions: [], certificates: [], labOrders: [], bills: [], records: [] }; map.set(key, d); }
      return d;
    };
    history.caseSheets.forEach((c) => day(c.createdAt).caseSheets.push(c));
    history.prescriptions.forEach((p) => day(p.createdAt).prescriptions.push(p));
    history.labOrders.forEach((l) => day(l.createdAt).labOrders.push(l));
    history.certificates.forEach((c) => day(c.createdAt).certificates.push(c));
    const todayKey = today ?? toDateInput(new Date());
    // Today is the visit on screen, not a past one.
    return [...map.values()].filter((d) => d.key < todayKey).sort((a, b) => b.key.localeCompare(a.key));
  }, [history, today]);

  const shown = useMemo(() => filterDays(days, filter), [days, filter]);

  return (
    <section className="mb-6 rounded-xl border border-border/10 bg-foreground/[0.02]">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left">
        <span className="flex items-center gap-1.5 text-[14px] font-semibold"><History size={14} aria-hidden="true" /> Past visits</span>
        <span className="text-[13px] text-muted-foreground">{open ? 'Hide' : 'Look through them'}</span>
      </button>
      {open && (
        <div className="border-t border-border/10 px-4 py-3">
          {failed ? (
            <p className="text-[14px] text-muted-foreground">The history could not be loaded just now.</p>
          ) : !history ? (
            <p className="text-[14px] text-muted-foreground" role="status">Loading the history…</p>
          ) : days.length === 0 ? (
            <p className="text-[14px] text-muted-foreground">This is their first visit on record.</p>
          ) : (
            <>
              <HistoryFilters value={filter} onChange={setFilter} showing={shown.length} of={days.length} kinds={['all', 'notes', 'medicines', 'tests', 'certificates']} />
              <ol className="max-h-[26rem] space-y-2 overflow-y-auto pr-1">
                {shown.map((d) => (
                  <li key={d.key} className="rounded-lg border border-border/10 bg-background px-3 py-2.5 text-[14px]">
                    <p className="text-[13px] font-medium text-muted-foreground">{readDay(d.key)}{d.caseSheets[0]?.doctor.name ? ` · Dr. ${d.caseSheets[0].doctor.name.replace(/^Dr\.?\s*/i, '')}` : ''}</p>
                    {d.caseSheets.map((c) => (
                      <div key={c.id} className="mt-1">
                        {c.diagnosis && <p className="font-semibold">{c.diagnosis}</p>}
                        {c.chiefComplaint && <p><span className="text-muted-foreground">Came for: </span>{c.chiefComplaint}</p>}
                        {c.vitals && Object.values(c.vitals).some(Boolean) && (
                          <p className="text-[13px] text-muted-foreground tabular-nums">
                            {[c.vitals.bp && `BP ${c.vitals.bp}`, c.vitals.pulse && `Pulse ${c.vitals.pulse}`, c.vitals.temp && `Temp ${c.vitals.temp}`, c.vitals.spo2 && `SpO₂ ${c.vitals.spo2}`, c.vitals.weight && `Wt ${c.vitals.weight}`].filter(Boolean).join(' · ')}
                          </p>
                        )}
                        {(c.hopi || c.notes) && <p className="mt-0.5 whitespace-pre-line text-[13px] text-muted-foreground">{[c.hopi, c.notes].filter(Boolean).join('\n')}</p>}
                      </div>
                    ))}
                    {d.prescriptions.map((p) => (
                      <ul key={p.id} className="mt-1.5 space-y-0.5">
                        {p.items.map((it, i) => (
                          <li key={i}><span className="font-medium">{it.drugName}</span><span className="text-muted-foreground"> · {[it.dosage, it.frequency, it.duration].filter(Boolean).join(', ')}</span></li>
                        ))}
                      </ul>
                    ))}
                    {d.labOrders.map((l) => (
                      <ul key={l.id} className="mt-1.5 space-y-0.5">
                        {l.items.map((it) => (
                          <li key={it.id} className="flex flex-wrap gap-x-2"><span className="font-medium">{it.testName}</span><span className={it.resultText ? '' : 'text-ink-warning'}>{it.resultText ?? 'result awaited'}</span></li>
                        ))}
                      </ul>
                    ))}
                    {d.certificates.map((c) => <p key={c.id} className="mt-1.5 text-muted-foreground">{c.type.charAt(0) + c.type.slice(1).toLowerCase().replace(/_/g, ' ')} certificate</p>)}
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
      )}
    </section>
  );
}
