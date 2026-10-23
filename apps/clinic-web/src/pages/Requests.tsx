import { useCallback, useMemo, useState } from 'react';
import { CalendarCheck, Phone, UserPlus, Link2, X, Clock } from 'lucide-react';
import { Button } from '../components/Button';
import { Card, CardContent } from '../components/ui';
import { DatePicker } from '../components/DatePicker';
import { SkeletonList } from '../components/Skeleton';
import { apiFetch, ApiError } from '../lib/api';
import { usePolling } from '../lib/usePolling';
import { useToast } from '../components/Toast';
import { SegmentedControl } from '../components/SegmentedControl';
import { describeDateInput, todayInput } from '../lib/date';

/**
 * Appointments patients have asked for.
 *
 * ── The screen reception actually works from ────────────────────────
 *
 * A request is a stranger's name, a phone number and a day they would
 * like. Confirming is the step that creates a real patient record and a
 * real appointment, which is why it is not a single button: whoever is at
 * the desk has to decide the time, and has to decide whether this is
 * someone the clinic already has on file.
 *
 * That second decision is deliberately a person's. Matching on a phone
 * number alone would merge two people who share a household handset --
 * and a merged record means a doctor reads one person's history while
 * treating another. So the screen SHOWS the possible match and asks.
 */

type Status = 'NEW' | 'CONFIRMED' | 'DECLINED';

/** A patient this request might already be, as the scorer ranks them. */
interface Match {
  id: string;
  uhid: string;
  name: string;
  phone: string | null;
  visits: number;
  lastSeen: string | null;
  /** 0-100. At or above the near-certain threshold the server links on its own. */
  score: number;
  /** Why it matched, in words, so the decision is informed rather than numeric. */
  reasons: string[];
}

interface Request {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  preferredDate: string | null;
  preferredSlot: string | null;
  reason: string | null;
  status: Status;
  handledByName: string | null;
  handledAt: string | null;
  note: string | null;
  createdAt: string;
  patient: { id: string; uhid: string; name: string } | null;
  appointment: { id: string; scheduledAt: string; status: string } | null;
  /** Attached by the list endpoint for NEW requests. */
  matches?: Match[];
}

const SLOT_LABEL: Record<string, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
};

const REFRESH_MS = 60_000;

export function Requests() {
  const toast = useToast();
  const [status, setStatus] = useState<Status>('NEW');
  const [data, setData] = useState<{ requests: Request[]; newCount: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await apiFetch<{ requests: Request[]; newCount: number }>(
        `/appointment-requests?status=${status}`,
      ));
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load the requests.');
    }
  }, [status]);

  // Pauses while the tab is hidden and refreshes on return -- the front
  // desk leaves this open all day.
  usePolling(load, REFRESH_MS);

  const requests = data?.requests ?? [];

  return (
    <div className="max-w-[1600px] p-4 sm:p-6 md:p-8">
      <h1 className="text-xl font-semibold tracking-tight">Appointment requests</h1>
      <p className="mt-0.5 mb-5 text-sm text-muted-foreground">
        Patients who asked through the website. Nothing is in the diary until you
        confirm it here.
      </p>

      <SegmentedControl
        label="Which requests"
        className="mb-5"
        value={status}
        onChange={(v) => { setStatus(v); setData(null); setOpen(null); }}
        options={[
          { value: 'NEW', label: data ? `To handle (${data.newCount})` : 'To handle' },
          { value: 'CONFIRMED', label: 'Confirmed' },
          { value: 'DECLINED', label: 'Declined' },
        ]}
      />

      {error && (
        <Card className="mb-4">
          <CardContent className="p-4 text-sm text-ink-danger">{error}</CardContent>
        </Card>
      )}

      {!data ? (
        <SkeletonList rows={3} label="Loading requests" />
      ) : requests.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="font-medium">
              {status === 'NEW' ? 'No requests waiting.' : `Nothing ${status.toLowerCase()} yet.`}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {status === 'NEW'
                ? 'Requests from the website appear here as soon as they arrive.'
                : 'Requests you have handled will be listed here.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {requests.map((r) => (
            <RequestRow
              key={r.id}
              request={r}
              expanded={open === r.id}
              onToggle={() => setOpen((o) => (o === r.id ? null : r.id))}
              onDone={(message) => { toast.success(message); void load(); setOpen(null); }}
              onError={(m) => toast.error(m)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function RequestRow({
  request: r, expanded, onToggle, onDone, onError,
}: {
  request: Request;
  expanded: boolean;
  onToggle: () => void;
  onDone: (message: string) => void;
  onError: (message: string) => void;
}) {
  const waiting = useMemo(() => {
    const hours = (Date.now() - new Date(r.createdAt).getTime()) / 3_600_000;
    if (hours < 1) return 'just now';
    if (hours < 24) return `${Math.round(hours)}h ago`;
    return `${Math.round(hours / 24)}d ago`;
  }, [r.createdAt]);

  const isNew = r.status === 'NEW';

  return (
    <li>
      <Card variant={isNew ? 'panel' : 'subtle'}>
        <CardContent size="md" className="pt-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{r.name}</span>
                {/* A request older than a day is the one that needs doing,
                    and "2d ago" says that more plainly than a date does. */}
                <span className="tone-neutral flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium">
                  <Clock size={10} aria-hidden /> {waiting}
                </span>
                {r.status === 'CONFIRMED' && (
                  <span className="tone-success rounded-full px-2 py-0.5 text-[11px] font-medium">Confirmed</span>
                )}
                {r.status === 'DECLINED' && (
                  <span className="tone-neutral rounded-full px-2 py-0.5 text-[11px] font-medium">Declined</span>
                )}
              </div>

              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <a href={`tel:${r.phone}`} className="flex items-center gap-1.5 text-primary hover:underline">
                  <Phone size={12} aria-hidden /> {r.phone}
                </a>
                {r.preferredDate && (
                  <span>
                    Asked for {describeDateInput(r.preferredDate.slice(0, 10))}
                    {r.preferredSlot && `, ${SLOT_LABEL[r.preferredSlot] ?? r.preferredSlot}`}
                  </span>
                )}
                {!r.preferredDate && r.preferredSlot && <span>{SLOT_LABEL[r.preferredSlot]}</span>}
              </div>

              {r.reason && <p className="mt-2 max-w-prose text-sm">{r.reason}</p>}

              {r.patient && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Became <span className="font-medium text-foreground">{r.patient.name}</span>{' '}
                  ({r.patient.uhid})
                  {r.appointment && ` · ${new Date(r.appointment.scheduledAt).toLocaleString()}`}
                </p>
              )}
              {!isNew && r.handledByName && (
                <p className="mt-1 text-xs text-muted-foreground/70">
                  Handled by {r.handledByName}
                  {r.handledAt && ` on ${new Date(r.handledAt).toLocaleDateString()}`}
                  {r.note && ` — ${r.note}`}
                </p>
              )}
            </div>

            {isNew && (
              <Button size="sm" variant={expanded ? 'ghost' : 'default'} onClick={onToggle}>
                {expanded ? 'Close' : 'Handle this'}
              </Button>
            )}
          </div>

          {isNew && expanded && <HandlePanel request={r} onDone={onDone} onError={onError} />}
        </CardContent>
      </Card>
    </li>
  );
}

/**
 * Confirming or declining.
 *
 * Candidates arrive with the request rather than being fetched when this
 * opens: a second round-trip behind a click is a round-trip that gets
 * skipped when the waiting room is full, and then a duplicate is created.
 *
 * Three outcomes, not two. Reception can link to a named patient, insist on
 * a new record, or leave it -- and leaving it lets the server link only when
 * the match is near-certain. That default is the point: the old one was
 * "register as new", which is how a returning patient became a second
 * record with an empty history.
 */
function HandlePanel({
  request: r, onDone, onError,
}: {
  request: Request;
  onDone: (m: string) => void;
  onError: (m: string) => void;
}) {
  const [date, setDate] = useState(r.preferredDate ? r.preferredDate.slice(0, 10) : todayInput());
  const [time, setTime] = useState(defaultTime(r.preferredSlot));
  const [note, setNote] = useState('');
  const [declining, setDeclining] = useState(false);

  const matches = r.matches ?? [];
  // Matches this strong are what the server acts on by itself. Kept in step
  // with NEAR_CERTAIN_SCORE in lib/patient-duplicates.ts.
  const NEAR_CERTAIN = 85;
  const certain = matches.find((m) => m.score >= NEAR_CERTAIN) ?? null;
  const ambiguous = matches.filter((m) => m.score >= NEAR_CERTAIN).length > 1;
  const willAutoLink = certain !== null && !ambiguous;

  /**
   * `null` means "leave it to the match", which is the default and is not
   * the same as "register as new" -- that is `'new'`, and it is a decision
   * somebody has to make on purpose.
   */
  const [choice, setChoice] = useState<string | 'new' | null>(null);

  const confirm = async () => {
    if (!date) { onError('Pick the day you are seeing them.'); return; }
    try {
      await apiFetch(`/appointment-requests/${r.id}/confirm`, {
        method: 'POST',
        data: {
          // Local time, assembled from the two fields. A date-only string
          // would be parsed as UTC midnight and land on the previous day
          // in IST -- the trap lib/date exists to avoid.
          scheduledAt: new Date(`${date}T${time || '10:00'}:00`).toISOString(),
          ...(choice && choice !== 'new' ? { patientId: choice } : {}),
          ...(choice === 'new' ? { createNewPatient: true } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
        },
      });
      const linkedName = choice && choice !== 'new'
        ? matches.find((m) => m.id === choice)?.name
        : choice === null && willAutoLink
          ? certain?.name
          : null;
      onDone(
        linkedName
          ? `Booked for ${linkedName}, who was already a patient here.`
          : 'Patient registered and booked.',
      );
    } catch (e) {
      onError(e instanceof ApiError ? e.message : 'Could not confirm this request.');
    }
  };

  const decline = async () => {
    try {
      await apiFetch(`/appointment-requests/${r.id}/decline`, {
        method: 'POST',
        data: note.trim() ? { note: note.trim() } : {},
      });
      onDone('Request declined.');
    } catch (e) {
      onError(e instanceof ApiError ? e.message : 'Could not decline this request.');
    }
  };

  return (
    <div className="mt-4 border-t border-border/10 pt-4">
      {matches.length > 0 ? (
        <div className="tone-info tone-block mb-4 rounded-lg p-3">
          {willAutoLink && choice === null ? (
            <>
              <p className="text-xs font-medium">
                Already a patient here — this will use {certain!.name}&apos;s record ({certain!.uhid}).
              </p>
              <p className="mt-1 text-[11px] leading-relaxed opacity-90">
                {certain!.reasons.join('; ')}. No new record will be created, so their history
                stays in one place. If this is a different person, say so below.
              </p>
            </>
          ) : (
            <>
              <p className="text-xs font-medium">
                {matches.length === 1
                  ? 'This may already be a patient here.'
                  : `${matches.length} patient records look like this person.`}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed opacity-90">
                {ambiguous
                  ? 'More than one is a close match, so nobody can pick for you — families share a phone, and a wrong link puts two people’s history in one file.'
                  : 'Link it if it is the same person. If a family shares this phone, register them as new instead — a merged record means a doctor reads the wrong history.'}
              </p>
            </>
          )}

          <div className="mt-2 flex flex-wrap gap-1.5">
            {matches.map((m) => {
              const selected = choice === m.id || (choice === null && willAutoLink && m.id === certain!.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setChoice((v) => (v === m.id ? null : m.id))}
                  title={m.reasons.join('; ')}
                  className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium transition-colors ${
                    selected ? 'bg-primary text-primary-foreground' : 'bg-foreground/10 hover:bg-foreground/20'
                  }`}
                >
                  <Link2 size={10} aria-hidden /> {m.name} · {m.uhid}
                  {/* The score and the visit count, because "which of these
                      is the real record" is answered by how much history
                      each one carries, not by the name. */}
                  <span className="opacity-70">
                    {m.score}%{m.visits > 0 ? ` · ${m.visits} visit${m.visits === 1 ? '' : 's'}` : ' · no visits'}
                  </span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setChoice('new')}
              className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium transition-colors ${
                choice === 'new' ? 'bg-primary text-primary-foreground' : 'bg-foreground/10 hover:bg-foreground/20'
              }`}
            >
              <UserPlus size={10} aria-hidden /> {willAutoLink ? 'No — different person' : 'Register as new'}
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <span className="mb-1 block text-xs text-muted-foreground">Day</span>
          <DatePicker value={date} onChange={setDate} min={todayInput()} label="Appointment day" />
        </div>
        <div>
          <span className="mb-1 block text-xs text-muted-foreground">Time</span>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="rounded-lg border border-border/10 bg-foreground/5 px-2.5 py-2 text-xs outline-none transition-colors focus-visible:border-primary"
          />
        </div>
        <div className="min-w-[180px] flex-1">
          <span className="mb-1 block text-xs text-muted-foreground">
            Note {declining ? '(why you are declining)' : '(optional)'}
          </span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded-lg border border-border/10 bg-foreground/5 px-2.5 py-2 text-xs outline-none transition-colors focus-visible:border-primary"
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" icon={<CalendarCheck size={13} />} onClick={confirm}>
          Confirm and book
        </Button>
        <Button
          size="sm"
          variant="ghost"
          icon={<X size={13} />}
          onClick={() => (declining ? decline() : setDeclining(true))}
        >
          {declining ? 'Yes, decline it' : 'Decline'}
        </Button>
        <p className="text-[11px] text-muted-foreground">
          Confirming books the appointment. It does not message the patient — the clinic
          has no SMS, so call them on the number above.
        </p>
      </div>
    </div>
  );
}

/** A sensible hour for the window they asked for, so the commonest case is
 *  one tap rather than a time to type. */
function defaultTime(slot: string | null): string {
  if (slot === 'afternoon') return '14:00';
  if (slot === 'evening') return '18:00';
  return '10:00';
}
