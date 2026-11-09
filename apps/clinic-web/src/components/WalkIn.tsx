import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Search, UserPlus } from 'lucide-react';
import { apiFetch, ApiError } from '../lib/api';
import { CATEGORY_BADGES, VISIT_PRIORITIES } from '../lib/categories';
import { GENDERS } from '../lib/patient-fields';
import { Button } from './Button';
import { Pick } from './Field';
import { Input } from './ui/input';
import { Label } from './ui/label';

export interface FoundPatient {
  id: string;
  uhid: string;
  name: string;
  phone: string | null;
  age: number | null;
  gender: string | null;
  allergies: string | null;
  category: string;
}

interface Doctor { id: string; name: string }

export interface WalkInResult {
  id: string;
  tokenNumber: number | null;
  matchedBooking?: boolean;
  patient: { name: string };
  doctor: { name: string } | null;
}

/**
 * A patient at the desk, into the queue, in a few seconds.
 *
 * One search box takes a name, a phone number or a file number, because
 * the receptionist has whichever the patient just said. Enter picks the
 * first match. Someone new is three fields, not the full registration
 * form: the rest can be filled in while they wait.
 *
 * Typing a new patient's phone number looks it up as you go. Two records
 * for one person is the problem duplicate-merge exists to clean up, and
 * the cheapest place to stop it is here, before the second one is made.
 */
export function WalkInPanel({
  doctors,
  defaultDoctorId,
  onDone,
  onClose,
}: {
  doctors: Doctor[];
  defaultDoctorId: string;
  onDone: (result: WalkInResult) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoundPatient[]>([]);
  const [searched, setSearched] = useState(false);
  const [active, setActive] = useState(0);
  const [patient, setPatient] = useState<FoundPatient | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [draft, setDraft] = useState({ name: '', phone: '', age: '', gender: '' });
  const [phoneMatches, setPhoneMatches] = useState<FoundPatient[]>([]);
  const [doctorId, setDoctorId] = useState(defaultDoctorId);
  const [priority, setPriority] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => { searchRef.current?.focus(); }, []);

  useEffect(() => {
    if (patient || isNew || query.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await apiFetch<{ data: FoundPatient[] }>(`/patients?search=${encodeURIComponent(query.trim())}`);
        setResults(res.data.slice(0, 6));
        setActive(0);
        setSearched(true);
      } catch {
        setResults([]);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [query, patient, isNew]);

  // A new patient's phone, checked against the register as it is typed.
  useEffect(() => {
    const digits = draft.phone.replace(/\D/g, '');
    if (!isNew || digits.length < 6) {
      setPhoneMatches([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await apiFetch<{ data: FoundPatient[] }>(`/patients?search=${encodeURIComponent(draft.phone.trim())}`);
        setPhoneMatches(res.data.slice(0, 3));
      } catch {
        setPhoneMatches([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [draft.phone, isNew]);

  const choose = (p: FoundPatient) => {
    setPatient(p);
    setIsNew(false);
    setResults([]);
    setError(null);
  };

  const startNew = () => {
    // Whatever was typed is most likely the name (or the phone number).
    const typed = query.trim();
    const looksLikePhone = /^[\d\s+-]{6,}$/.test(typed);
    setDraft({ name: looksLikePhone ? '' : typed, phone: looksLikePhone ? typed : '', age: '', gender: '' });
    setIsNew(true);
    setPatient(null);
    setError(null);
  };

  const reset = () => {
    setPatient(null);
    setIsNew(false);
    setQuery('');
    setPriority(null);
    setReason('');
    setError(null);
    setTimeout(() => searchRef.current?.focus(), 0);
  };

  const usual = patient?.category ?? 'GENERAL';

  const submit = async () => {
    setError(null);
    try {
      let target = patient;
      if (!target) {
        if (!draft.name.trim()) {
          setError('Type the patient’s name.');
          return;
        }
        target = await apiFetch<FoundPatient>('/patients', {
          method: 'POST',
          data: {
            name: draft.name.trim(),
            phone: draft.phone.trim() || undefined,
            age: draft.age ? Number(draft.age) : undefined,
            gender: draft.gender || undefined,
          },
        });
      }
      const result = await apiFetch<WalkInResult>('/appointments/walk-in', {
        method: 'POST',
        data: {
          patientId: target.id,
          doctorId: doctorId || undefined,
          reason: reason.trim() || undefined,
          priority: priority ?? undefined,
        },
      });
      onDone(result);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not check the patient in.');
    }
  };

  const onSearchKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, Math.max(0, results.length - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[active]) choose(results[active]!);
      else if (searched && query.trim().length >= 2) startNew();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <section aria-label="Walk-in" className="mb-6 rounded-xl border border-border/15 bg-card p-4 sm:p-5 shadow-sm">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-[16px] font-semibold">Walk-in</h2>
        <button type="button" onClick={onClose} className="text-[13px] text-muted-foreground hover:text-foreground">Close</button>
      </div>

      {!patient && !isNew && (
        <div>
          <Label htmlFor="walkin-search" className="sr-only">Find the patient</Label>
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              id="walkin-search"
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onSearchKey}
              placeholder="Name, phone or file number"
              autoComplete="off"
              className="h-11 pl-9 text-[15px]"
              role="combobox"
              aria-expanded={results.length > 0}
              aria-controls="walkin-results"
            />
          </div>
          {results.length > 0 && (
            <ul id="walkin-results" role="listbox" className="mt-2 divide-y divide-border/10 overflow-hidden rounded-lg border border-border/15">
              {results.map((p, i) => (
                <li key={p.id} role="option" aria-selected={i === active}>
                  <button
                    type="button"
                    onClick={() => choose(p)}
                    onMouseEnter={() => setActive(i)}
                    className={`flex w-full items-center gap-3 px-3 py-2.5 text-left ${i === active ? 'bg-accent' : 'hover:bg-foreground/[0.04]'}`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium">{p.name}</span>
                      <span className="block truncate text-[13px] text-muted-foreground">
                        {[p.age != null ? `${p.age}y` : null, p.gender, p.phone, p.uhid].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    {p.allergies && (
                      <span className="flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[12px] font-medium tone-danger">
                        <AlertTriangle size={12} aria-hidden="true" /> Allergy
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-3 text-[13px] text-muted-foreground">
            {searched && results.length === 0 && <span>No one in the register matches “{query.trim()}”.</span>}
            <button type="button" onClick={startNew} className="inline-flex items-center gap-1.5 font-medium text-foreground underline-offset-4 hover:underline">
              <UserPlus size={14} aria-hidden="true" /> New patient
            </button>
            <span className="hidden sm:inline">Enter picks the first match.</span>
          </div>
        </div>
      )}

      {patient && (
        <div className="flex items-start justify-between gap-3 rounded-lg bg-accent/60 px-3 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold">{patient.name}</p>
            <p className="truncate text-[13px] text-muted-foreground">
              {[patient.age != null ? `${patient.age}y` : null, patient.gender, patient.phone, patient.uhid].filter(Boolean).join(' · ')}
            </p>
            {patient.allergies && (
              <p className="mt-1 flex items-center gap-1 text-[13px] font-medium text-ink-danger">
                <AlertTriangle size={13} aria-hidden="true" /> Allergic to {patient.allergies}
              </p>
            )}
          </div>
          <button type="button" onClick={reset} className="shrink-0 text-[13px] text-muted-foreground hover:text-foreground">Change</button>
        </div>
      )}

      {isNew && (
        <div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1.4fr_0.7fr]">
            <div className="space-y-1.5">
              <Label htmlFor="walkin-name">Name</Label>
              <Input id="walkin-name" autoFocus value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoComplete="off" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="walkin-phone">Phone</Label>
              <Input id="walkin-phone" inputMode="tel" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} autoComplete="off" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="walkin-age">Age</Label>
              <Input id="walkin-age" inputMode="numeric" value={draft.age} onChange={(e) => setDraft({ ...draft, age: e.target.value.replace(/\D/g, '').slice(0, 3) })} autoComplete="off" />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5" role="group" aria-label="Gender">
            {GENDERS.map((g) => (
              <button
                key={g.value}
                type="button"
                aria-pressed={draft.gender === g.value}
                onClick={() => setDraft({ ...draft, gender: draft.gender === g.value ? '' : g.value })}
                className={`rounded-md px-3 py-1.5 text-[13px] font-medium ${draft.gender === g.value ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}
              >
                {g.label}
              </button>
            ))}
            <button type="button" onClick={reset} className="ml-auto text-[13px] text-muted-foreground hover:text-foreground">Search instead</button>
          </div>
          {phoneMatches.length > 0 && (
            <div className="mt-3 rounded-lg tone-warning tone-block p-3 text-[13px]">
              <p className="font-medium">This number is already in the register.</p>
              <ul className="mt-1.5 space-y-1">
                {phoneMatches.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2">
                    <span className="truncate">{p.name} · {p.uhid}</span>
                    <button type="button" onClick={() => choose(p)} className="shrink-0 font-semibold underline underline-offset-4">Use this record</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {(patient || isNew) && (
        <div className="mt-4 space-y-4 border-t border-border/10 pt-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {doctors.length > 0 && (
              <div className="space-y-1.5">
                <Label>Doctor</Label>
                <Pick
                  value={doctorId}
                  onChange={setDoctorId}
                  emptyLabel="Whoever is free"
                  options={doctors.map((d) => ({ value: d.id, label: `Dr. ${d.name}` }))}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="walkin-reason">Reason <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Input id="walkin-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Fever, follow-up, dressing…" autoComplete="off" />
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-[13px] font-medium">Priority today</p>
            <div className="flex flex-wrap gap-1.5">
              {VISIT_PRIORITIES.map((c) => {
                const on = (priority ?? usual) === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    title={c.hint}
                    aria-pressed={on}
                    onClick={() => setPriority(c.id)}
                    className={`rounded-md px-3 py-1.5 text-[13px] font-medium ${on ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
            {usual !== 'GENERAL' && priority === null && (
              <p className="mt-1.5 text-[13px] text-muted-foreground">Usually seen as {CATEGORY_BADGES[usual]?.label.toLowerCase()}.</p>
            )}
          </div>
          {error && <p role="alert" className="rounded-md tone-danger px-3 py-2 text-[13px]">{error}</p>}
          <div className="flex items-center gap-3">
            <Button variant="primary" size="lg" onClick={submit} busyLabel="Checking in…">
              {isNew ? 'Register and check in' : 'Check in'}
            </Button>
            <span className="text-[13px] text-muted-foreground">A token is given on check-in.</span>
          </div>
        </div>
      )}
    </section>
  );
}
