import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { apiFetch, ApiError } from '../lib/api';
import { useClinicAuth } from '../contexts/ClinicAuthContext';
import { toDateInput } from '../lib/date';
import { Button } from '../components/Button';
import { DatePicker } from '../components/DatePicker';
import { Pick } from '../components/Field';
import { SegmentedControl } from '../components/SegmentedControl';
import { SkeletonList } from '../components/Skeleton';
import { useToast } from '../components/Toast';
import { Input } from '../components/ui/input';
import { Chip, FIELD, FieldLabel, PageHeader, Panel, PatientPicker, dateTime, since, type PickedPatient } from '../components/hosp';

/* ═══ Operation theatre ═══════════════════════════════════════════════ */

interface OtBooking {
  id: string; theatre: string; procedure: string; scheduledAt: string; durationMins: number; status: string; anaesthetist: string | null; anaesthesiaType: string | null; operationNotes: string | null;
  patient: { id: string; name: string; uhid: string; age: number | null; gender: string | null; allergies: string | null };
  surgeon: { id: string; name: string } | null; admission: { id: string; ipNumber: string } | null;
}
const OT_TONE: Record<string, 'info' | 'good' | 'quiet' | 'warn'> = { SCHEDULED: 'quiet', IN_PROGRESS: 'info', DONE: 'good', CANCELLED: 'warn' };
const OT_WORDS: Record<string, string> = { SCHEDULED: 'Scheduled', IN_PROGRESS: 'In theatre', DONE: 'Done', CANCELLED: 'Cancelled' };

/*
 * The theatre list: each theatre's day, in order. Booking checks the
 * theatre is free for the whole length of the operation; the surgeon
 * writes the notes when it is done.
 */
export function Ot() {
  const { canWriteClinical } = useClinicAuth();
  const toast = useToast();
  const [day, setDay] = useState(toDateInput(new Date()));
  const [list, setList] = useState<OtBooking[] | null>(null);
  const [booking, setBooking] = useState(false);
  const [notesFor, setNotesFor] = useState<OtBooking | null>(null);
  const load = useCallback(async () => {
    try { setList((await apiFetch<{ data: OtBooking[] }>(`/ot?date=${day}`)).data); } catch { setList([]); }
  }, [day]);
  useEffect(() => { void load(); }, [load]);
  const shift = (n: number) => { const d = new Date(`${day}T12:00:00`); d.setDate(d.getDate() + n); setDay(toDateInput(d)); };
  const set = async (b: OtBooking, status: string) => {
    try { await apiFetch(`/ot/${b.id}`, { method: 'PUT', data: { status } }); toast.success(OT_WORDS[status]!); await load(); }
    catch (e) { toast.error(e instanceof ApiError ? e.message : 'Could not update.'); }
  };
  const theatres = [...new Set((list ?? []).map((b) => b.theatre))].sort();

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-6xl">
      <PageHeader title="Operation theatre" sub={new Date(`${day}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}>
        <Button variant="primary" onClick={() => setBooking((v) => !v)}>Book the theatre</Button>
      </PageHeader>
      <div className="mb-5 flex items-center gap-2">
        <button onClick={() => shift(-1)} className="rounded-md p-2 hover:bg-foreground/[0.06]" aria-label="Previous day"><ChevronLeft size={16} /></button>
        <DatePicker value={day} onChange={(v) => v && setDay(v)} label="Theatre list for this day" className="min-w-[9.5rem]" />
        <button onClick={() => shift(1)} className="rounded-md p-2 hover:bg-foreground/[0.06]" aria-label="Next day"><ChevronRight size={16} /></button>
      </div>
      {booking && <BookOt day={day} onClose={() => setBooking(false)} onDone={async () => { setBooking(false); toast.success('Booked.'); await load(); }} />}
      {notesFor && <OpNotes booking={notesFor} onClose={() => setNotesFor(null)} onDone={async () => { setNotesFor(null); toast.success('Notes saved.'); await load(); }} />}
      {!list ? <SkeletonList rows={4} label="Loading the theatre list" /> : list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/25 px-6 py-10 text-center text-[14px] text-muted-foreground">Nothing booked this day.</div>
      ) : (
        <div className="space-y-6">
          {theatres.map((t) => (
            <section key={t}>
              <h2 className="mb-2.5 text-[16px] font-semibold">{t}</h2>
              <div className="flex flex-col gap-2">
                {list.filter((b) => b.theatre === t).map((b) => (
                  <div key={b.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border/15 bg-card px-4 py-3">
                    <div className="w-24 shrink-0">
                      <p className="font-display text-[20px] font-semibold leading-none tabular-nums">{new Date(b.scheduledAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</p>
                      <p className="mt-1 text-[12px] text-muted-foreground">{b.durationMins} min</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-semibold">{b.procedure}</p>
                      <p className="text-[13px] text-muted-foreground">
                        <Link to={`/patients/${b.patient.id}`} className="hover:underline">{b.patient.name}</Link>
                        {[b.patient.age != null ? `${b.patient.age}y` : null, b.surgeon ? `Dr. ${b.surgeon.name}` : null, b.anaesthetist ? `Anaesthesia: ${b.anaesthetist}${b.anaesthesiaType ? `, ${b.anaesthesiaType}` : ''}` : null].filter(Boolean).map((x) => ` · ${x}`).join('')}
                      </p>
                      {b.patient.allergies && <p className="mt-0.5 flex items-center gap-1 text-[13px] font-semibold text-ink-danger"><AlertTriangle size={13} /> Allergic to {b.patient.allergies}</p>}
                      {b.operationNotes && <p className="mt-1 text-[13.5px]">{b.operationNotes}</p>}
                    </div>
                    <Chip tone={OT_TONE[b.status]}>{OT_WORDS[b.status]}</Chip>
                    <div className="flex gap-1.5">
                      {b.status === 'SCHEDULED' && <Button size="sm" variant="secondary" onClick={() => set(b, 'IN_PROGRESS')}>Start</Button>}
                      {b.status === 'IN_PROGRESS' && <Button size="sm" variant="primary" onClick={() => set(b, 'DONE')}>Done</Button>}
                      {canWriteClinical && (b.status === 'DONE' || b.status === 'IN_PROGRESS') && <Button size="sm" variant="ghost" onClick={() => setNotesFor(b)}>Notes</Button>}
                      {b.status === 'SCHEDULED' && <Button size="sm" variant="ghost" onClick={() => set(b, 'CANCELLED')}>Cancel</Button>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function BookOt({ day, onClose, onDone }: { day: string; onClose: () => void; onDone: () => void }) {
  const [patient, setPatient] = useState<PickedPatient | null>(null);
  const [doctors, setDoctors] = useState<{ id: string; name: string }[]>([]);
  const [f, setF] = useState({ theatre: 'OT 1', procedure: '', time: '10:00', durationMins: '60', surgeonId: '', anaesthetist: '', anaesthesiaType: '' });
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { apiFetch<{ data: { id: string; name: string }[] }>('/doctors').then((r) => setDoctors(r.data)).catch(() => {}); }, []);
  const submit = async () => {
    setError(null);
    if (!patient) { setError('Choose the patient.'); return; }
    try {
      const admissions = await apiFetch<{ data: { id: string; status: string }[] }>(`/admissions?patientId=${patient.id}&status=ADMITTED`).catch(() => ({ data: [] }));
      await apiFetch('/ot', {
        method: 'POST',
        data: {
          patientId: patient.id, admissionId: admissions.data[0]?.id, theatre: f.theatre, procedure: f.procedure, scheduledAt: new Date(`${day}T${f.time}:00`).toISOString(),
          durationMins: Number(f.durationMins || 60), surgeonId: f.surgeonId || undefined, anaesthetist: f.anaesthetist || undefined, anaesthesiaType: f.anaesthesiaType || undefined,
        },
      });
      onDone();
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Could not book.'); }
  };
  return (
    <Panel title="Book the theatre" aside={<button type="button" onClick={onClose} className="hover:text-foreground">Close</button>} className="mb-6">
      <div className="space-y-3">
        <div><FieldLabel>Patient</FieldLabel><PatientPicker value={patient} onChange={setPatient} autoFocus /></div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div><FieldLabel htmlFor="ot-t">Theatre</FieldLabel><Input id="ot-t" value={f.theatre} onChange={(e) => setF({ ...f, theatre: e.target.value })} /></div>
          <div><FieldLabel htmlFor="ot-time">Time</FieldLabel><input id="ot-time" type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} className={FIELD} /></div>
          <div><FieldLabel htmlFor="ot-dur">Minutes</FieldLabel><input id="ot-dur" inputMode="numeric" value={f.durationMins} onChange={(e) => setF({ ...f, durationMins: e.target.value.replace(/\D/g, '') })} className={FIELD} /></div>
          <div><FieldLabel>Surgeon</FieldLabel><Pick value={f.surgeonId} onChange={(v) => setF({ ...f, surgeonId: v })} emptyLabel="Not chosen" options={doctors.map((d) => ({ value: d.id, label: `Dr. ${d.name}` }))} /></div>
        </div>
        <div><FieldLabel htmlFor="ot-p">Procedure</FieldLabel><Input id="ot-p" value={f.procedure} onChange={(e) => setF({ ...f, procedure: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><FieldLabel htmlFor="ot-an">Anaesthetist</FieldLabel><Input id="ot-an" value={f.anaesthetist} onChange={(e) => setF({ ...f, anaesthetist: e.target.value })} /></div>
          <div><FieldLabel htmlFor="ot-at">Anaesthesia</FieldLabel><Input id="ot-at" value={f.anaesthesiaType} onChange={(e) => setF({ ...f, anaesthesiaType: e.target.value })} placeholder="General, spinal, local…" /></div>
        </div>
        {error && <p role="alert" className="rounded-md tone-danger px-3 py-2 text-[13px]">{error}</p>}
        <Button variant="primary" onClick={submit} disabled={!f.procedure.trim()}>Book</Button>
      </div>
    </Panel>
  );
}

function OpNotes({ booking, onClose, onDone }: { booking: OtBooking; onClose: () => void; onDone: () => void }) {
  const [notes, setNotes] = useState(booking.operationNotes ?? '');
  const toast = useToast();
  const save = async () => {
    try { await apiFetch(`/ot/${booking.id}`, { method: 'PUT', data: { operationNotes: notes } }); onDone(); }
    catch (e) { toast.error(e instanceof ApiError ? e.message : 'Could not save.'); }
  };
  return (
    <Panel title={`Operation notes · ${booking.procedure}`} aside={<button type="button" onClick={onClose} className="hover:text-foreground">Close</button>} className="mb-6">
      <textarea aria-label="Operation notes" rows={6} value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full rounded-md border border-input/60 bg-background px-3 py-2 text-[14px] outline-none focus:border-ring" autoFocus />
      <Button className="mt-3" variant="primary" onClick={save}>Save notes</Button>
    </Panel>
  );
}

/* ═══ Radiology ═══════════════════════════════════════════════════════ */

interface RadOrder {
  id: string; modality: string; study: string; clinicalNotes: string | null; status: string; createdAt: string; doneAt: string | null;
  report: string | null; impression: string | null; reportedByName: string | null; reportedAt: string | null;
  patient: { id: string; name: string; uhid: string; age: number | null; gender: string | null }; orderedBy: { name: string } | null; admission: { id: string; ipNumber: string } | null;
}
const MOD_WORDS: Record<string, string> = { XRAY: 'X-ray', USG: 'Ultrasound', CT: 'CT', MRI: 'MRI', ECG: 'ECG', ECHO: 'Echo', OTHER: 'Other' };

/*
 * The imaging worklist: what is waiting to be done, what is waiting to be
 * reported, and what is reported. Doctors order; the radiographer does
 * the study and writes the report.
 */
export function Radiology() {
  const { canWriteClinical } = useClinicAuth();
  const toast = useToast();
  const [filter, setFilter] = useState<'ORDERED' | 'DONE' | 'REPORTED'>('ORDERED');
  const [list, setList] = useState<RadOrder[] | null>(null);
  const [reporting, setReporting] = useState<RadOrder | null>(null);
  const [ordering, setOrdering] = useState(false);
  const load = useCallback(async () => {
    try { setList((await apiFetch<{ data: RadOrder[] }>('/radiology')).data); } catch { setList([]); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const count = (s: string) => (list ?? []).filter((o) => o.status === s).length;
  const shown = (list ?? []).filter((o) => o.status === filter);
  const markDone = async (o: RadOrder) => {
    try { await apiFetch(`/radiology/${o.id}`, { method: 'PUT', data: { status: 'DONE' } }); toast.success('Marked done; waiting for the report.'); await load(); }
    catch (e) { toast.error(e instanceof ApiError ? e.message : 'Could not update.'); }
  };
  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-6xl">
      <PageHeader title="Radiology" sub={`${count('ORDERED')} to do · ${count('DONE')} to report`}>
        {canWriteClinical && <Button variant="primary" onClick={() => setOrdering((v) => !v)}>Order imaging</Button>}
      </PageHeader>
      <SegmentedControl label="Worklist" className="mb-5" value={filter} onChange={setFilter}
        options={[{ value: 'ORDERED', label: `To do · ${count('ORDERED')}` }, { value: 'DONE', label: `To report · ${count('DONE')}` }, { value: 'REPORTED', label: 'Reported' }]} />
      {ordering && <OrderImaging onClose={() => setOrdering(false)} onDone={async () => { setOrdering(false); toast.success('Ordered.'); await load(); }} />}
      {reporting && <ReportForm order={reporting} onClose={() => setReporting(null)} onDone={async () => { setReporting(null); toast.success('Reported.'); await load(); }} />}
      {!list ? <SkeletonList rows={4} label="Loading the worklist" /> : shown.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/25 px-6 py-10 text-center text-[14px] text-muted-foreground">Nothing here.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {shown.map((o) => (
            <div key={o.id} className="flex flex-wrap items-start gap-3 rounded-xl border border-border/15 bg-card px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold">{o.study} <span className="font-normal text-muted-foreground">· {MOD_WORDS[o.modality]}</span></p>
                <p className="text-[13px] text-muted-foreground">
                  <Link to={`/patients/${o.patient.id}`} className="hover:underline">{o.patient.name}</Link>
                  {[o.patient.age != null ? `${o.patient.age}y` : null, o.admission?.ipNumber, o.orderedBy ? `ordered by Dr. ${o.orderedBy.name}` : null, `${since(o.createdAt)} ago`].filter(Boolean).map((x) => ` · ${x}`).join('')}
                </p>
                {o.clinicalNotes && <p className="mt-0.5 text-[13.5px]"><span className="text-muted-foreground">Clinical: </span>{o.clinicalNotes}</p>}
                {o.status === 'REPORTED' && <p className="mt-1 text-[14px]"><span className="font-semibold">Impression:</span> {o.impression ?? o.report} <span className="text-[12.5px] text-muted-foreground">· {o.reportedByName}, {dateTime(o.reportedAt)}</span></p>}
              </div>
              <div className="flex gap-1.5">
                {o.status === 'ORDERED' && <Button size="sm" variant="secondary" onClick={() => markDone(o)}>Mark done</Button>}
                {(o.status === 'ORDERED' || o.status === 'DONE') && <Button size="sm" variant="primary" onClick={() => setReporting(o)}>Write report</Button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReportForm({ order, onClose, onDone }: { order: RadOrder; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [report, setReport] = useState(order.report ?? '');
  const [impression, setImpression] = useState(order.impression ?? '');
  const save = async () => {
    try { await apiFetch(`/radiology/${order.id}`, { method: 'PUT', data: { report, impression } }); onDone(); }
    catch (e) { toast.error(e instanceof ApiError ? e.message : 'Could not save.'); }
  };
  return (
    <Panel title={`Report · ${order.study} · ${order.patient.name}`} aside={<button type="button" onClick={onClose} className="hover:text-foreground">Close</button>} className="mb-6">
      <FieldLabel htmlFor="rr-f">Findings</FieldLabel>
      <textarea id="rr-f" rows={5} value={report} onChange={(e) => setReport(e.target.value)} className="w-full rounded-md border border-input/60 bg-background px-3 py-2 text-[14px] outline-none focus:border-ring" autoFocus />
      <div className="mt-3"><FieldLabel htmlFor="rr-i">Impression</FieldLabel><Input id="rr-i" value={impression} onChange={(e) => setImpression(e.target.value)} /></div>
      <Button className="mt-3" variant="primary" onClick={save} disabled={!report.trim()}>Save report</Button>
    </Panel>
  );
}

function OrderImaging({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [patient, setPatient] = useState<PickedPatient | null>(null);
  const [f, setF] = useState({ modality: 'XRAY', study: '', clinicalNotes: '' });
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    setError(null);
    if (!patient) { setError('Choose the patient.'); return; }
    try {
      const adm = await apiFetch<{ data: { id: string }[] }>(`/admissions?patientId=${patient.id}&status=ADMITTED`).catch(() => ({ data: [] }));
      await apiFetch('/radiology', { method: 'POST', data: { patientId: patient.id, admissionId: adm.data[0]?.id, ...f, clinicalNotes: f.clinicalNotes || undefined } });
      onDone();
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Could not order.'); }
  };
  return (
    <Panel title="Order imaging" aside={<button type="button" onClick={onClose} className="hover:text-foreground">Close</button>} className="mb-6">
      <div className="space-y-3">
        <div><FieldLabel>Patient</FieldLabel><PatientPicker value={patient} onChange={setPatient} autoFocus /></div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[160px_minmax(0,1fr)]">
          <div><FieldLabel>Kind</FieldLabel><Pick value={f.modality} onChange={(v) => setF({ ...f, modality: v })} options={Object.entries(MOD_WORDS).map(([value, label]) => ({ value, label }))} /></div>
          <div><FieldLabel htmlFor="oi-s">Study</FieldLabel><Input id="oi-s" value={f.study} onChange={(e) => setF({ ...f, study: e.target.value })} placeholder="Chest PA view, USG abdomen…" /></div>
        </div>
        <div><FieldLabel htmlFor="oi-c">Clinical notes</FieldLabel><Input id="oi-c" value={f.clinicalNotes} onChange={(e) => setF({ ...f, clinicalNotes: e.target.value })} /></div>
        {error && <p role="alert" className="rounded-md tone-danger px-3 py-2 text-[13px]">{error}</p>}
        <Button variant="primary" onClick={submit} disabled={!f.study.trim()}>Order</Button>
      </div>
    </Panel>
  );
}

/* ═══ Nursing: the ward list ══════════════════════════════════════════ */

interface WardRow { id: string; ipNumber: string; ward: string | null; bed: string | null; doctor: string | null; admittedAt: string; lastVitalsAt: string | null; patient: { id: string; name: string; age: number | null; allergies: string | null } }

/*
 * Every admitted patient, ward by ward, with how long since their vitals
 * were taken -- the round, at a glance. Over four hours is marked, the
 * usual interval on a general ward.
 */
export function Nursing() {
  const [rows, setRows] = useState<WardRow[] | null>(null);
  useEffect(() => { apiFetch<{ data: WardRow[] }>('/nursing/ward-list').then((r) => setRows(r.data)).catch(() => setRows([])); }, []);
  const wards = [...new Set((rows ?? []).map((r) => r.ward ?? 'No bed yet'))];
  const overdue = (r: WardRow) => !r.lastVitalsAt || Date.now() - new Date(r.lastVitalsAt).getTime() > 4 * 3_600_000;
  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl">
      <PageHeader title="Nursing" sub={rows ? `${rows.length} admitted · ${rows.filter(overdue).length} due for vitals` : 'Ward rounds'} />
      {!rows ? <SkeletonList rows={5} label="Loading the ward list" /> : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/25 px-6 py-10 text-center text-[14px] text-muted-foreground">No one is admitted.</div>
      ) : wards.map((w) => (
        <section key={w} className="mb-6">
          <h2 className="mb-2.5 text-[16px] font-semibold">{w}</h2>
          <ul className="divide-y divide-border/10 overflow-hidden rounded-xl border border-border/15 bg-card">
            {rows.filter((r) => (r.ward ?? 'No bed yet') === w).map((r) => (
              <li key={r.id}>
                <Link to={`/ipd/${r.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-foreground/[0.02]">
                  <span className="w-14 font-display text-[18px] font-semibold">{r.bed ?? '—'}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold">{r.patient.name}</span>
                    <span className="block text-[13px] text-muted-foreground">{[r.patient.age != null ? `${r.patient.age}y` : null, r.doctor ? `Dr. ${r.doctor}` : null, `day ${Math.max(1, Math.ceil((Date.now() - new Date(r.admittedAt).getTime()) / 86_400_000))}`].filter(Boolean).join(' · ')}</span>
                    {r.patient.allergies && <span className="block text-[12.5px] font-semibold text-ink-danger">Allergy: {r.patient.allergies}</span>}
                  </span>
                  <span className={`text-[13px] ${overdue(r) ? 'font-semibold text-ink-warning' : 'text-muted-foreground'}`}>{r.lastVitalsAt ? `Vitals ${since(r.lastVitalsAt)} ago` : 'No vitals yet'}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/* ═══ Departments ═════════════════════════════════════════════════════ */

interface Department { id: string; name: string; kind: 'CLINICAL' | 'SERVICE'; service: string | null; isActive: boolean; members: { id: string; name: string; role: string }[] }
interface StaffRow { id: string; name: string; role: string; isActive: boolean }
const SERVICE_WORDS: Record<string, string> = { FRONT_DESK: 'Front desk', CASH_COUNTER: 'Cash counter', INSURANCE: 'Insurance desk', SCHEMES: 'Scheme desk', PHARMACY: 'Pharmacy', LAB: 'Laboratory', RADIOLOGY: 'Radiology', OT: 'Operation theatre', WARD: 'Ward', RECORDS: 'Medical records' };
const ROLE_WORDS: Record<string, string> = { DOCTOR: 'Doctor', RECEPTIONIST: 'Reception', NURSE: 'Nurse', PHARMACIST: 'Pharmacist', ADMIN: 'Admin', CASHIER: 'Cashier', BILLING_CLERK: 'Billing', LAB_TECH: 'Lab technician', RADIOGRAPHER: 'Radiographer' };

/*
 * Departments and who works where. A clinical department groups doctors;
 * a service department is a desk or a ward, and the people in it see its
 * screens -- so assigning someone here is how their menu is decided.
 */
export function Departments() {
  const toast = useToast();
  const [depts, setDepts] = useState<Department[] | null>(null);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [f, setF] = useState({ name: '', kind: 'CLINICAL', service: 'WARD' });
  const load = useCallback(async () => {
    const [d, s] = await Promise.all([apiFetch<{ data: Department[] }>('/departments'), apiFetch<{ data: StaffRow[] }>('/staff').catch(() => ({ data: [] as StaffRow[] }))]);
    setDepts(d.data); setStaff(s.data.filter((x) => x.isActive));
  }, []);
  useEffect(() => { void load().catch(() => setDepts([])); }, [load]);
  const add = async () => {
    try { await apiFetch('/departments', { method: 'POST', data: { name: f.name, kind: f.kind, service: f.kind === 'SERVICE' ? f.service : null } }); toast.success('Added.'); setF({ ...f, name: '' }); await load(); }
    catch (e) { toast.error(e instanceof ApiError ? e.message : 'Could not add.'); }
  };
  const saveMembers = async (d: Department, ids: string[]) => {
    try { await apiFetch(`/departments/${d.id}/members`, { method: 'PUT', data: { userIds: ids } }); toast.success('Saved.'); setEditing(null); await load(); }
    catch (e) { toast.error(e instanceof ApiError ? e.message : 'Could not save.'); }
  };
  const groups: [string, Department[]][] = [['Clinical departments', (depts ?? []).filter((d) => d.kind === 'CLINICAL')], ['Service points', (depts ?? []).filter((d) => d.kind === 'SERVICE')]];
  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl">
      <PageHeader title="Departments" sub="Who works where. People see the screens of the service points they belong to." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          {!depts ? <SkeletonList rows={5} label="Loading departments" /> : groups.map(([title, list]) => (
            <section key={title}>
              <h2 className="mb-2.5 text-[16px] font-semibold">{title} <span className="font-normal text-muted-foreground">· {list.length}</span></h2>
              <ul className="divide-y divide-border/10 overflow-hidden rounded-xl border border-border/15 bg-card">
                {list.map((d) => (
                  <li key={d.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-[15px] font-semibold">{d.name}{d.service && SERVICE_WORDS[d.service] !== d.name && <span className="font-normal text-muted-foreground"> · {SERVICE_WORDS[d.service]}</span>}</span>
                      <button type="button" onClick={() => setEditing(editing === d.id ? null : d.id)} className="text-[13px] font-medium underline-offset-4 hover:underline">{editing === d.id ? 'Close' : 'People'}</button>
                    </div>
                    <p className="text-[13px] text-muted-foreground">{d.members.length ? d.members.map((m) => `${m.name} (${ROLE_WORDS[m.role] ?? m.role})`).join(', ') : 'No one yet'}</p>
                    {editing === d.id && <MemberPicker staff={staff} selected={d.members.map((m) => m.id)} onSave={(ids) => saveMembers(d, ids)} />}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <Panel title="Add a department" className="self-start">
          <div className="space-y-3">
            <div><FieldLabel htmlFor="d-name">Name</FieldLabel><Input id="d-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Cardiology, Ward B, Scheme desk…" /></div>
            <div><FieldLabel>Kind</FieldLabel><Pick value={f.kind} onChange={(v) => setF({ ...f, kind: v })} options={[{ value: 'CLINICAL', label: 'Clinical department' }, { value: 'SERVICE', label: 'Service point' }]} /></div>
            {f.kind === 'SERVICE' && <div><FieldLabel>What it does</FieldLabel><Pick value={f.service} onChange={(v) => setF({ ...f, service: v })} options={Object.entries(SERVICE_WORDS).map(([value, label]) => ({ value, label }))} /></div>}
            <Button variant="primary" onClick={add} disabled={!f.name.trim()}>Add</Button>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function MemberPicker({ staff, selected, onSave }: { staff: StaffRow[]; selected: string[]; onSave: (ids: string[]) => void }) {
  const [ids, setIds] = useState<string[]>(selected);
  return (
    <div className="mt-3 rounded-lg bg-accent/45 p-3">
      <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
        {staff.map((s) => (
          <label key={s.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[14px] hover:bg-card">
            <input type="checkbox" checked={ids.includes(s.id)} onChange={() => setIds(ids.includes(s.id) ? ids.filter((x) => x !== s.id) : [...ids, s.id])} className="h-4 w-4 accent-[hsl(var(--primary))]" />
            {s.name} <span className="text-[12.5px] text-muted-foreground">· {ROLE_WORDS[s.role] ?? s.role}</span>
          </label>
        ))}
      </div>
      <Button className="mt-2" size="sm" variant="primary" onClick={() => onSave(ids)}>Save people</Button>
    </div>
  );
}
