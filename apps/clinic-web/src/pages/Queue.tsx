import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity, AlertTriangle, CalendarPlus, Check, ChevronLeft, ChevronRight, MoreHorizontal, UserPlus,
} from 'lucide-react';
import { apiFetch, ApiError } from '../lib/api';
import { useClinicAuth } from '../contexts/ClinicAuthContext';
import { CATEGORY_BADGES, VISIT_PRIORITIES, effectivePriority } from '../lib/categories';
import { toDateInput } from '../lib/date';
import {
  describeEstimate, estimateCalls, formatMinutes, minutesBetween, typicalConsultMinutes,
} from '../lib/queue-time';
import { Button } from '../components/Button';
import { DatePicker } from '../components/DatePicker';
import { Pick } from '../components/Field';
import { SegmentedControl } from '../components/SegmentedControl';
import { SkeletonList } from '../components/Skeleton';
import { useToast } from '../components/Toast';
import { WalkInPanel, type WalkInResult } from '../components/WalkIn';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';

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
  priority: string | null;
  vitals: Record<string, string> | null;
  tokenNumber: number | null;
  checkedInAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  doctorId: string | null;
  patient: Patient;
  doctor: Doctor | null;
}

const VITALS_ROLES = new Set(['RECEPTIONIST', 'NURSE', 'DOCTOR', 'ADMIN']);

/** Waiting longer than this is shown in amber: long enough that someone
 *  at the desk should look up and say something to them. */
const LONG_WAIT_MIN = 30;

const time = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
const hasVitals = (a: Appointment) => !!a.vitals && Object.values(a.vitals).some(Boolean);

/*
 * The front desk's screen.
 *
 * One list, in the order the day actually runs: who is with the doctor,
 * who is waiting and for how long, who is booked and not here yet, who
 * has been seen. Every row has one obvious next step. A visit used to be
 * a row with a status pill and up to four buttons of equal weight; the
 * question "what do I do with this person" now has one answer per row.
 *
 * Tokens are given at check-in and are what is said out loud and shown
 * on the waiting-room screen. Waiting time runs from check-in. The
 * estimate is made from today's own consultations and is not shown until
 * there are three to go on.
 */
export function Queue() {
  const { user, canWriteClinical } = useClinicAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [appointments, setAppointments] = useState<Appointment[] | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [doctorFilter, setDoctorFilter] = useState('');
  const [view, setView] = useState<'list' | 'plan'>('list');
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<'walkin' | 'book' | null>(null);
  const [vitalsFor, setVitalsFor] = useState<Appointment | null>(null);
  const [viewDate, setViewDate] = useState(toDateInput(new Date()));
  const [now, setNow] = useState(() => Date.now());

  const isToday = viewDate === toDateInput(new Date());
  const canRecordVitals = !!user && VITALS_ROLES.has(user.role);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ date: viewDate });
      if (doctorFilter) params.set('doctorId', doctorFilter);
      const res = await apiFetch<{ data: Appointment[] }>(`/appointments?${params.toString()}`);
      setAppointments(res.data);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load the queue.');
    }
  }, [viewDate, doctorFilter]);

  useEffect(() => {
    setAppointments(null);
    load();
  }, [load]);

  useEffect(() => {
    apiFetch<{ data: Doctor[] }>('/doctors').then((res) => setDoctors(res.data)).catch(() => {});
  }, []);

  // The doctor moves people along from another room, so today's list
  // refreshes itself, and the minutes tick. Paused in a background tab.
  useEffect(() => {
    if (!isToday) return;
    const id = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      setNow(Date.now());
      load();
    }, 30_000);
    return () => clearInterval(id);
  }, [isToday, load]);

  const shiftDay = (days: number) => {
    const d = new Date(`${viewDate}T12:00:00`);
    d.setDate(d.getDate() + days);
    setViewDate(toDateInput(d));
  };

  const setStatus = async (appt: Appointment, status: string, done?: string) => {
    try {
      const updated = await apiFetch<Appointment>(`/appointments/${appt.id}`, { method: 'PATCH', data: { status } });
      if (done) toast.success(done.replace('{token}', updated.tokenNumber ? `Token ${updated.tokenNumber}` : appt.patient.name));
      await load();
      return updated;
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not update this visit.');
      return null;
    }
  };

  const callIn = async (appt: Appointment) => {
    const updated = await setStatus(appt, 'IN_PROGRESS');
    if (updated && canWriteClinical) navigate(`/appointments/${appt.id}/encounter`);
  };

  const onWalkIn = async (r: WalkInResult) => {
    setPanel(null);
    const who = r.doctor ? ` Waiting for Dr. ${r.doctor.name}.` : '';
    toast.success(`${r.tokenNumber ? `Token ${r.tokenNumber}: ` : ''}${r.patient.name} checked in.${r.matchedBooking ? ' Their booking for today was used.' : ''}${who}`);
    setViewDate(toDateInput(new Date()));
    await load();
  };

  // ── The day, sorted into what happens next ──────────────────────────
  const groups = useMemo(() => {
    const list = appointments ?? [];
    const inRoom = list.filter((a) => a.status === 'IN_PROGRESS');
    const waiting = list.filter((a) => a.status === 'CHECKED_IN');
    const booked = list
      .filter((a) => a.status === 'SCHEDULED')
      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
    const seen = list
      .filter((a) => a.status === 'COMPLETED')
      .sort((a, b) => (b.completedAt ?? b.scheduledAt).localeCompare(a.completedAt ?? a.scheduledAt));
    const gone = list.filter((a) => a.status === 'CANCELLED' || a.status === 'NO_SHOW');

    // Place in line, per doctor: with two doctors there are two lines,
    // and "4th in line" beside "called next" read as a contradiction.
    const place = new Map<string, number>();
    const seenPerDoctor = new Map<string, number>();
    for (const a of waiting) {
      const k = a.doctorId ?? '';
      const n = (seenPerDoctor.get(k) ?? 0) + 1;
      seenPerDoctor.set(k, n);
      place.set(a.id, n);
    }

    // Someone with a booking who is already here on another visit today
    // -- typically a walk-in made before anyone noticed the booking.
    const here = new Map<string, number | null>();
    for (const a of [...inRoom, ...waiting, ...seen]) here.set(a.patient.id, a.tokenNumber);

    return { inRoom, waiting, booked, seen, gone, place, here };
  }, [appointments]);

  const typical = useMemo(() => (isToday ? typicalConsultMinutes(appointments ?? []) : null), [appointments, isToday]);
  const estimates = useMemo(
    () => (isToday ? estimateCalls(groups.waiting, groups.inRoom, typical, now) : new Map<string, number>()),
    [groups, typical, now, isToday],
  );

  const dateLabel = new Date(`${viewDate}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
  const loaded = appointments !== null;
  const empty = loaded && appointments.length === 0;

  const rowProps = { now, isToday, canWriteClinical, canRecordVitals, estimates, setStatus, callIn, onVitals: setVitalsFor, navigate };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-[1280px]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1>Queue</h1>
          <p className="mt-2 text-[15px] text-muted-foreground">{dateLabel}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="primary" icon={<UserPlus size={15} />} onClick={() => setPanel(panel === 'walkin' ? null : 'walkin')} aria-expanded={panel === 'walkin'}>
            Walk-in
          </Button>
          <Button variant="secondary" icon={<CalendarPlus size={15} />} onClick={() => setPanel(panel === 'book' ? null : 'book')} aria-expanded={panel === 'book'}>
            Book for later
          </Button>
        </div>
      </div>

      <div className="mt-5 mb-5 flex flex-wrap items-center gap-2">
        <button onClick={() => shiftDay(-1)} className="rounded-md p-2 text-foreground/75 hover:bg-foreground/[0.06]" aria-label="Previous day">
          <ChevronLeft size={16} />
        </button>
        <DatePicker value={viewDate} onChange={(iso) => iso && setViewDate(iso)} label="Show the queue for this day" className="min-w-[9.5rem]" />
        <button onClick={() => shiftDay(1)} className="rounded-md p-2 text-foreground/75 hover:bg-foreground/[0.06]" aria-label="Next day">
          <ChevronRight size={16} />
        </button>
        {!isToday && (
          <button onClick={() => setViewDate(toDateInput(new Date()))} className="rounded-md px-3 py-1.5 text-[13px] font-medium hover:bg-foreground/[0.06]">
            Back to today
          </button>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {doctors.length > 3 && (
            <Pick
              value={doctorFilter}
              onChange={setDoctorFilter}
              emptyLabel="All doctors"
              options={doctors.map((d) => ({ value: d.id, label: `Dr. ${d.name}` }))}
              triggerClassName="min-w-[12rem]"
            />
          )}
          {doctors.length > 1 && doctors.length <= 3 && (
            <SegmentedControl
              label="Show one doctor's patients"
              value={doctorFilter}
              onChange={setDoctorFilter}
              options={[{ value: '', label: 'All doctors' }, ...doctors.map((d) => ({ value: d.id, label: `Dr. ${d.name}` }))]}
            />
          )}
          <SegmentedControl
            label="How to show the day"
            value={view}
            onChange={setView}
            options={[{ value: 'list', label: 'Queue' }, { value: 'plan', label: 'Day plan' }]}
          />
        </div>
      </div>

      {panel === 'walkin' && (
        <WalkInPanel
          doctors={doctors}
          defaultDoctorId={doctorFilter || (doctors.length === 1 ? doctors[0]!.id : '')}
          onDone={onWalkIn}
          onClose={() => setPanel(null)}
        />
      )}
      {panel === 'book' && (
        <BookPanel
          doctors={doctors}
          defaultDate={viewDate}
          defaultDoctorId={doctorFilter}
          onClose={() => setPanel(null)}
          onBooked={async (day, name) => {
            setPanel(null);
            toast.success(`${name} is booked.`);
            setViewDate(day);
            await load();
          }}
        />
      )}

      {vitalsFor && (
        <VitalsPanel appointment={vitalsFor} onClose={() => setVitalsFor(null)} onSaved={() => { setVitalsFor(null); toast.success('Vitals saved.'); load(); }} />
      )}

      {error && <div role="alert" className="mb-4 rounded-lg tone-danger px-3 py-2 text-sm">{error}</div>}

      {!loaded && !error && <SkeletonList rows={6} label="Loading the queue" />}

      {loaded && !empty && <DaySummary groups={groups} typical={typical} isToday={isToday} />}

      {empty && (
        <div className="rounded-xl border border-dashed border-border/25 px-6 py-12 text-center">
          <p className="text-[16px] font-semibold">{isToday ? 'No one in the queue yet.' : 'Nothing booked for this day.'}</p>
          <p className="mt-1 text-[14px] text-muted-foreground">
            {isToday ? 'When a patient arrives, press Walk-in and type their name or phone number.' : 'Use Book for later to add an appointment.'}
          </p>
        </div>
      )}

      {loaded && !empty && view === 'plan' && <DayPlan appointments={appointments} doctors={doctorFilter ? doctors.filter((d) => d.id === doctorFilter) : doctors} />}

      {loaded && !empty && view === 'list' && (
        <div className="space-y-7">
          <Section title="With the doctor" count={groups.inRoom.length} hideWhenEmpty>
            {groups.inRoom.map((a) => <VisitRow key={a.id} appt={a} stage="room" {...rowProps} />)}
          </Section>
          <Section
            title="Waiting"
            count={groups.waiting.length}
            note={groups.waiting.length > 1 ? 'In the order they will be called: emergencies first, then pregnant and senior patients, then children.' : undefined}
            hideWhenEmpty={!isToday}
            emptyText="No one is waiting."
          >
            {groups.waiting.map((a) => <VisitRow key={a.id} appt={a} stage="waiting" place={groups.place.get(a.id)} {...rowProps} />)}
          </Section>
          <Section title={isToday ? 'Booked, not here yet' : 'Booked'} count={groups.booked.length} hideWhenEmpty>
            {groups.booked.map((a) => (
              <VisitRow key={a.id} appt={a} stage="booked" alreadyHere={groups.here.has(a.patient.id) ? groups.here.get(a.patient.id) ?? 0 : undefined} {...rowProps} />
            ))}
          </Section>
          <Section title="Seen" count={groups.seen.length} hideWhenEmpty>
            {groups.seen.map((a) => <VisitRow key={a.id} appt={a} stage="seen" {...rowProps} />)}
          </Section>
          {groups.gone.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer select-none text-[15px] font-semibold text-muted-foreground hover:text-foreground">
                Cancelled or did not come · {groups.gone.length}
              </summary>
              <div className="mt-3 flex flex-col gap-2">
                {groups.gone.map((a) => <VisitRow key={a.id} appt={a} stage="gone" {...rowProps} />)}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

// ── The day in one sentence ───────────────────────────────────────────

function DaySummary({ groups, typical, isToday }: {
  groups: { inRoom: Appointment[]; waiting: Appointment[]; booked: Appointment[]; seen: Appointment[] };
  typical: number | null;
  isToday: boolean;
}) {
  const parts: string[] = [];
  if (isToday) {
    parts.push(`${groups.waiting.length} waiting`);
    if (groups.inRoom.length) parts.push(`${groups.inRoom.length} with the doctor`);
    parts.push(`${groups.seen.length} seen`);
    if (groups.booked.length) parts.push(`${groups.booked.length} still to arrive`);
  } else {
    parts.push(`${groups.booked.length + groups.waiting.length + groups.inRoom.length + groups.seen.length} appointments`);
    if (groups.seen.length) parts.push(`${groups.seen.length} seen`);
  }
  return (
    <p className="mb-6 text-[15px] text-muted-foreground">
      <span className="font-medium text-foreground">{parts.join(' · ')}</span>
      {typical != null && <> · a consultation takes about {formatMinutes(typical)} today</>}
    </p>
  );
}

function Section({ title, count, note, hideWhenEmpty, emptyText, children }: {
  title: string;
  count: number;
  note?: string;
  hideWhenEmpty?: boolean;
  emptyText?: string;
  children: React.ReactNode;
}) {
  if (count === 0 && hideWhenEmpty) return null;
  return (
    <section>
      <div className="mb-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-[16px] font-semibold">
          {title} <span className="font-normal text-muted-foreground">· {count}</span>
        </h2>
        {note && <p className="text-[13px] text-muted-foreground">{note}</p>}
      </div>
      {count === 0 ? (
        <p className="rounded-xl border border-dashed border-border/20 px-4 py-4 text-[14px] text-muted-foreground">{emptyText}</p>
      ) : (
        <div className="flex flex-col gap-2">{children}</div>
      )}
    </section>
  );
}

// ── One visit ─────────────────────────────────────────────────────────

type Stage = 'room' | 'waiting' | 'booked' | 'seen' | 'gone';

function VisitRow({
  appt, stage, place, alreadyHere, now, isToday, canWriteClinical, canRecordVitals, estimates, setStatus, callIn, onVitals, navigate,
}: {
  appt: Appointment;
  stage: Stage;
  place?: number;
  /** Set on a booking whose patient is already here today: their token, or 0 without one. */
  alreadyHere?: number;
  now: number;
  isToday: boolean;
  canWriteClinical: boolean;
  canRecordVitals: boolean;
  estimates: Map<string, number>;
  setStatus: (a: Appointment, status: string, done?: string) => Promise<Appointment | null>;
  callIn: (a: Appointment) => Promise<void>;
  onVitals: (a: Appointment) => void;
  navigate: (to: string) => void;
}) {
  const p = appt.patient;
  const priority = effectivePriority(appt);
  const badge = CATEGORY_BADGES[priority];
  const emergency = priority === 'EMERGENCY' && (stage === 'waiting' || stage === 'room');

  // What the right-hand column says about time.
  let timing: React.ReactNode = null;
  if (stage === 'waiting' && appt.checkedInAt) {
    const waited = minutesBetween(appt.checkedInAt, now);
    const est = estimates.get(appt.id);
    timing = (
      <>
        <span className={waited >= LONG_WAIT_MIN ? 'font-semibold text-ink-warning' : 'font-medium text-foreground'}>
          {waited < 1 ? 'Just arrived' : `Waiting ${formatMinutes(waited)}`}
        </span>
        {est !== undefined && <span className="text-muted-foreground">Called {describeEstimate(est)}</span>}
      </>
    );
  } else if (stage === 'room' && appt.startedAt) {
    timing = <span className="font-medium text-foreground">In for {formatMinutes(minutesBetween(appt.startedAt, now))}</span>;
  } else if (stage === 'booked' && alreadyHere !== undefined) {
    timing = <span className="font-medium text-foreground">Already here{alreadyHere ? ` · token ${alreadyHere}` : ''}</span>;
  } else if (stage === 'booked') {
    const late = isToday && new Date(appt.scheduledAt).getTime() < now - 15 * 60_000;
    timing = <span className={late ? 'font-medium text-ink-warning' : 'text-muted-foreground'}>{late ? `Was due at ${time(appt.scheduledAt)}` : `Due ${time(appt.scheduledAt)}`}</span>;
  } else if (stage === 'seen') {
    timing = (
      <span className="text-muted-foreground">
        {appt.completedAt ? `Done ${time(appt.completedAt)}` : 'Done'}
        {appt.startedAt && appt.completedAt ? ` · ${formatMinutes(minutesBetween(appt.startedAt, new Date(appt.completedAt)))}` : ''}
      </span>
    );
  } else if (stage === 'gone') {
    timing = <span className="text-muted-foreground">{appt.status === 'NO_SHOW' ? 'Did not come' : 'Cancelled'}</span>;
  }

  // The one thing to do next, and the rest behind a menu.
  let primary: React.ReactNode = null;
  const menu: { label: string; run: () => unknown; danger?: boolean }[] = [];
  if (stage === 'waiting') {
    // The strong button only on whoever is first in their doctor's line:
    // four equal "Call in" buttons say nothing about who is next.
    primary = canWriteClinical
      ? <Button variant={place === 1 ? 'primary' : 'secondary'} size="sm" onClick={() => callIn(appt)} busyLabel="Calling…">Call in</Button>
      : <Button variant="secondary" size="sm" onClick={() => setStatus(appt, 'IN_PROGRESS', '{token} sent in.')}>Send in</Button>;
    menu.push({ label: 'Undo check-in', run: () => setStatus(appt, 'SCHEDULED') });
    menu.push({ label: 'Cancel visit', run: () => setStatus(appt, 'CANCELLED'), danger: true });
  } else if (stage === 'room') {
    primary = canWriteClinical
      ? <Button variant="primary" size="sm" onClick={() => navigate(`/appointments/${appt.id}/encounter`)}>Open</Button>
      : <Button variant="secondary" size="sm" onClick={() => setStatus(appt, 'COMPLETED', '{token} marked done.')}>Mark done</Button>;
    menu.push({ label: 'Back to waiting', run: () => setStatus(appt, 'CHECKED_IN') });
    if (canWriteClinical) menu.push({ label: 'Mark done without notes', run: () => setStatus(appt, 'COMPLETED') });
  } else if (stage === 'booked') {
    primary = isToday && alreadyHere === undefined
      ? <Button variant="secondary" size="sm" icon={<Check size={13} />} onClick={() => setStatus(appt, 'CHECKED_IN', '{token} checked in.')}>Check in</Button>
      : null;
    if (isToday) menu.push({ label: 'Did not come', run: () => setStatus(appt, 'NO_SHOW') });
    menu.push({ label: 'Cancel booking', run: () => setStatus(appt, 'CANCELLED'), danger: true });
  } else if (stage === 'seen') {
    primary = canWriteClinical
      ? <Button variant="ghost" size="sm" onClick={() => navigate(`/appointments/${appt.id}/encounter`)}>View visit</Button>
      : null;
  } else if (stage === 'gone' && isToday) {
    menu.push({ label: 'Book again for today', run: () => setStatus(appt, 'SCHEDULED') });
  }

  const showVitals = canRecordVitals && (stage === 'waiting' || stage === 'booked' || stage === 'room');

  return (
    <div
      className={`relative flex flex-col gap-3 rounded-xl border bg-card px-3 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-4 ${
        emergency ? 'border-ink-danger/40' : 'border-border/15'
      } ${stage === 'gone' ? 'opacity-75' : ''}`}
    >
      {emergency && <span aria-hidden="true" className="absolute inset-y-2 left-0 w-1 rounded-r bg-ink-danger" />}
      <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
        <TokenCell appt={appt} stage={stage} place={place} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link to={`/patients/${p.id}`} className="truncate text-[15px] font-semibold hover:underline underline-offset-4">{p.name}</Link>
            {badge && <span className={`rounded px-1.5 py-0.5 text-[12px] font-semibold ${badge.color}`}>{badge.label}</span>}
            {p.allergies && (
              <span title={`Allergies: ${p.allergies}`} className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[12px] font-medium tone-danger">
                <AlertTriangle size={11} aria-hidden="true" /> Allergy
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
            {[
              p.age != null ? `${p.age}y` : null,
              p.gender,
              appt.doctor ? `Dr. ${appt.doctor.name}` : null,
              appt.reason,
            ].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <div className="flex flex-col text-[13px] leading-snug sm:items-end sm:text-right">{timing}</div>
        <div className="flex shrink-0 items-center gap-1.5">
          {showVitals && (
            <button
              type="button"
              onClick={() => onVitals(appt)}
              className={`inline-flex h-8 items-center gap-1 rounded-md px-2.5 text-[13px] font-medium ${
                hasVitals(appt) ? 'text-ink-success hover:bg-foreground/[0.05]' : 'text-foreground/80 hover:bg-foreground/[0.06]'
              }`}
              title={hasVitals(appt) ? 'Vitals recorded. Edit them.' : 'Record vitals'}
            >
              {hasVitals(appt) ? <Check size={13} aria-hidden="true" /> : <Activity size={13} aria-hidden="true" />} Vitals
            </button>
          )}
          {primary}
          {menu.length > 0 && <RowMenu items={menu} label={`More for ${p.name}`} />}
        </div>
      </div>
    </div>
  );
}

/** The left column: the token for anyone who has arrived, the booked time
 *  for anyone who has not. Both are what reception reads out. */
function TokenCell({ appt, stage, place }: { appt: Appointment; stage: Stage; place?: number }) {
  if (stage === 'booked' || (stage === 'gone' && !appt.tokenNumber)) {
    return (
      <div className="w-14 shrink-0 text-center">
        <p className="font-display text-[19px] font-semibold leading-none tabular-nums">{time(appt.scheduledAt).replace(/\s?[ap]m$/i, '')}</p>
        <p className="mt-1 text-[11px] uppercase tracking-[0.06em] text-muted-foreground">{/pm$/i.test(time(appt.scheduledAt)) ? 'pm' : 'am'}</p>
      </div>
    );
  }
  return (
    <div className={`w-14 shrink-0 rounded-lg py-1.5 text-center ${stage === 'room' ? 'bg-primary text-primary-foreground' : 'bg-accent'}`}>
      <p className="font-display text-[26px] font-semibold leading-none tabular-nums">{appt.tokenNumber ?? '–'}</p>
      <p className={`mt-0.5 text-[11px] ${stage === 'room' ? 'opacity-80' : 'text-muted-foreground'}`}>
        {stage === 'waiting' && place ? `${ordinal(place)} in line` : 'token'}
      </p>
    </div>
  );
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

function RowMenu({ items, label }: { items: { label: string; run: () => unknown; danger?: boolean }[]; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-label={label} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-foreground/70 hover:bg-foreground/[0.06] hover:text-foreground">
          <MoreHorizontal size={16} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-48 p-1">
        {items.map((it) => (
          <button
            key={it.label}
            type="button"
            onClick={() => { setOpen(false); it.run(); }}
            className={`block w-full rounded-md px-3 py-2 text-left text-[14px] hover:bg-accent ${it.danger ? 'text-ink-danger' : ''}`}
          >
            {it.label}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

// ── The day plan: bookings by hour, a column per doctor ───────────────

function DayPlan({ appointments, doctors }: { appointments: Appointment[]; doctors: Doctor[] }) {
  const live = appointments.filter((a) => a.status !== 'CANCELLED');
  const hours = live.map((a) => new Date(a.scheduledAt).getHours());
  const first = Math.min(9, ...hours);
  const last = Math.max(19, ...hours);
  const columns: { id: string; name: string }[] = [
    ...doctors.map((d) => ({ id: d.id, name: `Dr. ${d.name}` })),
    ...(live.some((a) => !a.doctorId) ? [{ id: '', name: 'No doctor chosen' }] : []),
  ];
  const cols = columns.length || 1;
  const tone: Record<string, string> = {
    SCHEDULED: 'bg-card border-border/25',
    CHECKED_IN: 'bg-accent border-border/25',
    IN_PROGRESS: 'bg-primary text-primary-foreground border-transparent',
    COMPLETED: 'bg-card border-border/15 text-muted-foreground',
    NO_SHOW: 'bg-card border-dashed border-border/25 text-muted-foreground line-through',
  };
  const slots = Array.from({ length: last - first + 1 }, (_, i) => first + i);

  return (
    <div className="overflow-x-auto rounded-xl border border-border/15">
      <div className="min-w-[560px]" style={{ display: 'grid', gridTemplateColumns: `64px repeat(${cols}, minmax(180px, 1fr))` }}>
        <div className="sticky left-0 border-b border-border/15 bg-background" />
        {columns.map((c) => (
          <div key={c.id || 'none'} className="border-b border-l border-border/15 bg-background px-3 py-2 text-[13px] font-semibold">{c.name}</div>
        ))}
        {slots.map((h) => (
          <div key={h} className="contents">
            <div className="sticky left-0 border-b border-border/10 bg-background px-2 py-2 text-right text-[12px] tabular-nums text-muted-foreground">
              {new Date(2000, 0, 1, h).toLocaleTimeString('en-IN', { hour: 'numeric' })}
            </div>
            {columns.map((c) => {
              const here = live
                .filter((a) => (a.doctorId ?? '') === c.id && new Date(a.scheduledAt).getHours() === h)
                .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
              return (
                <div key={c.id || 'none'} className="min-h-[52px] space-y-1 border-b border-l border-border/10 p-1.5">
                  {here.map((a) => (
                    <Link
                      key={a.id}
                      to={`/patients/${a.patient.id}`}
                      className={`block rounded-md border px-2 py-1 text-[12.5px] leading-tight hover:opacity-90 ${tone[a.status] ?? 'bg-card border-border/20'}`}
                    >
                      <span className="tabular-nums">{time(a.scheduledAt)}</span>
                      {a.tokenNumber ? <span className="tabular-nums"> · #{a.tokenNumber}</span> : null}
                      <span className="block truncate font-medium">{a.patient.name}</span>
                    </Link>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <p className="border-t border-border/15 px-3 py-2 text-[12.5px] text-muted-foreground">
        Walk-ins appear at the time they arrived. Dark: with the doctor now. Shaded: waiting. Struck through: did not come.
      </p>
    </div>
  );
}

// ── Booking for later ─────────────────────────────────────────────────

interface FoundPatient { id: string; uhid: string; name: string; phone: string | null; category: string }

function BookPanel({ doctors, defaultDate, defaultDoctorId, onClose, onBooked }: {
  doctors: Doctor[];
  defaultDate: string;
  defaultDoctorId: string;
  onClose: () => void;
  onBooked: (day: string, name: string) => void | Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<FoundPatient[]>([]);
  const [chosen, setChosen] = useState<FoundPatient | null>(null);
  const [doctorId, setDoctorId] = useState(defaultDoctorId || (doctors.length === 1 ? doctors[0]!.id : ''));
  const [date, setDate] = useState(defaultDate < toDateInput(new Date()) ? toDateInput(new Date()) : defaultDate);
  const [at, setAt] = useState('');
  const [reason, setReason] = useState('');
  const [priority, setPriority] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (chosen || query.trim().length < 2) { setOptions([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await apiFetch<{ data: FoundPatient[] }>(`/patients?search=${encodeURIComponent(query.trim())}`);
        setOptions(res.data.slice(0, 6));
      } catch { setOptions([]); }
    }, 220);
    return () => clearTimeout(t);
  }, [query, chosen]);

  const usual = chosen?.category ?? 'GENERAL';

  const submit = async () => {
    setError(null);
    if (!chosen) { setError('Choose a patient first.'); return; }
    if (!date) { setError('Pick a day.'); return; }
    if (!at) { setError('Pick a time.'); return; }
    try {
      await apiFetch('/appointments', {
        method: 'POST',
        data: {
          patientId: chosen.id,
          doctorId: doctorId || undefined,
          scheduledAt: new Date(`${date}T${at}:00`).toISOString(),
          reason: reason.trim() || undefined,
          priority: priority ?? undefined,
        },
      });
      await onBooked(date, chosen.name);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not book the appointment.');
    }
  };

  return (
    <section aria-label="Book for later" className="mb-6 rounded-xl border border-border/15 bg-card p-4 sm:p-5 shadow-sm">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-[16px] font-semibold">Book for later</h2>
        <button type="button" onClick={onClose} className="text-[13px] text-muted-foreground hover:text-foreground">Close</button>
      </div>
      <div className="space-y-4">
        <div className="relative space-y-1.5">
          <Label htmlFor="book-patient">Patient</Label>
          {chosen ? (
            <div className="flex items-center justify-between gap-3 rounded-lg bg-accent/60 px-3 py-2">
              <span className="truncate text-[15px] font-medium">{chosen.name} <span className="text-[13px] font-normal text-muted-foreground">· {chosen.uhid}</span></span>
              <button type="button" onClick={() => { setChosen(null); setQuery(''); }} className="text-[13px] text-muted-foreground hover:text-foreground">Change</button>
            </div>
          ) : (
            <>
              <Input id="book-patient" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, phone or file number" autoComplete="off" autoFocus />
              {options.length > 0 && (
                <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border/20 bg-popover shadow-lg">
                  {options.map((p) => (
                    <li key={p.id}>
                      <button type="button" onClick={() => setChosen(p)} className="block w-full px-3 py-2 text-left text-[14px] hover:bg-accent">
                        {p.name} <span className="text-[12.5px] text-muted-foreground">· {p.uhid}{p.phone ? ` · ${p.phone}` : ''}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {query.trim().length >= 2 && options.length === 0 && (
                <p className="text-[13px] text-muted-foreground">No match. <Link to="/patients" className="font-medium text-foreground underline underline-offset-4">Register the patient</Link> first.</p>
              )}
            </>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {doctors.length > 0 && (
            <div className="space-y-1.5">
              <Label>Doctor</Label>
              <Pick value={doctorId} onChange={setDoctorId} emptyLabel="Not decided" options={doctors.map((d) => ({ value: d.id, label: `Dr. ${d.name}` }))} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Day</Label>
            <DatePicker value={date} onChange={(v) => setDate(v ?? '')} label="Appointment day" className="w-full" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="book-time">Time</Label>
            <Input id="book-time" type="time" value={at} onChange={(e) => setAt(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="book-reason">Reason <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <Input id="book-reason" value={reason} onChange={(e) => setReason(e.target.value)} autoComplete="off" />
        </div>
        <div>
          <p className="mb-1.5 text-[13px] font-medium">Priority on the day</p>
          <div className="flex flex-wrap gap-1.5">
            {VISIT_PRIORITIES.map((c) => {
              const on = (priority ?? usual) === c.id;
              return (
                <button key={c.id} type="button" title={c.hint} aria-pressed={on} onClick={() => setPriority(c.id)}
                  className={`rounded-md px-3 py-1.5 text-[13px] font-medium ${on ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}>
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>
        {error && <p role="alert" className="rounded-md tone-danger px-3 py-2 text-[13px]">{error}</p>}
        <Button variant="primary" onClick={submit} busyLabel="Booking…">Book</Button>
      </div>
    </section>
  );
}

// ── Vitals ────────────────────────────────────────────────────────────

const VITAL_FIELDS: { key: 'bp' | 'temp' | 'pulse' | 'spo2' | 'weight'; label: string; hint: string }[] = [
  { key: 'bp', label: 'BP', hint: '120/80' },
  { key: 'pulse', label: 'Pulse', hint: 'per min' },
  { key: 'temp', label: 'Temp', hint: '°F' },
  { key: 'spo2', label: 'SpO₂', hint: '%' },
  { key: 'weight', label: 'Weight', hint: 'kg' },
];

function VitalsPanel({ appointment, onClose, onSaved }: { appointment: Appointment; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    bp: appointment.vitals?.bp || '', temp: appointment.vitals?.temp || '', spo2: appointment.vitals?.spo2 || '',
    weight: appointment.vitals?.weight || '', pulse: appointment.vitals?.pulse || '',
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // One path for the button and for Enter in a field: the form's submit.
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setError(null);
    setSaving(true);
    try {
      await apiFetch(`/appointments/${appointment.id}/vitals`, { method: 'PATCH', data: form });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the vitals.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-label="Vitals" className="mb-6 rounded-xl border border-border/15 bg-card p-4 sm:p-5 shadow-sm">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-[16px] font-semibold">
          Vitals · {appointment.patient.name}
          {appointment.tokenNumber ? <span className="font-normal text-muted-foreground"> · token {appointment.tokenNumber}</span> : null}
        </h2>
        <button type="button" onClick={onClose} className="text-[13px] text-muted-foreground hover:text-foreground">Close</button>
      </div>
      <form onSubmit={submit}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {VITAL_FIELDS.map((f, i) => (
            <div key={f.key} className="space-y-1.5">
              <Label htmlFor={`v-${f.key}`}>{f.label} <span className="font-normal text-muted-foreground">{f.hint}</span></Label>
              <Input id={`v-${f.key}`} autoFocus={i === 0} inputMode={f.key === 'bp' ? 'text' : 'decimal'} value={form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} autoComplete="off" />
            </div>
          ))}
        </div>
        {error && <p role="alert" className="mt-3 rounded-md tone-danger px-3 py-2 text-[13px]">{error}</p>}
        <div className="mt-4 flex gap-2">
          <Button type="submit" variant="primary" busy={saving} busyLabel="Saving…">Save vitals</Button>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </section>
  );
}
