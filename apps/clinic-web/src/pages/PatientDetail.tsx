import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeft, Award, Download, FileText, IndianRupee, Paperclip, Pencil, Pill, UserCheck,
} from 'lucide-react';
import { SkeletonPanels } from '../components/Skeleton';
import { apiFetch, openPdf, ApiError } from '../lib/api';
import { useClinicAuth } from '../contexts/ClinicAuthContext';
import { CaseSheetForm, PrescriptionForm, CertificateForm } from '../components/ClinicalForms';
import { PATIENT_CATEGORIES, CATEGORY_BADGES } from '../lib/categories';
import { GENDERS } from '../lib/patient-fields';
import { toDateInput } from '../lib/date';
import { Button } from '../components/Button';
import { Pick } from '../components/Field';
import { DuplicatePanel } from '../components/DuplicatePanel';
import { useToast } from '../components/Toast';

interface Patient {
  id: string; uhid: string; name: string; age: number | null; gender: string | null; phone: string | null;
  bloodGroup: string | null; allergies: string | null; chronicConditions: string | null; category: string;
  dob?: string | null; address?: string | null;
  email?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelation?: string | null;
  insuranceProvider?: string | null;
  insurancePolicyNumber?: string | null;
  referredBy?: string | null;
  deskNote?: string | null;
  createdAt?: string;
  /// Set when this record was merged into another as a duplicate.
  mergedIntoId?: string | null;
}
interface Doctor { name: string }
type Vitals = { bp?: string; temp?: string; spo2?: string; weight?: string; pulse?: string } | null;
interface CaseSheet {
  id: string; appointmentId: string | null; chiefComplaint: string | null; hopi: string | null; diagnosis: string | null; notes: string | null;
  vitals: Vitals; followUpDate: string | null;
  createdAt: string; doctor: Doctor; attachments: { id: string; fileName: string }[];
}
interface PrescriptionItemT { drugName: string; dosage: string; frequency: string; duration: string; instructions: string | null }
interface Prescription { id: string; appointmentId: string | null; createdAt: string; doctor: Doctor; items: PrescriptionItemT[] }
interface Certificate { id: string; appointmentId: string | null; type: string; content: string; createdAt: string; doctor: Doctor }
interface Appointment {
  id: string; scheduledAt: string; status: string; reason: string | null; vitals: Vitals;
  tokenNumber: number | null; doctor: Doctor | null;
}
interface LabOrder {
  id: string; appointmentId: string | null; createdAt: string; status: string; doctor: Doctor;
  items: { id: string; testName: string; resultText: string | null; resultFileName: string | null; completedAt: string | null }[];
}
interface Bill { id: string; appointmentId: string | null; createdAt: string; total: number; paid: number; balance: number; status: string }
interface VitalsPoint { date: string; bp: { systolic: number; diastolic: number } | null; weight: number | null; pulse: number | null; spo2: number | null; temp: number | null }

interface History {
  patient: Patient;
  caseSheets: CaseSheet[];
  prescriptions: Prescription[];
  certificates: Certificate[];
  appointments: Appointment[];
  labOrders: LabOrder[];
  bills: Bill[] | null;
}

const BILLING_ROLES = new Set(['RECEPTIONIST', 'DOCTOR', 'ADMIN']);
const FREQUENCY_WORDS: Record<string, string> = {
  OD: 'once a day', BD: 'twice a day', TDS: 'three times a day', QID: 'four times a day', SOS: 'when needed', STAT: 'at once',
};
const CERT_WORDS: Record<string, string> = { SICK_LEAVE: 'Sick leave certificate', FITNESS: 'Fitness certificate', REFERRAL: 'Referral letter' };

const money = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const dayKey = (iso: string) => toDateInput(new Date(iso));
const longDay = (key: string) => new Date(`${key}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const shortDay = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

function ago(key: string): string {
  const days = Math.round((new Date(`${toDateInput(new Date())}T12:00:00`).getTime() - new Date(`${key}T12:00:00`).getTime()) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days === -1) return 'Tomorrow';
  if (days < 0) return `In ${-days} days`;
  if (days < 45) return `${days} days ago`;
  const months = Math.round(days / 30.4);
  if (months < 18) return `${months} months ago`;
  return `${Math.round(days / 365)} years ago`;
}

/** Everything that happened on one day, as one card. */
interface Day {
  key: string;
  appointments: Appointment[];
  caseSheets: CaseSheet[];
  prescriptions: Prescription[];
  certificates: Certificate[];
  labOrders: LabOrder[];
  bills: Bill[];
}

/*
 * A patient's record, one day at a time.
 *
 * The history used to be every record as its own card -- a case sheet,
 * then a prescription, then an appointment line -- interleaved by the
 * minute. A doctor reading it was reassembling each visit in their head:
 * which prescription went with which diagnosis, was that lab result from
 * the same day. Each day is now one card with everything from it, in the
 * order a doctor reads a visit: why they came, the vitals, what was
 * found, what was given, what was tested, what was paid.
 *
 * Allergies sit above everything and never scroll out of mind. "At a
 * glance" carries the three things asked most at the start of a visit:
 * when were they last here, what are they taking, and is anything owed.
 */
export function PatientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { user, canWriteClinical } = useClinicAuth();
  const [data, setData] = useState<History | null>(null);
  const [vitalsTrend, setVitalsTrend] = useState<VitalsPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<'none' | 'caseSheet' | 'prescription' | 'certificate'>('none');
  const [editing, setEditing] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const load = async () => {
    try {
      const res = await apiFetch<History>(`/patients/${id}/history`);
      setData(res);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load this patient.');
    }
  };

  useEffect(() => {
    setData(null);
    load();
    apiFetch<{ data: VitalsPoint[] }>(`/patients/${id}/vitals-trend`).then((res) => setVitalsTrend(res.data)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const days = useMemo<Day[]>(() => {
    if (!data) return [];
    const map = new Map<string, Day>();
    const day = (iso: string) => {
      const key = dayKey(iso);
      let d = map.get(key);
      if (!d) {
        d = { key, appointments: [], caseSheets: [], prescriptions: [], certificates: [], labOrders: [], bills: [] };
        map.set(key, d);
      }
      return d;
    };
    data.appointments.forEach((a) => day(a.scheduledAt).appointments.push(a));
    data.caseSheets.forEach((c) => day(c.createdAt).caseSheets.push(c));
    data.prescriptions.forEach((p) => day(p.createdAt).prescriptions.push(p));
    data.certificates.forEach((c) => day(c.createdAt).certificates.push(c));
    data.labOrders.forEach((l) => day(l.createdAt).labOrders.push(l));
    (data.bills ?? []).forEach((b) => day(b.createdAt).bills.push(b));
    return [...map.values()].sort((a, b) => b.key.localeCompare(a.key));
  }, [data]);

  if (!data) {
    return error
      ? <div className="p-8 text-muted-foreground">{error}</div>
      : <div className="p-4 sm:p-6 md:p-8 max-w-5xl"><SkeletonPanels count={4} label="Loading the patient record" /></div>;
  }

  const { patient } = data;
  const todayKey = toDateInput(new Date());
  const upcoming = days.filter((d) => d.key > todayKey);
  const pastAndToday = days.filter((d) => d.key <= todayKey);
  const visible = showAll ? pastAndToday : pastAndToday.slice(0, 8);
  const todayVisit = data.appointments.find((a) => dayKey(a.scheduledAt) === todayKey && (a.status === 'CHECKED_IN' || a.status === 'IN_PROGRESS'));
  const lastVisitDay = pastAndToday.find((d) => d.caseSheets.length || d.appointments.some((a) => a.status === 'COMPLETED'));
  const lastRx = data.prescriptions[0];
  const owed = (data.bills ?? []).reduce((s, b) => s + b.balance, 0);
  const visitCount = data.appointments.filter((a) => a.status === 'COMPLETED').length;
  const badge = CATEGORY_BADGES[patient.category];

  const checkInNow = async () => {
    try {
      const r = await apiFetch<{ tokenNumber: number | null; matchedBooking?: boolean }>('/appointments/walk-in', { method: 'POST', data: { patientId: patient.id } });
      toast.success(`${r.tokenNumber ? `Token ${r.tokenNumber}: ` : ''}${patient.name} checked in.${r.matchedBooking ? ' Their booking for today was used.' : ''}`);
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not check the patient in.');
    }
  };

  const createInvoice = async () => {
    try {
      const inv = await apiFetch<{ id: string }>('/invoices', { method: 'POST', data: { patientId: patient.id, appointmentId: todayVisit?.id } });
      navigate('/billing', { state: { invoiceId: inv.id } });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not start a bill.');
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl">
      <Link to="/patients" className="mb-4 inline-flex items-center gap-1 text-[14px] text-muted-foreground hover:text-foreground">
        <ArrowLeft size={14} /> All patients
      </Link>

      {/* Above the record itself. Somebody looking at this patient is
          the only person who can tell whether another record is the
          same human -- often with the patient standing there. It used to
          render only while the page was loading, so it never appeared. */}
      <DuplicatePanel patient={patient} onMerged={load} />

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="break-words">{patient.name}</h1>
          <p className="mt-2 text-[15px] text-muted-foreground">
            {[
              patient.age != null ? `${patient.age} years` : null,
              patient.gender,
              patient.bloodGroup ? `Blood ${patient.bloodGroup}` : null,
              patient.phone,
            ].filter(Boolean).join(' · ')}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
            <span className="font-mono">{patient.uhid}</span>
            {badge && <span className={`rounded px-1.5 py-0.5 text-[12px] font-semibold ${badge.color}`}>{badge.label}</span>}
            <span>{visitCount ? `${visitCount} visit${visitCount === 1 ? '' : 's'}` : 'No visits yet'}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {todayVisit ? (
            <span className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-3 text-[14px] font-medium">
              <UserCheck size={15} aria-hidden="true" />
              {todayVisit.status === 'IN_PROGRESS' ? 'With the doctor' : 'Waiting'}{todayVisit.tokenNumber ? ` · token ${todayVisit.tokenNumber}` : ''}
            </span>
          ) : (
            <Button variant="primary" icon={<UserCheck size={15} />} onClick={checkInNow} busyLabel="Checking in…">Check in today</Button>
          )}
          {user && BILLING_ROLES.has(user.role) && (
            <Button variant="secondary" icon={<IndianRupee size={14} />} onClick={createInvoice}>New bill</Button>
          )}
          <Button variant="ghost" icon={<Pencil size={14} />} onClick={() => setEditing((v) => !v)} aria-expanded={editing}>Edit</Button>
          <Button variant="ghost" icon={<Download size={14} />} onClick={() => openPdf(`/patients/${patient.id}/report/pdf`)}>Report</Button>
        </div>
      </header>

      {(patient.allergies || patient.chronicConditions) && (
        <div role="note" className="mt-5 flex items-start gap-2.5 rounded-xl border border-ink-danger/30 bg-ink-danger/10 px-4 py-3 text-ink-danger">
          <AlertTriangle size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
          <div className="text-[15px] leading-snug">
            {patient.allergies && <p><span className="font-semibold">Allergic to:</span> {patient.allergies}</p>}
            {patient.chronicConditions && <p><span className="font-semibold">Long-term conditions:</span> {patient.chronicConditions}</p>}
          </div>
        </div>
      )}
      {patient.deskNote && (
        <p className="mt-3 rounded-lg bg-accent/70 px-4 py-2.5 text-[14px]"><span className="font-medium">Desk note:</span> {patient.deskNote}</p>
      )}

      {editing && (
        <div className="mt-5">
          <PatientEditForm patient={patient} onCancel={() => setEditing(false)} onSaved={() => { setEditing(false); toast.success('Patient details saved.'); load(); }} />
        </div>
      )}

      <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <main className="min-w-0 order-2 lg:order-1">
          {canWriteClinical && (
            <div className="mb-5 flex flex-wrap gap-2">
              <Button variant={panel === 'caseSheet' ? 'primary' : 'secondary'} size="sm" icon={<FileText size={13} />} onClick={() => setPanel(panel === 'caseSheet' ? 'none' : 'caseSheet')}>Case sheet</Button>
              <Button variant={panel === 'prescription' ? 'primary' : 'secondary'} size="sm" icon={<Pill size={13} />} onClick={() => setPanel(panel === 'prescription' ? 'none' : 'prescription')}>Prescription</Button>
              <Button variant={panel === 'certificate' ? 'primary' : 'secondary'} size="sm" icon={<Award size={13} />} onClick={() => setPanel(panel === 'certificate' ? 'none' : 'certificate')}>Certificate</Button>
            </div>
          )}
          {panel === 'caseSheet' && <CaseSheetForm patientId={patient.id} onDone={() => { setPanel('none'); load(); }} />}
          {panel === 'prescription' && <PrescriptionForm patientId={patient.id} onDone={() => { setPanel('none'); load(); }} />}
          {panel === 'certificate' && <CertificateForm patientId={patient.id} patientName={patient.name} onDone={() => { setPanel('none'); load(); }} />}

          <h2 className="mb-3 text-[16px] font-semibold">Visits, day by day</h2>
          {pastAndToday.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border/25 px-5 py-8 text-center text-[14px] text-muted-foreground">
              Nothing recorded yet. Each visit will appear here as one card, with its vitals, diagnosis, medicines, tests and bill.
            </p>
          ) : (
            <ol className="relative space-y-4 border-l border-border/20 pl-5">
              {visible.map((d) => <DayCard key={d.key} day={d} />)}
            </ol>
          )}
          {!showAll && pastAndToday.length > visible.length && (
            <button type="button" onClick={() => setShowAll(true)} className="mt-4 text-[14px] font-medium underline underline-offset-4">
              Show {pastAndToday.length - visible.length} older day{pastAndToday.length - visible.length === 1 ? '' : 's'}
            </button>
          )}
          <div className="mt-6 lg:hidden"><VitalsTrendSection points={vitalsTrend} /></div>
        </main>

        <aside className="order-1 space-y-4 lg:order-2">
          <section className="rounded-xl border border-border/15 bg-card p-4">
            <h2 className="mb-3 text-[15px] font-semibold">At a glance</h2>
            <dl className="space-y-3 text-[14px]">
              <div>
                <dt className="text-[13px] text-muted-foreground">Last visit</dt>
                <dd className="font-medium">
                  {lastVisitDay ? `${longDay(lastVisitDay.key)} · ${ago(lastVisitDay.key).toLowerCase()}` : 'Not seen yet'}
                </dd>
                {lastVisitDay?.caseSheets[0]?.diagnosis && <dd className="text-muted-foreground">{lastVisitDay.caseSheets[0].diagnosis}</dd>}
              </div>
              {upcoming.length > 0 && (
                <div>
                  <dt className="text-[13px] text-muted-foreground">Next appointment</dt>
                  {upcoming.slice(-1).map((d) => {
                    const a = d.appointments[0];
                    return (
                      <dd key={d.key} className="font-medium">
                        {longDay(d.key)}{a ? `, ${new Date(a.scheduledAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}` : ''}
                        {a?.reason && <span className="block font-normal text-muted-foreground">{a.reason}</span>}
                      </dd>
                    );
                  })}
                </div>
              )}
              {lastRx && (
                <div>
                  <dt className="text-[13px] text-muted-foreground">Last prescribed, {shortDay(lastRx.createdAt)}</dt>
                  <dd>
                    <ul className="mt-0.5 space-y-0.5">
                      {lastRx.items.map((it, i) => (
                        <li key={i}><span className="font-medium">{it.drugName}</span> <span className="text-muted-foreground">· {FREQUENCY_WORDS[it.frequency] ?? it.frequency}</span></li>
                      ))}
                    </ul>
                  </dd>
                </div>
              )}
              {data.bills && (
                <div>
                  <dt className="text-[13px] text-muted-foreground">Bills</dt>
                  <dd className={owed > 0 ? 'font-semibold text-ink-warning' : 'font-medium'}>{owed > 0 ? `${money(owed)} still to pay` : 'Nothing owed'}</dd>
                </div>
              )}
            </dl>
          </section>
          {/* On a phone the charts would push the visits a screen down, so
              there they follow the history instead. */}
          <div className="hidden lg:block"><VitalsTrendSection points={vitalsTrend} /></div>
          {(patient.emergencyContactName || patient.referredBy || patient.insuranceProvider) && (
            <section className="rounded-xl border border-border/15 bg-card p-4 text-[14px]">
              <h2 className="mb-2 text-[15px] font-semibold">Contacts</h2>
              {patient.emergencyContactName && (
                <p>
                  <span className="text-muted-foreground">In an emergency: </span>
                  {patient.emergencyContactName}{patient.emergencyContactRelation ? ` (${patient.emergencyContactRelation})` : ''}{patient.emergencyContactPhone ? `, ${patient.emergencyContactPhone}` : ''}
                </p>
              )}
              {patient.insuranceProvider && <p className="mt-1"><span className="text-muted-foreground">Insurance: </span>{patient.insuranceProvider}{patient.insurancePolicyNumber ? `, ${patient.insurancePolicyNumber}` : ''}</p>}
              {patient.referredBy && <p className="mt-1"><span className="text-muted-foreground">Referred by: </span>{patient.referredBy}</p>}
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

// ── One day ────────────────────────────────────────────────────────────

const STATUS_WORDS: Record<string, string> = {
  SCHEDULED: 'Booked', CHECKED_IN: 'Waiting', IN_PROGRESS: 'With the doctor', COMPLETED: 'Seen', CANCELLED: 'Cancelled', NO_SHOW: 'Did not come',
};

function DayCard({ day }: { day: Day }) {
  const appt = day.appointments[0];
  const sheet = day.caseSheets[0];
  const vitals = sheet?.vitals && Object.values(sheet.vitals).some(Boolean) ? sheet.vitals : appt?.vitals;
  const doctors = [...new Set([
    ...day.appointments.map((a) => a.doctor?.name),
    ...day.caseSheets.map((c) => c.doctor.name),
    ...day.prescriptions.map((p) => p.doctor.name),
  ].filter(Boolean) as string[])];
  const missed = day.appointments.length > 0 && day.appointments.every((a) => a.status === 'NO_SHOW' || a.status === 'CANCELLED')
    && !day.caseSheets.length && !day.prescriptions.length;
  const status = appt && appt.status !== 'COMPLETED' ? STATUS_WORDS[appt.status] : null;
  const vitalBits = vitals
    ? [
        vitals.bp && ['BP', vitals.bp],
        vitals.pulse && ['Pulse', vitals.pulse],
        vitals.temp && ['Temp', `${vitals.temp}°F`],
        vitals.spo2 && ['SpO₂', `${vitals.spo2}%`],
        vitals.weight && ['Weight', `${vitals.weight} kg`],
      ].filter(Boolean) as [string, string][]
    : [];

  return (
    <li className="relative">
      <span aria-hidden="true" className={`absolute -left-[27px] top-5 h-3 w-3 rounded-full border-2 border-background ${missed ? 'bg-border/40' : 'bg-foreground'}`} />
      <article className={`rounded-xl border border-border/15 bg-card ${missed ? 'opacity-75' : ''}`}>
        <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-border/10 px-4 py-3">
          <h3 className="text-[15px] font-semibold">
            {longDay(day.key)} <span className="font-normal text-muted-foreground">· {ago(day.key)}</span>
          </h3>
          <p className="text-[13px] text-muted-foreground">
            {[doctors.length ? doctors.map((d) => `Dr. ${d}`).join(', ') : null, appt?.tokenNumber ? `token ${appt.tokenNumber}` : null, status].filter(Boolean).join(' · ')}
          </p>
        </header>

        <div className="space-y-3 px-4 py-3 text-[14px]">
          {(sheet?.chiefComplaint || appt?.reason) && (
            <p><span className="text-muted-foreground">Came for: </span>{sheet?.chiefComplaint || appt?.reason}</p>
          )}

          {vitalBits.length > 0 && (
            <dl className="flex flex-wrap gap-x-5 gap-y-1">
              {vitalBits.map(([k, v]) => (
                <div key={k} className="flex items-baseline gap-1.5">
                  <dt className="text-[12.5px] text-muted-foreground">{k}</dt>
                  <dd className="font-medium tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
          )}

          {day.caseSheets.map((c) => (
            <div key={c.id}>
              {c.diagnosis && <p className="text-[15px] font-semibold">{c.diagnosis}</p>}
              {(c.hopi || c.notes) && (
                <details className="mt-1">
                  <summary className="cursor-pointer text-[13px] text-muted-foreground">Notes</summary>
                  {c.hopi && <p className="mt-1 whitespace-pre-line">{c.hopi}</p>}
                  {c.notes && <p className="mt-1 whitespace-pre-line">{c.notes}</p>}
                </details>
              )}
              {c.followUpDate && <p className="mt-1 text-[13px] text-muted-foreground">Asked to come back on {longDay(dayKey(c.followUpDate))}</p>}
              {(c.attachments?.length ?? 0) > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                  {c.attachments.map((a) => (
                    <button key={a.id} type="button" onClick={() => openPdf(`/case-sheets/attachments/${a.id}/file`)} className="inline-flex items-center gap-1 text-[13px] font-medium underline-offset-4 hover:underline">
                      <Paperclip size={12} aria-hidden="true" /> {a.fileName}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {day.prescriptions.map((p) => (
            <div key={p.id} className="rounded-lg bg-accent/45 px-3 py-2.5">
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="text-[13px] font-medium text-muted-foreground"><Pill size={12} className="mr-1 inline" aria-hidden="true" />Medicines</p>
                <button type="button" onClick={() => openPdf(`/prescriptions/${p.id}/pdf`)} className="text-[13px] font-medium underline-offset-4 hover:underline">Print</button>
              </div>
              <ul className="space-y-1">
                {p.items.map((it, i) => (
                  <li key={i}>
                    <span className="font-medium">{it.drugName}</span>
                    <span className="text-muted-foreground"> · {it.dosage}, {FREQUENCY_WORDS[it.frequency] ?? it.frequency}, {it.duration}</span>
                    {it.instructions && <span className="block text-[13px] text-muted-foreground">{it.instructions}</span>}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {day.labOrders.map((l) => (
            <div key={l.id}>
              <p className="mb-1 text-[13px] font-medium text-muted-foreground">Tests</p>
              <ul className="space-y-0.5">
                {l.items.map((it) => (
                  <li key={it.id} className="flex flex-wrap gap-x-2">
                    <span className="font-medium">{it.testName}</span>
                    <span className={it.resultText || it.resultFileName ? '' : 'text-ink-warning'}>
                      {it.resultText ?? (it.resultFileName ? `report attached (${it.resultFileName})` : 'result awaited')}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {day.certificates.map((c) => (
            <p key={c.id} className="flex items-center justify-between gap-2">
              <span><Award size={13} className="mr-1 inline" aria-hidden="true" />{CERT_WORDS[c.type] ?? c.type}</span>
              <button type="button" onClick={() => openPdf(`/certificates/${c.id}/pdf`)} className="text-[13px] font-medium underline-offset-4 hover:underline">Print</button>
            </p>
          ))}

          {day.bills.map((b) => (
            <p key={b.id} className="flex items-baseline justify-between gap-2 border-t border-border/10 pt-2 text-[13.5px]">
              <span className="text-muted-foreground">Bill</span>
              <span className={b.balance > 0 ? 'font-semibold text-ink-warning' : 'font-medium'}>
                {money(b.total)} · {b.balance > 0 ? `${money(b.balance)} due` : 'paid'}
              </span>
            </p>
          ))}

          {missed && <p className="text-muted-foreground">{appt?.status === 'NO_SHOW' ? 'Booked, did not come.' : 'Booking cancelled.'}</p>}
        </div>
      </article>
    </li>
  );
}

// ── Editing the patient's details ─────────────────────────────────────

const FIELD = 'w-full px-3 py-2 rounded-md bg-background border border-input/60 text-[14px] outline-none focus:border-ring';

// The backend has always had PUT /patients/:id -- nothing ever called it,
// so a typo in a name, a wrong phone number, or a newly-discovered allergy
// could never be corrected after registration.
function PatientEditForm({ patient, onCancel, onSaved }: { patient: Patient; onCancel: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: patient.name,
    age: patient.age?.toString() ?? '',
    gender: patient.gender ?? '',
    phone: patient.phone ?? '',
    bloodGroup: patient.bloodGroup ?? '',
    allergies: patient.allergies ?? '',
    chronicConditions: patient.chronicConditions ?? '',
    category: patient.category,
    email: patient.email ?? '',
    emergencyContactName: patient.emergencyContactName ?? '',
    emergencyContactPhone: patient.emergencyContactPhone ?? '',
    emergencyContactRelation: patient.emergencyContactRelation ?? '',
    insuranceProvider: patient.insuranceProvider ?? '',
    insurancePolicyNumber: patient.insurancePolicyNumber ?? '',
    referredBy: patient.referredBy ?? '',
    deskNote: patient.deskNote ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/patients/${patient.id}`, {
        method: 'PUT',
        data: {
          name: form.name,
          age: form.age ? Number(form.age) : undefined,
          gender: form.gender || undefined,
          phone: form.phone || undefined,
          bloodGroup: form.bloodGroup || undefined,
          allergies: form.allergies || undefined,
          chronicConditions: form.chronicConditions || undefined,
          category: form.category,
          email: form.email || undefined,
          emergencyContactName: form.emergencyContactName || undefined,
          emergencyContactPhone: form.emergencyContactPhone || undefined,
          emergencyContactRelation: form.emergencyContactRelation || undefined,
          insuranceProvider: form.insuranceProvider || undefined,
          insurancePolicyNumber: form.insurancePolicyNumber || undefined,
          referredBy: form.referredBy || undefined,
          deskNote: form.deskNote || undefined,
        },
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the changes.');
    } finally {
      setSaving(false);
    }
  };

  const L = ({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) => (
    <label htmlFor={htmlFor} className="mb-1 block text-[13px] font-medium">{children}</label>
  );

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-3 rounded-xl border border-border/15 bg-card p-4 sm:grid-cols-2 sm:p-5">
      <h2 className="text-[16px] font-semibold sm:col-span-2">Edit details</h2>
      {error && <div role="alert" className="rounded-md tone-danger px-3 py-2 text-[13px] sm:col-span-2">{error}</div>}
      <div className="sm:col-span-2"><L htmlFor="e-name">Full name</L><input id="e-name" value={form.name} onChange={set('name')} required className={FIELD} /></div>
      <div><L htmlFor="e-age">Age</L><input id="e-age" inputMode="numeric" value={form.age} onChange={set('age')} className={FIELD} /></div>
      <div><L htmlFor="e-gender">Gender</L><Pick id="e-gender" value={form.gender} onChange={(gender) => setForm({ ...form, gender })} emptyLabel="Not recorded" placeholder="Gender" options={GENDERS} /></div>
      <div><L htmlFor="e-phone">Phone</L><input id="e-phone" inputMode="tel" value={form.phone} onChange={set('phone')} className={FIELD} /></div>
      <div><L htmlFor="e-blood">Blood group</L><input id="e-blood" value={form.bloodGroup} onChange={set('bloodGroup')} className={FIELD} /></div>
      <div className="sm:col-span-2">
        <L htmlFor="e-cat">Usually seen as</L>
        <Pick id="e-cat" value={form.category} onChange={(category) => setForm({ ...form, category })} options={PATIENT_CATEGORIES.map((c) => ({ value: c.id, label: c.label }))} />
      </div>
      <div className="sm:col-span-2"><L htmlFor="e-allergy">Allergies</L><input id="e-allergy" value={form.allergies} onChange={set('allergies')} placeholder="None known" className={FIELD} /></div>
      <div className="sm:col-span-2"><L htmlFor="e-chronic">Long-term conditions</L><input id="e-chronic" value={form.chronicConditions} onChange={set('chronicConditions')} className={FIELD} /></div>

      {/* Behind a disclosure on purpose. Registration happens at a
          counter with a queue behind the patient, so the fields that
          have to be fast stay above -- these are here for whenever
          somebody has a moment. */}
      <details className="rounded-lg border border-border/15 sm:col-span-2">
        <summary className="cursor-pointer px-3 py-2 text-[13px] text-muted-foreground">Emergency contact, insurance, referral and desk note</summary>
        <div className="grid grid-cols-1 gap-3 border-t border-border/10 p-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><L htmlFor="e-email">Email</L><input id="e-email" type="email" value={form.email} onChange={set('email')} className={FIELD} /></div>
          <div><L htmlFor="e-ecn">Emergency contact</L><input id="e-ecn" value={form.emergencyContactName} onChange={set('emergencyContactName')} className={FIELD} /></div>
          <div><L htmlFor="e-ecp">Their phone</L><input id="e-ecp" inputMode="tel" value={form.emergencyContactPhone} onChange={set('emergencyContactPhone')} className={FIELD} /></div>
          <div className="sm:col-span-2"><L htmlFor="e-ecr">Relationship</L><input id="e-ecr" value={form.emergencyContactRelation} onChange={set('emergencyContactRelation')} placeholder="Son, wife, neighbour…" className={FIELD} /></div>
          <div><L htmlFor="e-ins">Insurer or TPA</L><input id="e-ins" value={form.insuranceProvider} onChange={set('insuranceProvider')} className={FIELD} /></div>
          <div><L htmlFor="e-pol">Policy number</L><input id="e-pol" value={form.insurancePolicyNumber} onChange={set('insurancePolicyNumber')} className={FIELD} /></div>
          <div className="sm:col-span-2"><L htmlFor="e-ref">Referred by</L><input id="e-ref" value={form.referredBy} onChange={set('referredBy')} className={FIELD} /></div>
          <div className="sm:col-span-2">
            <L htmlFor="e-desk">Desk note</L>
            <textarea id="e-desk" value={form.deskNote} onChange={set('deskNote')} rows={2} placeholder="Prefers Marathi, hard of hearing, comes with her son" className={FIELD} />
            <p className="mt-1 text-[12.5px] text-muted-foreground">Reception can see this. Anything clinical belongs in the case sheet.</p>
          </div>
        </div>
      </details>
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" variant="primary" busy={saving} busyLabel="Saving…">Save</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

// ── Vitals over time ──────────────────────────────────────────────────

// Longitudinal trend, not just isolated visit notes. Plain SVG, one hue
// per series from the theme, values on hover -- and only drawn once there
// are two readings, because one point is not a trend.
function VitalsTrendSection({ points }: { points: VitalsPoint[] }) {
  const weightPoints = points.filter((p) => p.weight != null) as (VitalsPoint & { weight: number })[];
  const bpPoints = points.filter((p) => p.bp) as (VitalsPoint & { bp: { systolic: number; diastolic: number } })[];
  if (weightPoints.length < 2 && bpPoints.length < 2) return null;
  const lastBp = bpPoints[bpPoints.length - 1];
  const lastWt = weightPoints[weightPoints.length - 1];

  return (
    <section className="rounded-xl border border-border/15 bg-card p-4">
      <h2 className="mb-3 text-[15px] font-semibold">Over time</h2>
      {bpPoints.length >= 2 && (
        <div className="mb-4">
          <p className="flex items-baseline justify-between text-[13px]">
            <span className="text-muted-foreground">Blood pressure</span>
            <span className="font-medium tabular-nums">{lastBp!.bp.systolic}/{lastBp!.bp.diastolic}</span>
          </p>
          <MiniLineChart series={[
            { label: 'Systolic', color: 'hsl(var(--chart-1))', values: bpPoints.map((p) => ({ date: p.date, value: p.bp.systolic })) },
            { label: 'Diastolic', color: 'hsl(var(--chart-2))', values: bpPoints.map((p) => ({ date: p.date, value: p.bp.diastolic })) },
          ]} />
        </div>
      )}
      {weightPoints.length >= 2 && (
        <div>
          <p className="flex items-baseline justify-between text-[13px]">
            <span className="text-muted-foreground">Weight</span>
            <span className="font-medium tabular-nums">{lastWt!.weight} kg</span>
          </p>
          <MiniLineChart series={[{ label: 'Weight (kg)', color: 'hsl(var(--chart-1))', values: weightPoints.map((p) => ({ date: p.date, value: p.weight })) }]} />
        </div>
      )}
    </section>
  );
}

function MiniLineChart({ series }: { series: { label: string; color: string; values: { date: string; value: number }[] }[] }) {
  const width = 268;
  const height = 72;
  const pad = 8;
  const all = series.flatMap((s) => s.values.map((v) => v.value));
  const max = Math.max(...all);
  const min = Math.min(...all);
  const range = max - min || 1;
  const count = series[0]?.values.length ?? 0;
  const stepX = count > 1 ? (width - pad * 2) / (count - 1) : 0;

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="mt-1 h-[72px] w-full" role="img" aria-label={series.map((s) => s.label).join(' and ')}>
        <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="hsl(var(--chart-grid) / 0.15)" strokeWidth={1} />
        {series.map((s) => {
          const pts = s.values.map((v, i) => ({ x: pad + i * stepX, y: height - pad - ((v.value - min) / range) * (height - pad * 2), ...v }));
          const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
          return (
            <g key={s.label}>
              <path d={path} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              {pts.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={4} fill={s.color} stroke="hsl(var(--card))" strokeWidth={2}>
                  <title>{`${s.label}, ${shortDay(p.date)}: ${p.value}`}</title>
                </circle>
              ))}
            </g>
          );
        })}
      </svg>
      {series.length > 1 && (
        <div className="mt-1 flex gap-3">
          {series.map((s) => (
            <span key={s.label} className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
              <span className="h-2 w-2 rounded-full" style={{ background: s.color }} /> {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
