import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BedDouble, Plus } from 'lucide-react';
import { apiFetch, ApiError } from '../lib/api';
import { useClinicAuth } from '../contexts/ClinicAuthContext';
import { Button } from '../components/Button';
import { Pick } from '../components/Field';
import { SegmentedControl } from '../components/SegmentedControl';
import { SkeletonPanels } from '../components/Skeleton';
import { useToast } from '../components/Toast';
import { Input } from '../components/ui/input';
import { FIELD, FieldLabel, PageHeader, Panel, PatientPicker, rupees, since, type PickedPatient } from '../components/hosp';

interface BoardAdmission {
  id: string; ipNumber: string; admittedAt: string; payerType: string; provisionalDiagnosis: string | null;
  patient: { id: string; name: string; uhid: string; age: number | null; gender: string | null; allergies: string | null };
  admittingDoctor: { name: string } | null;
}
interface BoardBed { id: string; label: string; blockedReason: string | null; admission: BoardAdmission | null }
interface BoardWard { id: string; name: string; kind: string; dailyRate: string; beds: BoardBed[] }
interface Board { wards: BoardWard[]; unassigned: BoardAdmission[]; counts: { admitted: number; beds: number; free: number } }
interface Doctor { id: string; name: string }
interface Dept { id: string; name: string; kind: string }

const WARD_WORDS: Record<string, string> = { GENERAL: 'General', SEMI_PRIVATE: 'Semi-private', PRIVATE: 'Private', ICU: 'ICU', NICU: 'NICU', DAYCARE: 'Day care' };
const PAYER_WORDS: Record<string, string> = { SELF: 'Self-pay', INSURANCE: 'Insurance', SCHEME: 'Scheme' };

/*
 * The bed board.
 *
 * Every ward as a row of beds: who is in each, since when, under whom,
 * and which are free or being cleaned. It answers the two questions a
 * hospital's front desk is asked all day -- is there a bed, and where is
 * this patient -- without opening anything.
 */
export function Ipd() {
  const { isAdmin } = useClinicAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [board, setBoard] = useState<Board | null>(null);
  const [view, setView] = useState<'board' | 'setup'>('board');
  const [admitting, setAdmitting] = useState<string | null>(null); // bed id, or '' for no bed yet
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setBoard(await apiFetch<Board>('/ipd/board')); setError(null); }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Could not load the bed board.'); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-[1400px]">
      <PageHeader
        title="Bed board"
        sub={board ? `${board.counts.admitted} admitted · ${board.counts.free} of ${board.counts.beds} beds free` : 'Wards and beds'}
      >
        <Button variant="primary" icon={<Plus size={15} />} onClick={() => setAdmitting('')}>Admit a patient</Button>
      </PageHeader>

      {isAdmin && (
        <SegmentedControl
          label="Bed board or ward setup"
          className="mb-5"
          value={view}
          onChange={setView}
          options={[{ value: 'board', label: 'Beds' }, { value: 'setup', label: 'Wards and rates' }]}
        />
      )}

      {admitting !== null && (
        <AdmitPanel
          bedId={admitting || null}
          board={board}
          onClose={() => setAdmitting(null)}
          onDone={(id, ip) => { toast.success(`Admitted, ${ip}.`); setAdmitting(null); navigate(`/ipd/${id}`); }}
        />
      )}

      {error && <p role="alert" className="mb-4 rounded-lg tone-danger px-3 py-2 text-sm">{error}</p>}
      {!board && !error && <SkeletonPanels count={3} label="Loading the bed board" />}

      {board && view === 'setup' && <WardSetup board={board} onChanged={load} />}

      {board && view === 'board' && (
        <div className="space-y-6">
          {board.unassigned.length > 0 && (
            <Panel title={`Admitted, waiting for a bed · ${board.unassigned.length}`}>
              <ul className="divide-y divide-border/10">
                {board.unassigned.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-2">
                    <Link to={`/ipd/${a.id}`} className="font-medium hover:underline">{a.patient.name}</Link>
                    <span className="text-[13px] text-muted-foreground">{a.ipNumber} · {since(a.admittedAt)} ago</span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          {board.wards.length === 0 && (
            <div className="rounded-xl border border-dashed border-border/25 px-6 py-10 text-center">
              <p className="text-[16px] font-semibold">No wards set up yet.</p>
              <p className="mt-1 text-[14px] text-muted-foreground">{isAdmin ? 'Add your wards, their beds and their day rates under “Wards and rates”.' : 'Ask the clinic admin to add the wards and beds.'}</p>
            </div>
          )}
          {board.wards.map((w) => {
            const used = w.beds.filter((b) => b.admission).length;
            return (
              <section key={w.id}>
                <div className="mb-2.5 flex flex-wrap items-baseline gap-x-3">
                  <h2 className="text-[16px] font-semibold">{w.name} <span className="font-normal text-muted-foreground">· {used} of {w.beds.length}</span></h2>
                  <p className="text-[13px] text-muted-foreground">{WARD_WORDS[w.kind]} · {rupees(w.dailyRate)} a day</p>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {w.beds.map((b) => <BedCard key={b.id} bed={b} onAdmit={() => setAdmitting(b.id)} />)}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BedCard({ bed, onAdmit }: { bed: BoardBed; onAdmit: () => void }) {
  const a = bed.admission;
  if (!a) {
    return (
      <div className={`flex min-h-[92px] flex-col justify-between rounded-xl border px-3 py-2.5 ${bed.blockedReason ? 'border-dashed border-border/25 bg-transparent' : 'border-border/15 bg-card'}`}>
        <div className="flex items-baseline justify-between">
          <span className="font-display text-[20px] font-semibold leading-none">{bed.label}</span>
          <span className="text-[13px] text-muted-foreground">{bed.blockedReason ?? 'Free'}</span>
        </div>
        {!bed.blockedReason && (
          <button type="button" onClick={onAdmit} className="self-start text-[13px] font-medium underline-offset-4 hover:underline">Admit here</button>
        )}
      </div>
    );
  }
  return (
    <Link to={`/ipd/${a.id}`} className="block min-h-[92px] rounded-xl border border-border/15 bg-accent/55 px-3 py-2.5 hover:bg-accent">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-display text-[20px] font-semibold leading-none">{bed.label}</span>
        <span className="text-[12.5px] text-muted-foreground">{since(a.admittedAt)}</span>
      </div>
      <p className="mt-1.5 truncate text-[15px] font-semibold">{a.patient.name}</p>
      <p className="truncate text-[13px] text-muted-foreground">
        {[a.patient.age != null ? `${a.patient.age}y` : null, a.admittingDoctor ? `Dr. ${a.admittingDoctor.name}` : null, a.payerType !== 'SELF' ? PAYER_WORDS[a.payerType] : null].filter(Boolean).join(' · ')}
      </p>
      {a.patient.allergies && <p className="mt-0.5 text-[12px] font-semibold text-ink-danger">Allergy: {a.patient.allergies}</p>}
    </Link>
  );
}

function AdmitPanel({ bedId, board, onClose, onDone }: { bedId: string | null; board: Board | null; onClose: () => void; onDone: (id: string, ip: string) => void }) {
  const [patient, setPatient] = useState<PickedPatient | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [f, setF] = useState({ bedId: bedId ?? '', doctorId: '', departmentId: '', reason: '', diagnosis: '', payerType: 'SELF', estimate: '' });
  const [error, setError] = useState<string | null>(null);
  const { hasModule } = useClinicAuth();

  useEffect(() => {
    apiFetch<{ data: Doctor[] }>('/doctors').then((r) => setDoctors(r.data)).catch(() => {});
    if (hasModule('departments')) apiFetch<{ data: Dept[] }>('/departments').then((r) => setDepts(r.data.filter((d) => d.kind === 'CLINICAL'))).catch(() => {});
  }, [hasModule]);

  const freeBeds = (board?.wards ?? []).flatMap((w) => w.beds.filter((b) => !b.admission && !b.blockedReason).map((b) => ({ value: b.id, label: `${w.name} · ${b.label} (${rupees(w.dailyRate)}/day)` })));

  const submit = async () => {
    setError(null);
    if (!patient) { setError('Choose the patient.'); return; }
    try {
      const a = await apiFetch<{ id: string; ipNumber: string }>('/admissions', {
        method: 'POST',
        data: {
          patientId: patient.id, bedId: f.bedId || undefined, admittingDoctorId: f.doctorId || undefined, departmentId: f.departmentId || undefined,
          reason: f.reason || undefined, provisionalDiagnosis: f.diagnosis || undefined, payerType: f.payerType, estimatedCost: f.estimate ? Number(f.estimate) : undefined,
        },
      });
      onDone(a.id, a.ipNumber);
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Could not admit.'); }
  };

  return (
    <Panel title="Admit a patient" aside={<button type="button" onClick={onClose} className="hover:text-foreground">Close</button>} className="mb-6">
      <div className="space-y-4">
        <div><FieldLabel>Patient</FieldLabel><PatientPicker value={patient} onChange={setPatient} autoFocus /></div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div><FieldLabel>Bed</FieldLabel><Pick value={f.bedId} onChange={(v) => setF({ ...f, bedId: v })} emptyLabel="No bed yet" options={freeBeds} /></div>
          <div><FieldLabel>Admitting doctor</FieldLabel><Pick value={f.doctorId} onChange={(v) => setF({ ...f, doctorId: v })} emptyLabel="Not chosen" options={doctors.map((d) => ({ value: d.id, label: `Dr. ${d.name}` }))} /></div>
          {depts.length > 0 && <div><FieldLabel>Department</FieldLabel><Pick value={f.departmentId} onChange={(v) => setF({ ...f, departmentId: v })} emptyLabel="Not chosen" options={depts.map((d) => ({ value: d.id, label: d.name }))} /></div>}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div><FieldLabel htmlFor="ad-reason">Reason for admission</FieldLabel><Input id="ad-reason" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></div>
          <div><FieldLabel htmlFor="ad-dx">Provisional diagnosis</FieldLabel><Input id="ad-dx" value={f.diagnosis} onChange={(e) => setF({ ...f, diagnosis: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <FieldLabel>Who pays</FieldLabel>
            <div className="flex gap-1.5">
              {(['SELF', 'INSURANCE', 'SCHEME'] as const).map((p) => (
                <button key={p} type="button" aria-pressed={f.payerType === p} onClick={() => setF({ ...f, payerType: p })}
                  className={`rounded-md px-3 py-1.5 text-[13px] font-medium ${f.payerType === p ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}>{PAYER_WORDS[p]}</button>
              ))}
            </div>
          </div>
          <div><FieldLabel htmlFor="ad-est" hint="(told to the family)">Estimated cost, ₹</FieldLabel><Input id="ad-est" inputMode="numeric" value={f.estimate} onChange={(e) => setF({ ...f, estimate: e.target.value.replace(/\D/g, '') })} /></div>
        </div>
        {error && <p role="alert" className="rounded-md tone-danger px-3 py-2 text-[13px]">{error}</p>}
        <div className="flex items-center gap-3">
          <Button variant="primary" onClick={submit} busyLabel="Admitting…">Admit</Button>
          <span className="text-[13px] text-muted-foreground">Take the deposit at the cash counter after admitting.</span>
        </div>
      </div>
    </Panel>
  );
}

function WardSetup({ board, onChanged }: { board: Board; onChanged: () => Promise<void> | void }) {
  const toast = useToast();
  const [f, setF] = useState({ name: '', kind: 'GENERAL', dailyRate: '', beds: '6', prefix: '' });
  const add = async () => {
    try {
      await apiFetch('/wards', { method: 'POST', data: { name: f.name, kind: f.kind, dailyRate: Number(f.dailyRate || 0), beds: Number(f.beds || 0), bedPrefix: f.prefix || undefined } });
      toast.success(`${f.name} added.`);
      setF({ name: '', kind: 'GENERAL', dailyRate: '', beds: '6', prefix: '' });
      await onChanged();
    } catch (e) { toast.error(e instanceof ApiError ? e.message : 'Could not add the ward.'); }
  };
  const setRate = async (id: string, dailyRate: string) => {
    try { await apiFetch(`/wards/${id}`, { method: 'PUT', data: { dailyRate: Number(dailyRate) } }); toast.success('Rate saved. Patients already in the ward keep the rate they came in at.'); await onChanged(); }
    catch (e) { toast.error(e instanceof ApiError ? e.message : 'Could not save.'); }
  };
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Panel title="Wards">
        {board.wards.length === 0 ? <p className="text-[14px] text-muted-foreground">None yet.</p> : (
          <ul className="divide-y divide-border/10">
            {board.wards.map((w) => (
              <li key={w.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <BedDouble size={16} className="text-muted-foreground" aria-hidden="true" />
                <span className="min-w-[10rem] flex-1 font-medium">{w.name} <span className="font-normal text-muted-foreground">· {WARD_WORDS[w.kind]} · {w.beds.length} beds</span></span>
                <RateField value={String(Number(w.dailyRate))} onSave={(v) => setRate(w.id, v)} />
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title="Add a ward">
        <div className="space-y-3">
          <div><FieldLabel htmlFor="w-name">Name</FieldLabel><Input id="w-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="General Ward, ICU…" /></div>
          <div><FieldLabel>Kind</FieldLabel><Pick value={f.kind} onChange={(v) => setF({ ...f, kind: v })} options={Object.entries(WARD_WORDS).map(([value, label]) => ({ value, label }))} /></div>
          <div className="grid grid-cols-3 gap-2">
            <div><FieldLabel htmlFor="w-rate">₹ a day</FieldLabel><input id="w-rate" inputMode="numeric" value={f.dailyRate} onChange={(e) => setF({ ...f, dailyRate: e.target.value.replace(/[^\d.]/g, '') })} className={FIELD} /></div>
            <div><FieldLabel htmlFor="w-beds">Beds</FieldLabel><input id="w-beds" inputMode="numeric" value={f.beds} onChange={(e) => setF({ ...f, beds: e.target.value.replace(/\D/g, '') })} className={FIELD} /></div>
            <div><FieldLabel htmlFor="w-pre">Bed prefix</FieldLabel><input id="w-pre" value={f.prefix} onChange={(e) => setF({ ...f, prefix: e.target.value.slice(0, 6) })} placeholder="G" className={FIELD} /></div>
          </div>
          <Button variant="primary" onClick={add} disabled={!f.name.trim()}>Add ward</Button>
        </div>
      </Panel>
    </div>
  );
}

function RateField({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <span className="flex items-center gap-1.5">
      <span className="text-[13px] text-muted-foreground">₹</span>
      <input aria-label="Day rate" value={v} onChange={(e) => setV(e.target.value.replace(/[^\d.]/g, ''))} className={`${FIELD} w-24`} />
      <span className="text-[13px] text-muted-foreground">a day</span>
      {v !== value && <Button size="sm" variant="secondary" onClick={() => onSave(v)}>Save</Button>}
    </span>
  );
}
