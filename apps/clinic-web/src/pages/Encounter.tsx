import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, FileText, Pill, Award, Download, Paperclip, User, AlertTriangle, History, Activity, Pencil, FlaskConical } from 'lucide-react';
import { SkeletonList, SkeletonTable, SkeletonStats, SkeletonForm, SkeletonPanels } from '../components/Skeleton';
import { apiFetch, openPdf, ApiError } from '../lib/api';
import { useClinicAuth } from '../contexts/ClinicAuthContext';
import { CaseSheetForm, PrescriptionForm, CertificateForm, LabOrderForm } from '../components/ClinicalForms';

interface Vitals { bp?: string; temp?: string; spo2?: string; weight?: string; pulse?: string }
interface Appointment {
  id: string; scheduledAt: string; status: string; reason: string | null;
  vitals: Vitals | null;
  patient: {
    id: string; uhid: string; name: string; age: number | null; gender: string | null; phone: string | null;
    allergies: string | null; chronicConditions: string | null; bloodGroup: string | null;
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
interface LabOrderItemT { id: string; testName: string; resultText: string | null; completedAt: string | null }
interface LabOrder { id: string; status: string; createdAt: string; doctor: Doctor; items: LabOrderItemT[] }
interface PreviousVisit { createdAt: string; diagnosis: string | null; chiefComplaint: string | null; followUpDate: string | null }

const STATUS_FLOW = ['SCHEDULED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED'];
const VITALS_ROLES = new Set(['RECEPTIONIST', 'NURSE', 'DOCTOR', 'ADMIN']);

export function Encounter() {
  const { id } = useParams<{ id: string }>();
  const { user, canWriteClinical } = useClinicAuth();
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [caseSheets, setCaseSheets] = useState<CaseSheet[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [labOrders, setLabOrders] = useState<LabOrder[]>([]);
  const [previousVisit, setPreviousVisit] = useState<PreviousVisit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<'none' | 'caseSheet' | 'prescription' | 'certificate' | 'vitals' | 'labs'>('none');

  const canRecordVitals = user && VITALS_ROLES.has(user.role);

  useEffect(() => {
    load();
  }, [id]);

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
    ? <div className="p-8 text-gray-400">{error}</div>
    : <div className="p-4 sm:p-6 md:p-8 max-w-3xl"><SkeletonPanels count={3} label="Loading the consultation" /></div>;

  const nextStatus = STATUS_FLOW[STATUS_FLOW.indexOf(appointment.status) + 1];
  const hasVitals = appointment.vitals && Object.values(appointment.vitals).some(Boolean);
  const hasSafetyAlert = appointment.patient.allergies || appointment.patient.chronicConditions;

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-3xl">
      <Link to="/queue" className="flex items-center gap-1 text-sm text-gray-400 hover:text-white mb-4"><ArrowLeft size={14} /> Back to queue</Link>

      {/* Patient safety banner -- surfaced first, above the fold, matching
          real EHR allergy-alert conventions (a doctor should never have to
          click away to discover a patient's allergies mid-consult). */}
      {hasSafetyAlert && (
        <div className="mb-4 p-3 rounded-xl border border-red-500/30 bg-red-500/10 flex items-start gap-2">
          <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
          <div className="text-sm text-red-200">
            {appointment.patient.allergies && <div><span className="font-semibold text-red-400">Allergies:</span> {appointment.patient.allergies}</div>}
            {appointment.patient.chronicConditions && <div><span className="font-semibold text-red-400">Chronic conditions:</span> {appointment.patient.chronicConditions}</div>}
          </div>
        </div>
      )}

      <div className="p-4 rounded-xl border border-white/10 bg-white/[0.03] mb-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">{appointment.patient.name}</h1>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-mono font-semibold">{appointment.patient.uhid}</span>
            </div>
            <div className="text-sm text-gray-400 flex flex-wrap gap-3 mt-1">
              {appointment.patient.age != null && <span>{appointment.patient.age}y</span>}
              {appointment.patient.gender && <span>{appointment.patient.gender}</span>}
              {appointment.patient.bloodGroup && <span>{appointment.patient.bloodGroup}</span>}
              {appointment.patient.phone && <span>{appointment.patient.phone}</span>}
              <Link to={`/patients/${appointment.patient.id}`} className="text-emerald-400 hover:underline">Full profile →</Link>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-purple-500/15 text-purple-400 shrink-0">{appointment.status.replace('_', ' ')}</span>
        </div>
        <div className="text-xs text-gray-500 mt-3 flex items-center gap-3 flex-wrap">
          <span>{new Date(appointment.scheduledAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
          {appointment.doctor && <span className="flex items-center gap-1"><User size={11} /> {appointment.doctor.name}</span>}
          {appointment.reason && <span>· {appointment.reason}</span>}
        </div>
        {nextStatus && (
          <button onClick={advanceStatus} className="mt-3 px-3 py-1.5 rounded-lg bg-white/10 text-xs font-medium hover:bg-white/20">
            Mark {nextStatus.replace('_', ' ')}
          </button>
        )}
      </div>

      {/* Vitals -- viewable and editable right here, not just pre-consult
          from the queue, so reception's earlier numbers or the doctor's own
          update are both one click away. */}
      <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 mb-4">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-blue-300"><Activity size={14} /> Vitals</div>
          {canRecordVitals && (
            <button onClick={() => setPanel(panel === 'vitals' ? 'none' : 'vitals')} className="flex items-center gap-1 text-xs text-blue-300 hover:underline">
              <Pencil size={11} /> {hasVitals ? 'Update' : 'Record'}
            </button>
          )}
        </div>
        {panel === 'vitals' ? (
          <VitalsInlineForm appointmentId={appointment.id} vitals={appointment.vitals} onDone={() => { setPanel('none'); load(); }} />
        ) : hasVitals ? (
          <div className="text-xs text-gray-300 flex gap-3 flex-wrap">
            {appointment.vitals?.bp && <span>BP: {appointment.vitals.bp}</span>}
            {appointment.vitals?.temp && <span>Temp: {appointment.vitals.temp}</span>}
            {appointment.vitals?.spo2 && <span>SpO2: {appointment.vitals.spo2}</span>}
            {appointment.vitals?.pulse && <span>Pulse: {appointment.vitals.pulse}</span>}
            {appointment.vitals?.weight && <span>Wt: {appointment.vitals.weight}</span>}
          </div>
        ) : (
          <p className="text-xs text-gray-500">Not recorded yet.</p>
        )}
      </div>

      {/* Continuity of care -- what happened last time, without leaving this screen. */}
      {previousVisit && (
        <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02] mb-6">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2"><History size={12} /> Last Visit</div>
          <div className="text-xs text-gray-500 mb-1">{new Date(previousVisit.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
          {previousVisit.chiefComplaint && <div className="text-sm"><span className="text-gray-400">Complaint:</span> {previousVisit.chiefComplaint}</div>}
          {previousVisit.diagnosis && <div className="text-sm"><span className="text-gray-400">Diagnosis:</span> {previousVisit.diagnosis}</div>}
          {previousVisit.followUpDate && (
            <div className="text-sm text-amber-400 mt-1">Follow-up was due {new Date(previousVisit.followUpDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</div>
          )}
        </div>
      )}

      {error && <div className="mb-4 px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-sm">{error}</div>}

      {canWriteClinical && (
        <div className="flex gap-2 mb-6 flex-wrap">
          <button onClick={() => setPanel(panel === 'caseSheet' ? 'none' : 'caseSheet')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-sm font-medium hover:bg-white/20">
            <FileText size={14} /> Case Sheet
          </button>
          <button onClick={() => setPanel(panel === 'prescription' ? 'none' : 'prescription')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-sm font-medium hover:bg-white/20">
            <Pill size={14} /> Prescription
          </button>
          <button onClick={() => setPanel(panel === 'certificate' ? 'none' : 'certificate')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-sm font-medium hover:bg-white/20">
            <Award size={14} /> Certificate
          </button>
          <button onClick={() => setPanel(panel === 'labs' ? 'none' : 'labs')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-sm font-medium hover:bg-white/20">
            <FlaskConical size={14} /> Order Labs
          </button>
        </div>
      )}

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

      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3 mt-8">This Visit</h2>
      <div className="flex flex-col gap-3">
        {caseSheets.length === 0 && prescriptions.length === 0 && certificates.length === 0 && labOrders.length === 0 && (
          <div className="text-center py-10 text-gray-500 text-sm">Nothing recorded for this visit yet.</div>
        )}
        {labOrders.map((order) => (
          <div key={order.id} className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2"><FlaskConical size={12} /> Lab Order · {order.doctor.name} · {order.status}</div>
            {order.items.map((item) => (
              <div key={item.id} className="text-sm flex items-center gap-2">
                <span>{item.testName}</span>
                {item.completedAt ? <span className="text-emerald-400 text-xs">Result: {item.resultText || 'file uploaded'}</span> : <span className="text-amber-400 text-xs">Pending</span>}
              </div>
            ))}
          </div>
        ))}
        {caseSheets.map((c) => (
          <div key={c.id} className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2"><FileText size={12} /> Case Sheet · {c.doctor.name}</div>
            {c.chiefComplaint && <div className="text-sm mb-1"><span className="text-gray-400">Complaint:</span> {c.chiefComplaint}</div>}
            {c.diagnosis && <div className="text-sm mb-1"><span className="text-gray-400">Diagnosis:</span> {c.diagnosis}</div>}
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
        ))}
        {prescriptions.map((p) => (
          <div key={p.id} className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-xs text-gray-500"><Pill size={12} /> Prescription · {p.doctor.name}</div>
              <button onClick={() => openPdf(`/prescriptions/${p.id}/pdf`)} className="flex items-center gap-1 text-xs text-emerald-400 hover:underline"><Download size={11} /> PDF</button>
            </div>
            {p.items.map((item, i) => (
              <div key={i} className="text-sm"><span className="font-medium">{item.drugName}</span> — {item.dosage}, {item.frequency}, {item.duration}</div>
            ))}
          </div>
        ))}
        {certificates.map((c) => (
          <div key={c.id} className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-xs text-gray-500"><Award size={12} /> {c.type.replace('_', ' ')} · {c.doctor.name}</div>
              <button onClick={() => openPdf(`/certificates/${c.id}/pdf`)} className="flex items-center gap-1 text-xs text-emerald-400 hover:underline"><Download size={11} /> PDF</button>
            </div>
            <p className="text-sm text-gray-300">{c.content}</p>
          </div>
        ))}
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
      {error && <div className="px-2 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-xs">{error}</div>}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
        <input placeholder="BP" value={form.bp} onChange={(e) => setForm({ ...form, bp: e.target.value })} className="px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs outline-none focus:border-blue-400" />
        <input placeholder="Temp" value={form.temp} onChange={(e) => setForm({ ...form, temp: e.target.value })} className="px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs outline-none focus:border-blue-400" />
        <input placeholder="SpO2" value={form.spo2} onChange={(e) => setForm({ ...form, spo2: e.target.value })} className="px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs outline-none focus:border-blue-400" />
        <input placeholder="Weight" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} className="px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs outline-none focus:border-blue-400" />
        <input placeholder="Pulse" value={form.pulse} onChange={(e) => setForm({ ...form, pulse: e.target.value })} className="px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs outline-none focus:border-blue-400" />
      </div>
      <button type="submit" disabled={saving} className="self-start px-3 py-1.5 rounded-lg bg-blue-500 text-white text-xs font-semibold disabled:opacity-50">
        {saving ? 'Saving...' : 'Save Vitals'}
      </button>
    </form>
  );
}
