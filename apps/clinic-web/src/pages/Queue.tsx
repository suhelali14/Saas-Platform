import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Clock, Phone, Stethoscope, Activity, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { apiFetch, ApiError } from '../lib/api';
import { useClinicAuth } from '../contexts/ClinicAuthContext';
import { CATEGORY_BADGES, VISIT_PRIORITIES, effectivePriority } from '../lib/categories';
import { Pick } from '../components/Field';
import { SegmentedControl } from '../components/SegmentedControl';

import { DatePicker } from '../components/DatePicker';
// The local-vs-UTC rule used to live here as a private helper, with the
// same explanation copy-pasted into Expenses.tsx. One copy now, in
// lib/date, so the next screen cannot reach a different answer -- which
// Analytics.tsx already had.
import { toDateInput, todayInput } from '../lib/date';

interface Patient {
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

interface Appointment {
  id: string;
  scheduledAt: string;
  status: string;
  reason: string | null;
  vitals: Record<string, string> | null;
  patient: Patient;
  doctor: Doctor | null;
}

const STATUS_COLORS: Record<string, string> = {
  SCHEDULED: 'tone-warning',
  CHECKED_IN: 'tone-info',
  IN_PROGRESS: 'tone-violet',
  COMPLETED: 'tone-success',
  CANCELLED: 'tone-neutral',
  NO_SHOW: 'tone-danger',
};

const NEXT_STATUS: Record<string, string | null> = {
  SCHEDULED: 'CHECKED_IN',
  CHECKED_IN: 'IN_PROGRESS',
  IN_PROGRESS: 'COMPLETED',
  COMPLETED: null,
  CANCELLED: null,
  NO_SHOW: null,
};

const VITALS_ROLES = new Set(['RECEPTIONIST', 'NURSE', 'DOCTOR', 'ADMIN']);

export function Queue() {
  const { user } = useClinicAuth();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [doctorFilter, setDoctorFilter] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showBook, setShowBook] = useState(false);
  const [vitalsFor, setVitalsFor] = useState<Appointment | null>(null);

  const [patientQuery, setPatientQuery] = useState('');
  const [patientOptions, setPatientOptions] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [bookDoctorId, setBookDoctorId] = useState('');
  const [bookDate, setBookDate] = useState(toDateInput(new Date()));
  const [time, setTime] = useState('');
  const [reason, setReason] = useState('');
  // Null means "whatever is usual for this patient". Set only when today
  // differs, so a senior citizen keeps their place without reception
  // restating it and an emergency applies to this visit alone.
  const [priority, setPriority] = useState<string | null>(null);
  // The chosen patient's usual case, which is what the control starts on.
  const usualPriority =
    patientOptions.find((p) => p.id === selectedPatientId)?.category ?? 'GENERAL';
  const [booking, setBooking] = useState(false);

  // Which day's queue is on screen. The backend already accepted ?date=;
  // the frontend just never sent it, so the queue was permanently stuck on
  // today and future follow-ups were invisible after booking.
  const [viewDate, setViewDate] = useState(toDateInput(new Date()));

  const canRecordVitals = user && VITALS_ROLES.has(user.role);
  const isToday = viewDate === toDateInput(new Date());

  useEffect(() => {
    load();
    apiFetch<{ data: Doctor[] }>('/doctors').then((res) => setDoctors(res.data)).catch(() => {});
  }, [doctorFilter, viewDate]);

  const load = async () => {
    try {
      const params = new URLSearchParams({ date: viewDate });
      if (doctorFilter) params.set('doctorId', doctorFilter);
      const res = await apiFetch<{ data: Appointment[] }>(`/appointments?${params.toString()}`);
      setAppointments(res.data);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load the queue.');
    }
  };

  const shiftDay = (days: number) => {
    const d = new Date(`${viewDate}T12:00:00`);
    d.setDate(d.getDate() + days);
    setViewDate(toDateInput(d));
  };

  useEffect(() => {
    if (patientQuery.length < 2) {
      setPatientOptions([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await apiFetch<{ data: Patient[] }>(`/patients?search=${encodeURIComponent(patientQuery)}`);
        setPatientOptions(res.data);
      } catch {
        // ignore -- suggestion list just stays empty
      }
    }, 250);
    return () => clearTimeout(t);
  }, [patientQuery]);

  const bookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    // Said, not silent. This used to `return` with no message, so a
    // missing time looked like a broken button -- and now that the date
    // is a custom control rather than a native input, nothing else
    // enforces it either.
    if (!selectedPatientId) {
      setError('Choose a patient first.');
      return;
    }
    if (!bookDate) {
      setError('Pick a date for the appointment.');
      return;
    }
    if (!time) {
      setError('Pick a time for the appointment.');
      return;
    }
    setBooking(true);
    setError(null);
    try {
      // Was hardcoded to `new Date()` -- a follow-up for next week was
      // impossible to book, which quietly broke the whole reminder flow
      // that depends on future follow-up dates.
      const scheduled = new Date(`${bookDate}T${time}:00`);
      await apiFetch('/appointments', {
        method: 'POST',
        data: {
          patientId: selectedPatientId,
          doctorId: bookDoctorId || undefined,
          scheduledAt: scheduled.toISOString(),
          reason: reason || undefined,
          priority: priority ?? undefined,
        },
      });
      setShowBook(false);
      setPatientQuery('');
      setSelectedPatientId('');
      setBookDoctorId('');
      setTime('');
      setReason('');
      setPriority(null);
      // Jump the view to the day we just booked into, so a future booking
      // doesn't look like it silently failed.
      setViewDate(bookDate);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to book appointment.');
    } finally {
      setBooking(false);
    }
  };

  const advanceStatus = async (appt: Appointment) => {
    const next = NEXT_STATUS[appt.status];
    if (!next) return;
    try {
      await apiFetch(`/appointments/${appt.id}`, { method: 'PATCH', data: { status: next } });
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to update status.');
    }
  };

  const cancelAppointment = async (appt: Appointment) => {
    try {
      await apiFetch(`/appointments/${appt.id}`, { method: 'PATCH', data: { status: 'CANCELLED' } });
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to cancel.');
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-[1600px]">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-semibold tracking-tight">{isToday ? "Today's Queue" : 'Queue'}</h1>
        <button onClick={() => setShowBook((v) => !v)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold">
          <Plus size={14} /> Book Appointment
        </button>
      </div>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <button onClick={() => shiftDay(-1)} className="p-1.5 rounded-lg bg-foreground/5 text-foreground/80 hover:bg-foreground/10" title="Previous day">
          <ChevronLeft size={14} />
        </button>
        <DatePicker
          value={viewDate}
          onChange={(iso) => iso && setViewDate(iso)}
          label="Show the queue for this day"
          className="min-w-[9.5rem]"
        />
        <button onClick={() => shiftDay(1)} className="p-1.5 rounded-lg bg-foreground/5 text-foreground/80 hover:bg-foreground/10" title="Next day">
          <ChevronRight size={14} />
        </button>
        {!isToday && (
          <button onClick={() => setViewDate(toDateInput(new Date()))} className="px-2.5 py-1.5 rounded-lg bg-foreground/10 text-xs font-medium hover:bg-foreground/20">
            Today
          </button>
        )}
        <span className="text-sm text-muted-foreground ml-1">
          {new Date(`${viewDate}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
        </span>
      </div>

      {/* A filter over one list, not tabs over panels -- but it is still
          a set of mutually exclusive choices, so it gets the same
          keyboard contract. Only shown once there is more than one
          doctor to choose between. */}
      {doctors.length > 1 && (
        <SegmentedControl
          label="Filter the queue by doctor"
          className="mb-4"
          value={doctorFilter}
          onChange={setDoctorFilter}
          options={[
            { value: '', label: 'All Doctors' },
            ...doctors.map((d) => ({ value: d.id, label: `Dr. ${d.name}` })),
          ]}
        />
      )}

      {error && <div className="mb-4 px-3 py-2 rounded-lg tone-danger text-sm">{error}</div>}

      {showBook && (
        <form onSubmit={bookAppointment} className="mb-6 p-4 rounded-xl border border-border/10 bg-foreground/[0.03] flex flex-col gap-3">
          <div className="relative">
            <label className="block text-xs font-medium text-muted-foreground mb-1">Patient</label>
            <input
              value={patientQuery}
              onChange={(e) => { setPatientQuery(e.target.value); setSelectedPatientId(''); }}
              placeholder="Type patient name, UHID, or phone..."
              className="w-full px-3 py-2 rounded-lg bg-foreground/5 border border-border/10 text-sm outline-none focus:border-primary"
            />
            {patientOptions.length > 0 && !selectedPatientId && (
              <div className="absolute z-10 mt-1 w-full rounded-lg border border-border/10 bg-[#14171f] max-h-48 overflow-y-auto">
                {patientOptions.map((p) => (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => { setSelectedPatientId(p.id); setPatientQuery(`${p.name} (${p.uhid})`); setPatientOptions([]); }}
                    className="block w-full text-left px-3 py-2 text-sm hover:bg-foreground/5"
                  >
                    {p.name} <span className="text-muted-foreground/70 text-xs">{p.uhid}</span> {p.phone ? `· ${p.phone}` : ''}
                  </button>
                ))}
              </div>
            )}
            {patientQuery.length >= 2 && patientOptions.length === 0 && !selectedPatientId && (
              <p className="text-xs text-muted-foreground/70 mt-1">
                No match. <Link to="/patients" className="text-ink-success underline">Add a new patient</Link> first.
              </p>
            )}
          </div>
          <div className="flex gap-3">
            {doctors.length > 0 && (
              <div className="flex-[2]">
                <label className="block text-xs font-medium text-muted-foreground mb-1">Doctor (optional)</label>
                <Pick
                  value={bookDoctorId}
                  onChange={setBookDoctorId}
                  emptyLabel="Unassigned"
                  options={doctors.map((d) => ({ value: d.id, label: `Dr. ${d.name}` }))}
                />
              </div>
            )}
            <div className="flex-1">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Date</label>
              {/* The native input's `required` does not survive a custom
                  control, so bookAppointment validates it explicitly and
                  says so -- a hidden required attribute is how a form
                  becomes a button that does nothing. */}
              <DatePicker value={bookDate} onChange={setBookDate} label="Appointment date" className="w-full" />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Time</label>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} required className="w-full px-3 py-2 rounded-lg bg-foreground/5 border border-border/10 text-sm outline-none focus:border-primary" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Reason (optional)</label>
            <input value={reason} onChange={(e) => setReason(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-foreground/5 border border-border/10 text-sm outline-none focus:border-primary" />
          </div>

          {/*
            Priority for THIS visit.
            
            It used to be asked once, when the patient was first
            registered, and then every queue sorted on it forever -- so
            somebody who arrived once in an emergency went to the front of
            the line on every routine visit afterwards. It belongs here,
            because this is the moment anyone knows why the patient is
            coming.
            
            Pre-selected from the patient's usual case, so the common
            visit needs no thought and only an unusual one needs a click.
          */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Priority for this visit
            </label>
            <div className="flex flex-wrap gap-1.5">
              {VISIT_PRIORITIES.map((c) => {
                const active = (priority ?? usualPriority) === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    title={c.hint}
                    onClick={() => setPriority(c.id)}
                    aria-pressed={active}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                      active
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-foreground/5 text-foreground/80 hover:bg-foreground/10'
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
            {usualPriority !== 'GENERAL' && priority === null && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                This patient is usually seen as {CATEGORY_BADGES[usualPriority]?.label.toLowerCase()}.
              </p>
            )}
          </div>
          <button type="submit" disabled={!selectedPatientId || !time || booking} className="self-start px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">
            {booking ? 'Booking...' : 'Confirm Booking'}
          </button>
        </form>
      )}

      {vitalsFor && <VitalsPanel appointment={vitalsFor} onClose={() => setVitalsFor(null)} onSaved={() => { setVitalsFor(null); load(); }} />}

      <div className="flex flex-col gap-2">
        {appointments.length === 0 && <div className="text-center py-10 text-muted-foreground/70 text-sm">No appointments today.</div>}
        {appointments.map((appt) => (
          <div key={appt.id} className="flex items-center justify-between p-3.5 rounded-xl border border-border/10 bg-foreground/[0.02]">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 text-xs text-muted-foreground w-14 shrink-0">
                <Clock size={12} />
                {new Date(appt.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <Link to={`/patients/${appt.patient.id}`} className="font-medium text-sm hover:underline">{appt.patient.name}</Link>
                  <span className="text-[10px] text-muted-foreground/70 font-mono">{appt.patient.uhid}</span>
                  {CATEGORY_BADGES[effectivePriority(appt)] && (
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${CATEGORY_BADGES[effectivePriority(appt)]!.color}`}>
                      {CATEGORY_BADGES[effectivePriority(appt)]!.label}
                    </span>
                  )}
                  {appt.patient.allergies && (
                    <span title={`Allergies: ${appt.patient.allergies}`} className="flex items-center gap-0.5 px-1.5 py-0.5 rounded tone-danger text-[10px] font-medium">
                      <AlertTriangle size={9} /> allergy
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground/70 flex items-center gap-2 flex-wrap">
                  {appt.patient.age != null && <span>{appt.patient.age}y</span>}
                  {appt.patient.gender && <span>{appt.patient.gender}</span>}
                  {appt.patient.phone && <span className="flex items-center gap-1"><Phone size={10} />{appt.patient.phone}</span>}
                  {appt.doctor && <span className="flex items-center gap-1"><Stethoscope size={10} />Dr. {appt.doctor.name}</span>}
                  {appt.reason && <span>· {appt.reason}</span>}
                  {appt.vitals && Object.values(appt.vitals).some(Boolean) && (
                    <span className="flex items-center gap-0.5 text-ink-success"><Activity size={10} /> vitals done</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[appt.status]}`}>{appt.status.replace('_', ' ')}</span>
              {canRecordVitals && (appt.status === 'SCHEDULED' || appt.status === 'CHECKED_IN') && (
                <button
                  onClick={() => setVitalsFor(appt)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium ${
                    appt.vitals && Object.values(appt.vitals).some(Boolean)
                      ? 'bg-foreground/10 hover:bg-foreground/20 text-foreground/80'
                      : 'bg-info hover:bg-ink-info/90 text-info-foreground transition-colors'
                  }`}
                >
                  <Activity size={11} /> {appt.vitals && Object.values(appt.vitals).some(Boolean) ? 'Edit Vitals' : 'Record Vitals'}
                </button>
              )}
              {(appt.status === 'CHECKED_IN' || appt.status === 'IN_PROGRESS') && (
                <button onClick={() => navigate(`/appointments/${appt.id}/encounter`)} className="px-2.5 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-semibold">
                  Start Consultation
                </button>
              )}
              {NEXT_STATUS[appt.status] && appt.status === 'SCHEDULED' && (
                <button onClick={() => advanceStatus(appt)} className="px-2.5 py-1 rounded-lg bg-foreground/10 text-xs font-medium hover:bg-foreground/20">
                  Check In
                </button>
              )}
              {(appt.status === 'SCHEDULED' || appt.status === 'CHECKED_IN') && (
                <button onClick={() => cancelAppointment(appt)} className="px-2.5 py-1 rounded-lg text-xs text-muted-foreground hover:bg-foreground/10">
                  Cancel
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function VitalsPanel({ appointment, onClose, onSaved }: { appointment: Appointment; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    bp: appointment.vitals?.bp || '', temp: appointment.vitals?.temp || '', spo2: appointment.vitals?.spo2 || '',
    weight: appointment.vitals?.weight || '', pulse: appointment.vitals?.pulse || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/appointments/${appointment.id}/vitals`, { method: 'PATCH', data: form });
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to save vitals.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="mb-6 p-4 rounded-xl border border-ink-info/30 bg-ink-info/5 flex flex-col gap-3">
      <h3 className="text-sm font-semibold">Record Vitals — {appointment.patient.name}</h3>
      {error && <div className="px-3 py-2 rounded-lg tone-danger text-sm">{error}</div>}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
        <input placeholder="BP" value={form.bp} onChange={(e) => setForm({ ...form, bp: e.target.value })} className="px-2 py-2 rounded-lg bg-foreground/5 border border-border/10 text-xs outline-none focus:border-ink-info" />
        <input placeholder="Temp" value={form.temp} onChange={(e) => setForm({ ...form, temp: e.target.value })} className="px-2 py-2 rounded-lg bg-foreground/5 border border-border/10 text-xs outline-none focus:border-ink-info" />
        <input placeholder="SpO2" value={form.spo2} onChange={(e) => setForm({ ...form, spo2: e.target.value })} className="px-2 py-2 rounded-lg bg-foreground/5 border border-border/10 text-xs outline-none focus:border-ink-info" />
        <input placeholder="Weight" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} className="px-2 py-2 rounded-lg bg-foreground/5 border border-border/10 text-xs outline-none focus:border-ink-info" />
        <input placeholder="Pulse" value={form.pulse} onChange={(e) => setForm({ ...form, pulse: e.target.value })} className="px-2 py-2 rounded-lg bg-foreground/5 border border-border/10 text-xs outline-none focus:border-ink-info" />
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-info text-info-foreground text-sm font-semibold hover:bg-ink-info/90 transition-colors disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Vitals'}
        </button>
        <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-foreground/10 text-sm">Cancel</button>
      </div>
    </form>
  );
}
