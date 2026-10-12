import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, FileText, Pill, Award, CalendarClock, Paperclip, Download, BadgeCheck, AlertTriangle, IndianRupee, Activity, Pencil } from 'lucide-react';
import { SkeletonList, SkeletonTable, SkeletonStats, SkeletonForm, SkeletonPanels } from '../components/Skeleton';
import { apiFetch, openPdf, ApiError } from '../lib/api';
import { useClinicAuth } from '../contexts/ClinicAuthContext';
import { CaseSheetForm, PrescriptionForm, CertificateForm } from '../components/ClinicalForms';
import { PATIENT_CATEGORIES, CATEGORY_BADGES } from '../lib/categories';
import { Pick } from '../components/Field';

interface Patient {
  id: string; uhid: string; name: string; age: number | null; gender: string | null; phone: string | null;
  bloodGroup: string | null; allergies: string | null; chronicConditions: string | null; category: string;
}
interface Doctor { name: string }
interface CaseSheet {
  id: string; chiefComplaint: string | null; hopi: string | null; diagnosis: string | null; notes: string | null;
  vitals: { bp?: string; temp?: string; spo2?: string; weight?: string; pulse?: string } | null;
  createdAt: string; doctor: Doctor; attachments: { id: string; fileName: string }[];
}
interface PrescriptionItemT { drugName: string; dosage: string; frequency: string; duration: string; instructions: string | null }
interface Prescription { id: string; createdAt: string; doctor: Doctor; items: PrescriptionItemT[] }
interface Certificate { id: string; type: string; content: string; createdAt: string; doctor: Doctor }
interface Appointment { id: string; scheduledAt: string; status: string; reason: string | null }
interface VitalsPoint { date: string; bp: { systolic: number; diastolic: number } | null; weight: number | null; pulse: number | null; spo2: number | null; temp: number | null }

const BILLING_ROLES = new Set(['RECEPTIONIST', 'DOCTOR', 'ADMIN']);


/** The options a patient's gender field offers. One list, shared by the
 *  create and the edit form -- they were two literal copies, which is how
 *  one screen ends up offering a choice the other does not. */
const GENDERS = [
  { value: 'Male', label: 'Male' },
  { value: 'Female', label: 'Female' },
  { value: 'Other', label: 'Other' },
];

export function PatientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, canWriteClinical } = useClinicAuth();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [caseSheets, setCaseSheets] = useState<CaseSheet[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [vitalsTrend, setVitalsTrend] = useState<VitalsPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<'none' | 'caseSheet' | 'prescription' | 'certificate'>('none');
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    load();
    apiFetch<{ data: VitalsPoint[] }>(`/patients/${id}/vitals-trend`).then((res) => setVitalsTrend(res.data)).catch(() => {});
  }, [id]);

  const load = async () => {
    try {
      const res = await apiFetch<{ patient: Patient; caseSheets: CaseSheet[]; prescriptions: Prescription[]; certificates: Certificate[]; appointments: Appointment[] }>(`/patients/${id}/history`);
      setPatient(res.patient);
      setCaseSheets(res.caseSheets);
      setPrescriptions(res.prescriptions);
      setCertificates(res.certificates);
      setAppointments(res.appointments);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load patient.');
    }
  };

  const createInvoice = async () => {
    if (!patient) return;
    try {
      const inv = await apiFetch<{ id: string }>('/invoices', { method: 'POST', data: { patientId: patient.id } });
      navigate('/billing', { state: { invoiceId: inv.id } });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to create invoice.');
    }
  };

  if (!patient) return error
    ? <div className="p-8 text-muted-foreground">{error}</div>
    : <div className="p-4 sm:p-6 md:p-8 max-w-3xl"><SkeletonPanels count={4} label="Loading the patient record" /></div>;

  type TimelineEntry = { date: string; kind: 'caseSheet' | 'prescription' | 'certificate' | 'appointment'; data: any };
  const timeline: TimelineEntry[] = [
    ...caseSheets.map((c) => ({ date: c.createdAt, kind: 'caseSheet' as const, data: c })),
    ...prescriptions.map((p) => ({ date: p.createdAt, kind: 'prescription' as const, data: p })),
    ...certificates.map((c) => ({ date: c.createdAt, kind: 'certificate' as const, data: c })),
    ...appointments.map((a) => ({ date: a.scheduledAt, kind: 'appointment' as const, data: a })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-3xl">
      <Link to="/patients" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"><ArrowLeft size={14} /> Back to patients</Link>

      {(patient.allergies || patient.chronicConditions) && (
        <div className="mb-4 p-3 rounded-xl border border-red-500/30 bg-red-500/10 flex items-start gap-2">
          <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
          <div className="text-sm text-red-200">
            {patient.allergies && <div><span className="font-semibold text-red-400">Allergies:</span> {patient.allergies}</div>}
            {patient.chronicConditions && <div><span className="font-semibold text-red-400">Chronic conditions:</span> {patient.chronicConditions}</div>}
          </div>
        </div>
      )}

      <div className="p-4 rounded-xl border border-border/10 bg-foreground/[0.03] mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">{patient.name}</h1>
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-mono font-semibold">
              <BadgeCheck size={11} /> {patient.uhid}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setEditing((v) => !v)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <Pencil size={12} /> Edit
            </button>
            {user && BILLING_ROLES.has(user.role) && (
              <button onClick={createInvoice} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <IndianRupee size={12} /> New Bill
              </button>
            )}
            <button onClick={() => openPdf(`/patients/${patient.id}/report/pdf`)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <Download size={12} /> Download Report
            </button>
          </div>
        </div>
        <div className="text-sm text-muted-foreground flex flex-wrap gap-3 mt-1">
          {patient.age != null && <span>{patient.age}y</span>}
          {patient.gender && <span>{patient.gender}</span>}
          {patient.bloodGroup && <span>{patient.bloodGroup}</span>}
          {patient.phone && <span>{patient.phone}</span>}
          {CATEGORY_BADGES[patient.category] && (
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${CATEGORY_BADGES[patient.category].color}`}>
              {CATEGORY_BADGES[patient.category].label}
            </span>
          )}
        </div>
      </div>

      {editing && (
        <PatientEditForm
          patient={patient}
          onCancel={() => setEditing(false)}
          onSaved={() => { setEditing(false); load(); }}
        />
      )}

      {vitalsTrend.length >= 2 && <VitalsTrendSection points={vitalsTrend} />}

      {error && <div className="mb-4 px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-sm">{error}</div>}

      {canWriteClinical && (
        <div className="flex gap-2 mb-6 flex-wrap">
          <button onClick={() => setPanel(panel === 'caseSheet' ? 'none' : 'caseSheet')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground/10 text-sm font-medium hover:bg-foreground/20">
            <FileText size={14} /> New Case Sheet
          </button>
          <button onClick={() => setPanel(panel === 'prescription' ? 'none' : 'prescription')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground/10 text-sm font-medium hover:bg-foreground/20">
            <Pill size={14} /> New Prescription
          </button>
          <button onClick={() => setPanel(panel === 'certificate' ? 'none' : 'certificate')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground/10 text-sm font-medium hover:bg-foreground/20">
            <Award size={14} /> New Certificate
          </button>
        </div>
      )}

      {panel === 'caseSheet' && <CaseSheetForm patientId={patient.id} onDone={() => { setPanel('none'); load(); }} />}
      {panel === 'prescription' && <PrescriptionForm patientId={patient.id} onDone={() => { setPanel('none'); load(); }} />}
      {panel === 'certificate' && <CertificateForm patientId={patient.id} patientName={patient.name} onDone={() => { setPanel('none'); load(); }} />}

      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 mt-8">History</h2>
      <div className="flex flex-col gap-3">
        {timeline.length === 0 && <div className="text-center py-10 text-muted-foreground/70 text-sm">No records yet.</div>}
        {timeline.map((entry) => (
          <TimelineCard key={`${entry.kind}-${entry.data.id}`} entry={entry} />
        ))}
      </div>
    </div>
  );
}

function TimelineCard({ entry }: { entry: { date: string; kind: string; data: any } }) {
  const dateLabel = new Date(entry.date).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  if (entry.kind === 'caseSheet') {
    const c: CaseSheet = entry.data;
    return (
      <div className="p-4 rounded-xl border border-border/10 bg-foreground/[0.02]">
        <div className="flex items-center gap-2 text-xs text-muted-foreground/70 mb-2"><FileText size={12} /> Case Sheet · {dateLabel} · {c.doctor.name}</div>
        {c.chiefComplaint && <div className="text-sm mb-1"><span className="text-muted-foreground">Complaint:</span> {c.chiefComplaint}</div>}
        {c.diagnosis && <div className="text-sm mb-1"><span className="text-muted-foreground">Diagnosis:</span> {c.diagnosis}</div>}
        {c.vitals && (
          <div className="text-xs text-muted-foreground mt-2 flex gap-3 flex-wrap">
            {c.vitals.bp && <span>BP: {c.vitals.bp}</span>}
            {c.vitals.temp && <span>Temp: {c.vitals.temp}</span>}
            {c.vitals.spo2 && <span>SpO2: {c.vitals.spo2}</span>}
            {c.vitals.pulse && <span>Pulse: {c.vitals.pulse}</span>}
            {c.vitals.weight && <span>Wt: {c.vitals.weight}</span>}
          </div>
        )}
        {(c.attachments?.length ?? 0) > 0 && (
          <div className="mt-2 flex flex-col gap-1">
            {c.attachments.map((a) => (
              <button key={a.id} onClick={() => openPdf(`/case-sheets/attachments/${a.id}/file`)} className="flex items-center gap-1 text-xs text-emerald-400 hover:underline w-fit">
                <Paperclip size={11} /> {a.fileName}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (entry.kind === 'prescription') {
    const p: Prescription = entry.data;
    return (
      <div className="p-4 rounded-xl border border-border/10 bg-foreground/[0.02]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground/70"><Pill size={12} /> Prescription · {dateLabel} · {p.doctor.name}</div>
          <button onClick={() => openPdf(`/prescriptions/${p.id}/pdf`)} className="flex items-center gap-1 text-xs text-emerald-400 hover:underline">
            <Download size={11} /> PDF
          </button>
        </div>
        <div className="flex flex-col gap-0.5">
          {p.items.map((item, i) => (
            <div key={i} className="text-sm">
              <span className="font-medium">{item.drugName}</span> — {item.dosage}, {item.frequency}, {item.duration}
              {item.instructions && <span className="text-muted-foreground/70"> ({item.instructions})</span>}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (entry.kind === 'certificate') {
    const c: Certificate = entry.data;
    return (
      <div className="p-4 rounded-xl border border-border/10 bg-foreground/[0.02]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground/70"><Award size={12} /> {c.type.replace('_', ' ')} Certificate · {dateLabel} · {c.doctor.name}</div>
          <button onClick={() => openPdf(`/certificates/${c.id}/pdf`)} className="flex items-center gap-1 text-xs text-emerald-400 hover:underline">
            <Download size={11} /> PDF
          </button>
        </div>
        <p className="text-sm text-foreground/80">{c.content}</p>
      </div>
    );
  }

  const a: Appointment = entry.data;
  return (
    <div className="p-3 rounded-xl border border-border/10 bg-foreground/[0.01] text-xs text-muted-foreground flex items-center gap-2">
      <CalendarClock size={12} /> Appointment · {dateLabel} · {a.status.replace('_', ' ')} {a.reason && `· ${a.reason}`}
    </div>
  );
}

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
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        },
      });
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="mb-6 p-4 rounded-xl border border-border/10 bg-foreground/[0.03] grid grid-cols-1 sm:grid-cols-2 gap-3">
      <h3 className="col-span-2 text-sm font-semibold">Edit Patient</h3>
      {error && <div className="col-span-2 px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-sm">{error}</div>}
      <input placeholder="Full name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="col-span-2 px-3 py-2 rounded-lg bg-foreground/5 border border-border/10 text-sm outline-none focus:border-emerald-400" />
      <input placeholder="Age" type="number" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} className="px-3 py-2 rounded-lg bg-foreground/5 border border-border/10 text-sm outline-none focus:border-emerald-400" />
      <Pick
        value={form.gender}
        onChange={(gender) => setForm({ ...form, gender })}
        emptyLabel="Not recorded"
        placeholder="Gender"
        options={GENDERS}
      />
      <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="px-3 py-2 rounded-lg bg-foreground/5 border border-border/10 text-sm outline-none focus:border-emerald-400" />
      <input placeholder="Blood group" value={form.bloodGroup} onChange={(e) => setForm({ ...form, bloodGroup: e.target.value })} className="px-3 py-2 rounded-lg bg-foreground/5 border border-border/10 text-sm outline-none focus:border-emerald-400" />
      <div className="col-span-2">
        <label className="block text-xs font-medium text-muted-foreground mb-1">OPD Priority Category</label>
        <Pick
          value={form.category}
          onChange={(category) => setForm({ ...form, category })}
          options={PATIENT_CATEGORIES.map((c) => ({ value: c.id, label: c.label }))}
        />
      </div>
      <input placeholder="Known allergies" value={form.allergies} onChange={(e) => setForm({ ...form, allergies: e.target.value })} className="col-span-2 px-3 py-2 rounded-lg bg-foreground/5 border border-border/10 text-sm outline-none focus:border-emerald-400" />
      <input placeholder="Chronic conditions" value={form.chronicConditions} onChange={(e) => setForm({ ...form, chronicConditions: e.target.value })} className="col-span-2 px-3 py-2 rounded-lg bg-foreground/5 border border-border/10 text-sm outline-none focus:border-emerald-400" />
      <div className="col-span-2 flex gap-2">
        <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg bg-foreground/10 text-sm">Cancel</button>
      </div>
    </form>
  );
}

// Longitudinal trend, not just isolated visit notes -- per the plan's
// research. Same lightweight SVG line-chart approach as Analytics.tsx
// (dataviz skill conventions: thin marks, single hue per series, native
// hover tooltips, no chart-library dependency).
function VitalsTrendSection({ points }: { points: VitalsPoint[] }) {
  const weightPoints = points.filter((p) => p.weight != null) as (VitalsPoint & { weight: number })[];
  const bpPoints = points.filter((p) => p.bp) as (VitalsPoint & { bp: { systolic: number; diastolic: number } })[];

  if (weightPoints.length < 2 && bpPoints.length < 2) return null;

  return (
    <div className="grid md:grid-cols-2 gap-4 mb-6">
      {bpPoints.length >= 2 && (
        <div className="p-4 rounded-xl border border-border/10 bg-foreground/[0.02]">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2"><Activity size={12} /> Blood Pressure Trend</div>
          <MiniLineChart series={[
            { label: 'Systolic', color: '#f87171', values: bpPoints.map((p) => ({ date: p.date, value: p.bp.systolic })) },
            { label: 'Diastolic', color: '#60a5fa', values: bpPoints.map((p) => ({ date: p.date, value: p.bp.diastolic })) },
          ]} />
        </div>
      )}
      {weightPoints.length >= 2 && (
        <div className="p-4 rounded-xl border border-border/10 bg-foreground/[0.02]">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2"><Activity size={12} /> Weight Trend</div>
          <MiniLineChart series={[{ label: 'Weight (kg)', color: '#34d399', values: weightPoints.map((p) => ({ date: p.date, value: p.weight })) }]} />
        </div>
      )}
    </div>
  );
}

function MiniLineChart({ series }: { series: { label: string; color: string; values: { date: string; value: number }[] }[] }) {
  const width = 300;
  const height = 100;
  const padding = 20;
  const allValues = series.flatMap((s) => s.values.map((v) => v.value));
  const max = Math.max(...allValues);
  const min = Math.min(...allValues);
  const range = max - min || 1;
  const count = series[0]?.values.length ?? 0;
  const stepX = count > 1 ? (width - padding * 2) / (count - 1) : 0;

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-24" preserveAspectRatio="none">
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="rgba(255,255,255,0.1)" strokeWidth={1} />
        {series.map((s) => {
          const pts = s.values.map((v, i) => ({ x: padding + i * stepX, y: height - padding - ((v.value - min) / range) * (height - padding * 2), ...v }));
          const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
          return (
            <g key={s.label}>
              <path d={path} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              {pts.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={2.5} fill={s.color}>
                  <title>{`${s.label} · ${new Date(p.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}: ${p.value}`}</title>
                </circle>
              ))}
            </g>
          );
        })}
      </svg>
      <div className="flex gap-3 mt-1">
        {series.map((s) => (
          <span key={s.label} className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className="w-2 h-2 rounded-full" style={{ background: s.color }} /> {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
