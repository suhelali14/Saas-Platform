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
 * The possible existing patient is looked up on open rather than offered
 * blind: the phone number is the only thing to match on, and a match is a
 * hint for a person to confirm, never an automatic link.
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
  const [linkTo, setLinkTo] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [declining, setDeclining] = useState(false);
  const [matches, setMatches] = useState<Array<{ id: string; uhid: string; name: string; phone: string | null }> | null>(null);

  // Looked up once, when the panel opens.
  useMemo(() => {
    apiFetch<{ patients: Array<{ id: string; uhid: string; name: string; phone: string | null }> } | Array<{ id: string; uhid: string; name: string; phone: string | null }>>(
      `/patients?phone=${encodeURIComponent(r.phone)}`,
    )
      .then((res) => setMatches(Array.isArray(res) ? res : (res.patients ?? [])))
      .catch(() => setMatches([]));
    return null;
  }, [r.phone]);

  const confirm = async () => {
    if (!date) { onError('Pick the day you are seeing them.'); return; }
    try {
      await apiFetch(`/appointment-requests/${r.id}/confirm`, {
        method: 'POST',
        body: JSON.stringify({
          // Local time, assembled from the two fields. A date-only string
          // would be parsed as UTC midnight and land on the previous day
          // in IST -- the trap lib/date exists to avoid.
          scheduledAt: new Date(`${date}T${time || '10:00'}:00`).toISOString(),
          ...(linkTo ? { patientId: linkTo } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
        }),
      });
      onDone(linkTo ? 'Booked for the existing patient.' : 'Patient registered and booked.');
    } catch (e) {
      onError(e instanceof ApiError ? e.message : 'Could not confirm this request.');
    }
  };

  const decline = async () => {
    try {
      await apiFetch(`/appointment-requests/${r.id}/decline`, {
        method: 'POST',
        body: JSON.stringify(note.trim() ? { note: note.trim() } : {}),
      });
      onDone('Request declined.');
    } catch (e) {
      onError(e instanceof ApiError ? e.message : 'Could not decline this request.');
    }
  };

  return (
    <div className="mt-4 border-t border-border/10 pt-4">
      {matches === null ? (
        <p className="text-xs text-muted-foreground">Checking whether they are already a patient…</p>
      ) : matches.length > 0 ? (
        <div className="tone-info tone-block mb-4 rounded-lg p-3">
          <p className="text-xs font-medium">
            This number is already on {matches.length === 1 ? 'a patient record' : `${matches.length} patient records`}.
          </p>
          <p className="mt-1 text-[11px] leading-relaxed opacity-90">
            Link the request if it is the same person. If a family shares this phone, register
            them as new instead — a merged record means a doctor reads the wrong history.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {matches.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setLinkTo((v) => (v === m.id ? null : m.id))}
                className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium transition-colors ${
                  linkTo === m.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-foreground/10 hover:bg-foreground/20'
                }`}
              >
                <Link2 size={10} aria-hidden /> {m.name} · {m.uhid}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setLinkTo(null)}
              className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium transition-colors ${
                linkTo === null ? 'bg-primary text-primary-foreground' : 'bg-foreground/10 hover:bg-foreground/20'
              }`}
            >
              <UserPlus size={10} aria-hidden /> Register as new
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
