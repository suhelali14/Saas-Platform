import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, FileText, Pill, Award, Download, Paperclip, User, AlertTriangle, History, Activity, Pencil, FlaskConical } from 'lucide-react';
import { SkeletonList, SkeletonTable, SkeletonStats, SkeletonForm, SkeletonPanels } from '../components/Skeleton';
import { apiFetch, openPdf, ApiError } from '../lib/api';
import { useClinicAuth } from '../contexts/ClinicAuthContext';
import { CaseSheetForm, PrescriptionForm, CertificateForm, LabOrderForm } from '../components/ClinicalForms';
import { VisitCharges } from '../components/VisitCharges';
import { ScribePanel } from '../components/ScribePanel';
import { CareRecords, useSpecialty } from '../components/CareRecords';
import { longDate } from '../lib/specialty';
import { PastVisits } from '../components/PatientHistory';
import { useAssistantChanged } from '../lib/assistant-changed';

interface Vitals { bp?: string; temp?: string; spo2?: string; weight?: string; pulse?: string }
interface Appointment {
  id: string; scheduledAt: string; status: string; reason: string | null;
  vitals: Vitals | null;
  patient: {
    id: string; uhid: string; name: string; age: number | null; gender: string | null; phone: string | null;
    allergies: string | null; chronicConditions: string | null; bloodGroup: string | null; dob?: string | null;
  };
  doctor: { id: string; name: string } | null;
}
interface Doctor { name: string }
interface CaseSheet {
  id: string; chiefComplaint: string | null; diagnosis: string | null; notes: string | null;
  vitals: Record<string, string> | null; createdAt: string; doctor: Doctor; attachments: { id: string; fileName: string }[];
}
interface PrescriptionItemT { drugName: string; dosage: string; frequency: string; duration: string; instructions: string | null }
interface Prescription { id: string; createdAt: string; doctor: Doctor; items: PrescriptionItemT[] }
interface Certificate { id: string; type: string; content: string; createdAt: string; doctor: Doctor }
interface LabOrderItemT { id: string; testName: string; normalRange: string | null; resultText: string | null; completedAt: string | null }
interface LabOrder { id: string; status: string; createdAt: string; doctor: Doctor; items: LabOrderItemT[] }
interface PreviousVisit { createdAt: string; diagnosis: string | null; chiefComplaint: string | null; followUpDate: string | null }

const STATUS_FLOW = ['SCHEDULED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED'];
const VITALS_ROLES = new Set(['RECEPTIONIST', 'NURSE', 'DOCTOR', 'ADMIN']);

/** Statuses as words a person says, not database constants. */
const STATUS_WORDS: Record<string, string> = {
  SCHEDULED: 'Booked', CHECKED_IN: 'Waiting', IN_PROGRESS: 'With the doctor', COMPLETED: 'Seen', CANCELLED: 'Cancelled', NO_SHOW: 'Did not come',
};
const NEXT_ACTION: Record<string, string> = {
  CHECKED_IN: 'Check in', IN_PROGRESS: 'Start consultation', COMPLETED: 'Finish visit',
};
const CERT_WORDS: Record<string, string> = { SICK_LEAVE: 'Sick leave certificate', FITNESS: 'Fitness certificate', REFERRAL: 'Referral letter' };

export function Encounter() {
  const { id } = useParams<{ id: string }>();
  const { user, canWriteClinical, hasModule } = useClinicAuth();
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [caseSheets, setCaseSheets] = useState<CaseSheet[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [labOrders, setLabOrders] = useState<LabOrder[]>([]);
  const [previousVisit, setPreviousVisit] = useState<PreviousVisit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<'none' | 'caseSheet' | 'prescription' | 'certificate' | 'vitals' | 'labs'>('none');

  const canRecordVitals = user && VITALS_ROLES.has(user.role);
  // Specialty forms for this visit: the open pregnancy, the forms this
  // doctor's speciality uses. Money-only roles never open this screen.
  const specialty = useSpecialty(appointment?.patient.id, id);

  useEffect(() => {
    load();
  }, [id]);

  // The assistant changed something: show it.
  useAssistantChanged(() => { void load(); });
  const load = async () => {
    try {
      const res = await apiFetch<{ appointment: Appointment; caseSheets: CaseSheet[]; prescriptions: Prescription[]; certificates: Certificate[]; labOrders: LabOrder[]; previousVisit: PreviousVisit | null }>(`/appointments/${id}/encounter`);
      setAppointment(res.appointment);
      setCaseSheets(res.caseSheets);
      setPrescriptions(res.prescriptions);
      setCertificates(res.certificates);
      setLabOrders(res.labOrders);
      setPreviousVisit(res.previousVisit);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load this visit.');
    }
  };

  const advanceStatus = async () => {
    if (!appointment) return;
    const idx = STATUS_FLOW.indexOf(appointment.status);
    const next = STATUS_FLOW[idx + 1];
    if (!next) return;
    try {
      await apiFetch(`/appointments/${appointment.id}`, { method: 'PATCH', data: { status: next } });
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to update status.');
    }
  };

  if (!appointment) return error
    ? <div className="p-8 text-muted-foreground">{error}</div>
    : <div className="p-4 sm:p-6 md:p-8 max-w-6xl"><SkeletonPanels count={3} label="Loading the consultation" /></div>;

  const nextStatus = STATUS_FLOW[STATUS_FLOW.indexOf(appointment.status) + 1];
  const hasVitals = appointment.vitals && Object.values(appointment.vitals).some(Boolean);
  const hasSafetyAlert = appointment.patient.allergies || appointment.patient.chronicConditions;

  // ── What this visit holds, said once ────────────────────────────────
  // A visit can have several prescriptions and lab orders on it (one
  // written, one dictated, one from the assistant). Listed as a card
  // each, the same medicine and the same test appeared four times and a
  // doctor had to work out what the patient was actually given. Here
  // each medicine and each test is one line.
  const sameText = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
  const medicines = prescriptions
    .flatMap((rx) => rx.items)
    .filter((item, i, all) => all.findIndex((o) => [o.drugName, o.dosage, o.frequency, o.duration].map(sameText).join('|') === [item.drugName, item.dosage, item.frequency, item.duration].map(sameText).join('|')) === i);
  const tests = labOrders
    .flatMap((order) => order.items)
    // A test ordered twice is one test; the copy with a result is the one to show.
    .sort((x, y) => Number(Boolean(y.completedAt)) - Number(Boolean(x.completedAt)))
    .filter((item, i, all) => all.findIndex((o) => sameText(o.testName) === sameText(item.testName)) === i);
  const note = caseSheets[0];
  const nothingYet = caseSheets.length === 0 && prescriptions.length === 0 && certificates.length === 0 && labOrders.length === 0;
  const CARD = 'rounded-xl border border-border/15 bg-card p-4';

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-6xl">
      <Link to="/queue" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"><ArrowLeft size={14} /> Back to queue</Link>

      {/* ── Who this is ─────────────────────────────────────────────── */}
      <header className="mb-5 rounded-xl border border-border/15 bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{appointment.patient.name}</h1>
              <span className="px-2 py-0.5 rounded-full tone-success text-xs font-mono font-semibold">{appointment.patient.uhid}</span>
              <span className="px-2.5 py-1 rounded-full text-xs font-medium tone-violet">{STATUS_WORDS[appointment.status] ?? appointment.status}</span>
            </div>
            <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[14px] text-muted-foreground">
              {appointment.patient.age != null && <span>{appointment.patient.age} years</span>}
              {appointment.patient.gender && <span>{appointment.patient.gender}</span>}
              {appointment.patient.bloodGroup && <span>Blood group {appointment.patient.bloodGroup}</span>}
              {appointment.patient.phone && <span>{appointment.patient.phone}</span>}
              <Link to={`/patients/${appointment.patient.id}`} className="font-medium text-ink-success hover:underline">Open full file →</Link>
            </p>
            <p className="mt-2 text-[14px]">
              <span className="text-muted-foreground">Came for: </span>
              <span className="font-medium">{appointment.reason || 'Not said'}</span>
              <span className="text-muted-foreground">
                {' · '}{new Date(appointment.scheduledAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                {appointment.doctor ? ` · Dr. ${appointment.doctor.name.replace(/^Dr\.?\s*/i, '')}` : ''}
              </span>
            </p>
            {specialty.data?.pregnancy && (
              <p className="mt-2 inline-flex rounded-md tone-violet px-2.5 py-1 text-[14px] font-semibold">
                Pregnant{specialty.data.pregnancy.ga ? ` · ${specialty.data.pregnancy.ga}` : ''}{specialty.data.pregnancy.edd ? ` · EDD ${longDate(specialty.data.pregnancy.edd)}` : ''}
              </p>
            )}
          </div>
          {nextStatus && (
            <button onClick={advanceStatus} className="shrink-0 rounded-lg bg-primary px-4 py-2 text-[14px] font-semibold text-primary-foreground hover:opacity-90">
              {NEXT_ACTION[nextStatus] ?? `Mark ${nextStatus}`}
            </button>
          )}
        </div>

        {/* Allergies and long-term conditions stay with the name: a doctor
            should never have to look for them before prescribing. */}
        {hasSafetyAlert && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-ink-danger/30 bg-ink-danger/10 p-3">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-ink-danger" />
            <div className="text-[14px] text-ink-danger">
              {appointment.patient.allergies && <div><span className="font-semibold">Allergic to:</span> {appointment.patient.allergies}</div>}
              {appointment.patient.chronicConditions && <div><span className="font-semibold">Long-term conditions:</span> {appointment.patient.chronicConditions}</div>}
            </div>
          </div>
        )}
      </header>

      {error && <div className="mb-4 px-3 py-2 rounded-lg tone-danger text-sm">{error}</div>}

      {/* Two columns on a wide screen: what the doctor does on the left,
          what they look at while doing it on the right. One column on a
          phone, with what they look at first. */}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {/* ── What to look at ─────────────────────────────────────── */}
        <aside className="flex flex-col gap-4 lg:order-last" aria-label="About this patient">
          <section className="rounded-xl border border-ink-info/20 bg-ink-info/5 p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 text-[14px] font-semibold text-ink-info"><Activity size={14} /> Vitals today</h2>
              {canRecordVitals && (
                <button onClick={() => setPanel(panel === 'vitals' ? 'none' : 'vitals')} className="flex items-center gap-1 text-[13px] font-medium text-ink-info hover:underline">
                  <Pencil size={12} /> {hasVitals ? 'Change' : 'Record'}
                </button>
              )}
            </div>
            {panel === 'vitals' ? (
              <VitalsInlineForm appointmentId={appointment.id} vitals={appointment.vitals} onDone={() => { setPanel('none'); load(); }} />
            ) : hasVitals ? (
              <dl className="grid grid-cols-3 gap-x-3 gap-y-2">
                {([['BP', appointment.vitals?.bp], ['Pulse', appointment.vitals?.pulse], ['Temp', appointment.vitals?.temp], ['SpO₂', appointment.vitals?.spo2], ['Weight', appointment.vitals?.weight]] as [string, string | undefined][])
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-[12px] text-muted-foreground">{k}</dt>
                      <dd className="text-[16px] font-semibold tabular-nums">{v}</dd>
                    </div>
                  ))}
              </dl>
            ) : (
              <p className="text-[13px] text-muted-foreground">Not recorded yet.</p>
            )}
          </section>

          {/* Continuity of care -- what happened last time, without leaving this screen. */}
          {previousVisit && (
            <section className={CARD}>
              <h2 className="mb-1 flex items-center gap-1.5 text-[14px] font-semibold"><History size={14} /> Last visit <span className="font-normal text-muted-foreground">· {new Date(previousVisit.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span></h2>
              {previousVisit.diagnosis && <p className="text-[14px] font-medium">{previousVisit.diagnosis}</p>}
              {previousVisit.chiefComplaint && <p className="text-[13.5px] text-muted-foreground">Came for: {previousVisit.chiefComplaint}</p>}
              {previousVisit.followUpDate && (
                <p className="mt-1 text-[13.5px] text-ink-warning">Was asked to come back on {new Date(previousVisit.followUpDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
              )}
            </section>
          )}

          {/* Everything before the last visit, to look through and narrow
              down without leaving this one. */}
          <PastVisits patientId={appointment.patient.id} />
        </aside>

        {/* ── What to do ──────────────────────────────────────────── */}
        <div className="min-w-0">
          {/* Above the forms it fills in: a doctor who uses it does not open
              them, and one who does not is one scroll from where they were. */}
          {canWriteClinical && hasModule('scribe') && (
            <ScribePanel appointmentId={appointment.id} patientName={appointment.patient.name} onSaved={load} />
          )}

          {canWriteClinical && (
            <section className="mb-6">
              <h2 className="mb-2 text-[13px] font-medium text-muted-foreground">{hasModule('scribe') ? 'Or write it yourself' : 'Write this visit'}</h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {([
                  ['caseSheet', 'Note', 'Complaint and diagnosis', FileText],
                  ['prescription', 'Medicines', 'Write a prescription', Pill],
                  ...(hasModule('labs') ? [['labs', 'Tests', 'Order lab tests', FlaskConical]] : []),
                  ['certificate', 'Certificate', 'Leave, fitness, referral', Award],
                ] as [typeof panel, string, string, typeof FileText][]).map(([key, label, hint, Icon]) => (
                  <button key={key} type="button" onClick={() => setPanel(panel === key ? 'none' : key)} aria-pressed={panel === key}
                    className={`flex flex-col items-start gap-0.5 rounded-xl border px-3 py-2.5 text-left transition-colors ${panel === key ? 'border-foreground bg-foreground text-background' : 'border-border/20 bg-card hover:bg-accent'}`}>
                    <span className="flex items-center gap-1.5 text-[14px] font-semibold"><Icon size={14} /> {label}</span>
                    <span className={`text-[12px] ${panel === key ? 'text-background/75' : 'text-muted-foreground'}`}>{hint}</span>
                  </button>
                ))}
              </div>
              <div className={panel === 'caseSheet' || panel === 'prescription' || panel === 'certificate' || panel === 'labs' ? 'mt-3' : ''}>
                {panel === 'caseSheet' && (
                  <CaseSheetForm patientId={appointment.patient.id} appointmentId={appointment.id} initialVitals={appointment.vitals || undefined} onDone={() => { setPanel('none'); load(); }} />
                )}
                {panel === 'prescription' && (
                  <PrescriptionForm patientId={appointment.patient.id} appointmentId={appointment.id} onDone={() => { setPanel('none'); load(); }} />
                )}
                {panel === 'certificate' && (
                  <CertificateForm patientId={appointment.patient.id} patientName={appointment.patient.name} appointmentId={appointment.id} onDone={() => { setPanel('none'); load(); }} />
                )}
                {panel === 'labs' && (
                  <LabOrderForm patientId={appointment.patient.id} appointmentId={appointment.id} onDone={() => { setPanel('none'); load(); }} />
                )}
              </div>
            </section>
          )}

          {specialty.data && (
            <CareRecords mode="visit" appointmentId={appointment.id} data={specialty.data} reload={specialty.reload}
              patient={{ id: appointment.patient.id, name: appointment.patient.name, age: appointment.patient.age, gender: appointment.patient.gender, dob: appointment.patient.dob }} />
          )}

          {/* ── What has been written on this visit ───────────────── */}
          <section className={`${CARD} mb-6`}>
            <h2 className="mb-3 text-[16px] font-semibold">Written on this visit</h2>
            {nothingYet ? (
              <p className="text-[14px] text-muted-foreground">Nothing yet. The note, medicines and tests appear here as they are saved.</p>
            ) : (
              <dl className="space-y-4 text-[14px]">
                {note && (
                  <div>
                    <dt className="mb-1 flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground"><FileText size={13} /> Note</dt>
                    <dd>
                      {note.diagnosis && <p className="text-[15px] font-semibold">{note.diagnosis}</p>}
                      {note.chiefComplaint && <p><span className="text-muted-foreground">Came for: </span>{note.chiefComplaint}</p>}
                      {note.notes && <p className="mt-0.5 whitespace-pre-line text-muted-foreground">{note.notes}</p>}
                      {caseSheets.flatMap((c) => c.attachments ?? []).length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                          {caseSheets.flatMap((c) => c.attachments ?? []).map((file) => (
                            <button key={file.id} onClick={() => openPdf(`/case-sheets/attachments/${file.id}/file`)} className="flex items-center gap-1 text-[13px] font-medium text-ink-success hover:underline">
                              <Paperclip size={12} /> {file.fileName}
                            </button>
                          ))}
                        </div>
                      )}
                    </dd>
                  </div>
                )}

                {medicines.length > 0 && (
                  <div>
                    <dt className="mb-1 flex flex-wrap items-center justify-between gap-2 text-[13px] font-medium text-muted-foreground">
                      <span className="flex items-center gap-1.5"><Pill size={13} /> Medicines · {medicines.length}</span>
                      <span className="flex flex-wrap gap-x-3">
                        {prescriptions.map((rx, i) => (
                          <button key={rx.id} onClick={() => openPdf(`/prescriptions/${rx.id}/pdf`)} className="flex items-center gap-1 font-medium text-ink-success hover:underline">
                            <Download size={12} /> {prescriptions.length > 1 ? `Print prescription ${prescriptions.length - i}` : 'Print prescription'}
                          </button>
                        ))}
                      </span>
                    </dt>
                    <dd>
                      <ul className="space-y-1">
                        {medicines.map((item, i) => (
                          <li key={i}>
                            <span className="font-medium">{item.drugName}</span>
                            <span className="text-muted-foreground"> · {[item.dosage, item.frequency, item.duration].filter(Boolean).join(', ')}</span>
                            {item.instructions && <span className="text-muted-foreground"> · {item.instructions}</span>}
                          </li>
                        ))}
                      </ul>
                    </dd>
                  </div>
                )}

                {tests.length > 0 && (
                  <div>
                    <dt className="mb-1 flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground"><FlaskConical size={13} /> Tests · {tests.length}</dt>
                    <dd>
                      <ul className="space-y-1">
                        {tests.map((item) => (
                          <li key={item.id} className="flex flex-wrap items-baseline gap-x-2">
                            <span className="font-medium">{item.testName}</span>
                            {/* The doctor reading a result mid-consultation is exactly
                                who needs the reference beside it. */}
                            {item.completedAt
                              ? <span>{item.resultText || 'report attached'}{item.normalRange ? <span className="text-muted-foreground"> (normal {item.normalRange})</span> : null}</span>
                              : <span className="text-ink-warning">result awaited</span>}
                          </li>
                        ))}
                      </ul>
                    </dd>
                  </div>
                )}

                {certificates.length > 0 && (
                  <div>
                    <dt className="mb-1 flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground"><Award size={13} /> Certificates · {certificates.length}</dt>
                    <dd>
                      <ul className="space-y-1">
                        {certificates.map((c) => (
                          <li key={c.id} className="flex flex-wrap items-baseline justify-between gap-2">
                            <span><span className="font-medium">{CERT_WORDS[c.type] ?? c.type}</span><span className="text-muted-foreground"> · Dr. {c.doctor.name.replace(/^Dr\.?\s*/i, '')}, {new Date(c.createdAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</span></span>
                            <button onClick={() => openPdf(`/certificates/${c.id}/pdf`)} className="flex items-center gap-1 text-[13px] font-medium text-ink-success hover:underline"><Download size={12} /> Print</button>
                          </li>
                        ))}
                      </ul>
                    </dd>
                  </div>
                )}
              </dl>
            )}
          </section>

          {/* Charges + payment for this visit. Lives inside the Encounter so a
              clinic without a dedicated cashier can bill before the patient
              leaves, without navigating to Billing. */}
          <VisitCharges appointmentId={appointment.id} doctorId={appointment.doctor?.id ?? null} onChanged={load} />
        </div>
      </div>
    </div>
  );
}

function VitalsInlineForm({ appointmentId, vitals, onDone }: { appointmentId: string; vitals: Vitals | null; onDone: () => void }) {
  const [form, setForm] = useState({
    bp: vitals?.bp || '', temp: vitals?.temp || '', spo2: vitals?.spo2 || '', weight: vitals?.weight || '', pulse: vitals?.pulse || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/appointments/${appointmentId}/vitals`, { method: 'PATCH', data: form });
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to save vitals.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 mt-1">
      {error && <div className="px-2 py-1.5 rounded-lg tone-danger text-xs">{error}</div>}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
        <input placeholder="BP" value={form.bp} onChange={(e) => setForm({ ...form, bp: e.target.value })} className="px-2 py-1.5 rounded-lg bg-foreground/5 border border-border/10 text-xs outline-none focus:border-ink-info" />
        <input placeholder="Temp" value={form.temp} onChange={(e) => setForm({ ...form, temp: e.target.value })} className="px-2 py-1.5 rounded-lg bg-foreground/5 border border-border/10 text-xs outline-none focus:border-ink-info" />
        <input placeholder="SpO2" value={form.spo2} onChange={(e) => setForm({ ...form, spo2: e.target.value })} className="px-2 py-1.5 rounded-lg bg-foreground/5 border border-border/10 text-xs outline-none focus:border-ink-info" />
        <input placeholder="Weight" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} className="px-2 py-1.5 rounded-lg bg-foreground/5 border border-border/10 text-xs outline-none focus:border-ink-info" />
        <input placeholder="Pulse" value={form.pulse} onChange={(e) => setForm({ ...form, pulse: e.target.value })} className="px-2 py-1.5 rounded-lg bg-foreground/5 border border-border/10 text-xs outline-none focus:border-ink-info" />
      </div>
      <button type="submit" disabled={saving} className="self-start px-3 py-1.5 rounded-lg bg-info text-info-foreground text-xs font-semibold hover:bg-ink-info/90 transition-colors disabled:opacity-50">
        {saving ? 'Saving...' : 'Save Vitals'}
      </button>
    </form>
  );
}
