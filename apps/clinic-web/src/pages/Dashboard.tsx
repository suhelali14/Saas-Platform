import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, Info, RefreshCw, ArrowRight, Activity, Stethoscope,
} from 'lucide-react';
import { apiFetch, ApiError } from '../lib/api';
import { cn } from '@/lib/utils';
import { Button } from '../components/Button';
import { Card, CardContent } from '../components/ui';
import { SkeletonStats } from '../components/Skeleton';
import { BarList, Sparkline, StageFlow } from '../components/charts';
import { CATEGORY_BADGES } from '../lib/categories';
import { usePolling } from '../lib/usePolling';

/**
 * The screen somebody reads between patients.
 *
 * The portal used to land on the queue, which answers "who is next" and
 * nothing else. A doctor finishing a consultation had no way to see that
 * three follow-ups are due, a lab result came back, a drug expires on
 * Friday, or yesterday's takings are short — each lived on its own page,
 * reachable only by someone who already suspected it.
 *
 * ── What it is not ───────────────────────────────────────────────────
 *
 * Not a chart. The data's job here is a handful of single headlines, and
 * a stat tile *is* the chart for that — Analytics already owns the trend
 * line, and a plot to interpret is the wrong thing to put in front of
 * someone with a patient waiting.
 *
 * Two things since added test that rule rather than break it. A sparkline
 * sits beside "seen today" because the number alone answers nothing:
 * twelve patients is a quiet day or a busy one, and only the shape of the
 * fortnight says which. It is a scale for a figure, not a plot to read —
 * deliberately not interactive, with the date-by-date question left on
 * Analytics where it belongs. And today's flow replaces five numbers that
 * were already on this screen, scattered; one row of comparable bars is
 * less to interpret than five tiles, not more.
 *
 * The test each had to pass: does it let somebody act sooner? Anything
 * that only satisfies curiosity belongs on Analytics. The one review of clinical dashboards
 * with any rigour (https://www.jmir.org/2026/1/e77361) found 78% of them
 * are built ad hoc, and names what matters: actionable metrics, visible
 * freshness, priority ordering, role-based views.
 *
 * So every number is something a person can act on this morning. No
 * totals-since-inception: "11 patients registered" tells nobody to do
 * anything, "2 follow-ups overdue" does.
 *
 * ── The order is the design ──────────────────────────────────────────
 *
 * Layered by urgency, not by module. Who is waiting, then what needs
 * doing, then the money. An expired drug outranks the month's revenue
 * even though revenue is the bigger number.
 *
 * Exactly one hero figure, as the skill requires, and it is the count of
 * people waiting — the thing that decides what you do in the next
 * minute. Proportional figures on it, never tabular: equal-width digits
 * make "121" look loose at display sizes.
 */

type Attention = {
  key: string; label: string; count: number; href: string; severity: 'warn' | 'info';
};

type DashboardData = {
  generatedAt: string;
  role: string;
  today: {
    waiting: number; inProgress: number; completed: number; noShow: number;
    cancelled: number; booked: number; awaitingVitals: number;
    /** Who is carrying today. Empty on a single-doctor practice. */
    loadByDoctor: { doctorId: string; doctorName: string; booked: number; seen: number }[];
    /** The last 14 days including today, so today's count has a scale. */
    dailyContext: { date: string; count: number }[];
    nowServing: { patientName: string; uhid: string; allergies: string | null; doctorName: string | null } | null;
    next: {
      patientName: string; uhid: string; category: string;
      allergies: string | null; chronicConditions: string | null;
      doctorName: string | null; scheduledAt: string;
    } | null;
  };
  attention: Attention[];
  stock: { expired: number; expiringSoon: number; lowStock: number } | null;
  money: {
    collectedToday: number; byMode: Record<string, number>;
    outstanding: number; unbilledVisits: number;
  } | null;
};

const REFRESH_MS = 60_000;

const rupees = (n: number) =>
  `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

/** "just now", "4 minutes ago" — freshness is a design responsibility, so
 *  it is stated rather than implied by the data looking plausible. */
function ago(iso: string, now: number): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 20) return 'just now';
  if (seconds < 90) return `${seconds} seconds ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  return `${hours} hour${hours === 1 ? '' : 's'} ago`;
}

/**
 * The "Updated N ago" line, and the only thing in it that advances.
 *
 * This clock used to live in Dashboard itself as a state value set every
 * ten seconds -- which re-rendered the whole screen, every stat tile and
 * every list on it, to move one short string along. A doctor leaves this
 * page open between patients, so that was the most frequently repeated
 * piece of wasted work in the app.
 *
 * Owning the interval here keeps the label honest (it would otherwise
 * read "just now" for a full minute) and costs one text node to update.
 */
function Freshness({ iso }: { iso: string }) {
  const [now, setNow] = useState(() => Date.now());
  usePolling(() => setNow(Date.now()), 10_000);
  return <>Updated {ago(iso, now)}</>;
}

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await apiFetch<DashboardData>('/dashboard'));
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load the dashboard.');
    }
  }, []);

  // Pauses while the tab is hidden and refreshes the moment it is looked
  // at again -- see lib/usePolling. The "updated N ago" clock lives in
  // <Freshness>, so advancing it no longer re-renders this whole screen.
  usePolling(load, REFRESH_MS);

  if (!data) {
    return (
      <div className="p-4 sm:p-6 md:p-8">
        {error ? (
          <Card><CardContent className="p-5 text-sm text-ink-danger">{error}</CardContent></Card>
        ) : (
          <SkeletonStats count={4} label="Loading today's summary" />
        )}
      </div>
    );
  }

  const { today, attention, stock, money } = data;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="max-w-[1600px] p-4 sm:p-6 md:p-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{greeting}</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            <Freshness iso={data.generatedAt} />
          </p>
        </div>
        <Button variant="ghost" size="sm" icon={<RefreshCw size={12} />} onClick={load}>
          Refresh
        </Button>
      </div>

      {/* ── Who is waiting. The one hero figure. ───────────────────────── */}
      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-center gap-x-10 gap-y-5 p-5">
          <div>
            {/* Proportional figures, deliberately: tabular-nums gives every
                digit the width of a zero, which makes a number like 12 look
                loose at this size. */}
            <p className="text-5xl font-semibold leading-none">{today.waiting}</p>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {today.waiting === 1 ? 'patient waiting' : 'patients waiting'}
              {today.booked > 0 && ` · ${today.booked} booked today`}
            </p>
          </div>

          {today.nowServing && (
            <div className="min-w-0 border-l border-border/10 pl-6">
              <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                <Activity size={11} aria-hidden="true" /> In consultation
              </p>
              <p className="mt-1 truncate text-sm font-medium">{today.nowServing.patientName}</p>
              <p className="text-xs text-muted-foreground">
                {today.nowServing.doctorName ? `Dr. ${today.nowServing.doctorName}` : 'Unassigned'}
              </p>
            </div>
          )}

          {today.next && (
            <div className="min-w-0 border-l border-border/10 pl-6">
              <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                <Stethoscope size={11} aria-hidden="true" /> Next
              </p>
              <p className="mt-1 flex items-center gap-2 truncate text-sm font-medium">
                {today.next.patientName}
                {today.next.category !== 'GENERAL' && CATEGORY_BADGES[today.next.category] && (
                  // The shared badge map, so a triage tier is the same
                  // colour here as on the queue and the patient list.
                  <span className={cn('rounded-full px-1.5 py-0.5 text-[10px]', CATEGORY_BADGES[today.next.category]!.color)}>
                    {CATEGORY_BADGES[today.next.category]!.label}
                  </span>
                )}
              </p>
              {/* The one fact a doctor must never have to click to find.
                  Shown here for the same reason the encounter screen puts
                  it above the fold. */}
              {today.next.allergies ? (
                <p className="mt-0.5 flex items-start gap-1 text-xs text-ink-danger">
                  <AlertTriangle size={11} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <span className="min-w-0">Allergic to {today.next.allergies}</span>
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">{today.next.uhid}</p>
              )}
            </div>
          )}

          <Link
            to="/queue"
            className="ml-auto inline-flex items-center gap-1.5 self-center text-xs text-primary underline-offset-4 hover:underline"
          >
            Open the queue <ArrowRight size={12} aria-hidden="true" />
          </Link>
        </CardContent>
      </Card>

      {/* ── What needs doing, most urgent first ────────────────────────── */}
      {attention.length > 0 && (
        <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {attention.map((item) => (
            <Link
              key={item.key}
              to={item.href}
              className={cn(
                'flex items-center gap-2.5 rounded-lg border p-3 transition-colors',
                item.severity === 'warn'
                  ? 'border-ink-warning/30 bg-ink-warning/10 hover:bg-ink-warning/15'
                  : 'border-border/10 bg-foreground/[0.02] hover:bg-foreground/5',
              )}
            >
              {/* Status colour never carries meaning alone: an icon and a
                  worded label say the same thing. */}
              {item.severity === 'warn'
                ? <AlertTriangle size={14} className="shrink-0 text-ink-warning" aria-hidden="true" />
                : <Info size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />}
              <span className="min-w-0 text-xs">
                <span className="font-semibold">{item.count}</span>{' '}
                <span className={item.severity === 'warn' ? 'text-foreground' : 'text-muted-foreground'}>
                  {item.label}
                </span>
              </span>
              <ArrowRight size={12} className="ml-auto shrink-0 text-muted-foreground/60" aria-hidden="true" />
            </Link>
          ))}
        </div>
      )}

      {/* ── The rest of today, then the money ──────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Seen today"
          value={String(today.completed)}
          hint={today.booked ? `of ${today.booked} booked` : undefined}
          // The fortnight behind the number. Without it "9" is unreadable:
          // nobody can tell a quiet Tuesday from a rush without knowing
          // what this clinic's days usually look like.
          aside={
            today.dailyContext?.length >= 2 ? <Sparkline data={today.dailyContext} /> : undefined
          }
        />
        <Stat
          label="Awaiting vitals"
          value={String(today.awaitingVitals)}
          hint={today.awaitingVitals ? 'taken at the desk, before the consult' : 'all up to date'}
        />
        {money && (
          <>
            <Stat
              label="Collected today"
              value={rupees(money.collectedToday)}
              hint={
                money.collectedToday
                  ? Object.entries(money.byMode).filter(([, v]) => v > 0).map(([k, v]) => `${k.toLowerCase()} ${rupees(v)}`).join(' · ')
                  : 'nothing received yet'
              }
            />
            <Stat
              label="Outstanding"
              value={rupees(money.outstanding)}
              hint="billed and not yet paid"
            />
          </>
        )}
        {!money && today.noShow > 0 && (
          <Stat label="Did not arrive" value={String(today.noShow)} hint="marked no-show" />
        )}
      </div>

      {/* ── Where today has got to ────────────────────────────────────────
          Shown only once there is a day to describe. On an empty morning
          four bars at zero is furniture, and the hero card above already
          says the clinic has nobody waiting. */}
      {today.booked > 0 && (
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <Card>
            <CardContent className="p-4">
              <h2 className="mb-3 text-[11px] text-muted-foreground">Today&apos;s flow</h2>
              <StageFlow
                total={today.booked}
                stages={[
                  { label: 'Booked', value: today.booked },
                  { label: 'Waiting', value: today.waiting },
                  { label: 'With doctor', value: today.inProgress },
                  { label: 'Seen', value: today.completed },
                ]}
              />
              {/* The ones that fell out of the flow rather than moved
                  through it, named rather than drawn: a bar for "did not
                  arrive" alongside the stages would read as a fifth stage,
                  which is the opposite of what happened. */}
              {(today.noShow > 0 || today.cancelled > 0) && (
                <p className="mt-2.5 border-t border-border/10 pt-2.5 text-[11px] text-muted-foreground/70">
                  {[
                    today.noShow > 0 && `${today.noShow} did not arrive`,
                    today.cancelled > 0 && `${today.cancelled} cancelled`,
                  ].filter(Boolean).join(' · ')}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Only with a second doctor. On a single-doctor practice this is
              one bar at 100%, which tells them something they know. */}
          {today.loadByDoctor?.length > 1 && (
            <Card>
              <CardContent className="p-4">
                <h2 className="mb-3 text-[11px] text-muted-foreground">
                  Booked today, by doctor
                </h2>
                <BarList
                  items={today.loadByDoctor.map((d) => ({
                    label: d.doctorName,
                    value: d.booked,
                  }))}
                />
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {stock && (stock.expiringSoon > 0 || stock.lowStock > 0) && (
        <p className="mt-4 text-xs text-muted-foreground">
          Pharmacy:{' '}
          {[
            stock.expiringSoon > 0 && `${stock.expiringSoon} batch${stock.expiringSoon === 1 ? '' : 'es'} expiring within 30 days`,
            stock.lowStock > 0 && `${stock.lowStock} medicine${stock.lowStock === 1 ? '' : 's'} at or below its reorder level`,
          ].filter(Boolean).join(' · ')}
          {'. '}
          <Link to="/pharmacy" className="text-primary underline-offset-4 hover:underline">Open inventory</Link>
        </p>
      )}

      {error && <p className="mt-4 text-xs text-ink-danger">{error}</p>}
    </div>
  );
}

/**
 * One number and what it means.
 *
 * The label is sentence case with no trailing colon, the value is sans
 * semibold with the font's own proportional figures, and the hint says
 * what the number is measured against — a figure with nothing to compare
 * it to is trivia.
 */
/**
 * Marks itself when the figure changes.
 *
 * This screen refreshes on a timer, so a count can move while nobody is
 * looking at it and there is nothing to say it did -- a doctor glancing
 * at a dashboard left open since this morning cannot tell a current
 * number from a stale one. The highlight answers that and then fades, so
 * a screen left alone settles back to plain.
 *
 * Keyed on the value rather than on a render: React re-renders this on
 * every poll whether the number moved or not, and highlighting an
 * unchanged figure once a minute would be worse than not highlighting
 * at all.
 *
 * The very first value is deliberately NOT a change. Everything flashing
 * on arrival is the staggered-entrance habit wearing a different hat.
 */
function useChanged(value: string): boolean {
  const previous = useRef<string | null>(null);
  const [changed, setChanged] = useState(false);

  useEffect(() => {
    const had = previous.current;
    previous.current = value;
    if (had === null || had === value) return;
    setChanged(true);
    // Slightly longer than the animation, so re-arming cannot clip it.
    const t = setTimeout(() => setChanged(false), 1500);
    return () => clearTimeout(t);
  }, [value]);

  return changed;
}

function Stat({
  label, value, hint, aside,
}: {
  label: string;
  value: string;
  hint?: string;
  /** A small mark that gives the figure a scale, such as a sparkline. */
  aside?: React.ReactNode;
}) {
  const changed = useChanged(value);
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        {/* The figure and its scale on one baseline, the mark pushed right
            so the numbers down the row of tiles still line up. `items-end`
            rather than centre: a sparkline hangs off the number's baseline,
            which is what makes it read as an annotation on the figure
            rather than a second thing in the tile. */}
        <div className="mt-1 flex items-end justify-between gap-3">
          <p className="inline-block text-2xl font-semibold leading-none">
            <span className={changed ? 'just-changed' : undefined}>{value}</span>
          </p>
          {aside && <span className="shrink-0 leading-none">{aside}</span>}
        </div>
        {hint && <p className="mt-1.5 text-[11px] text-muted-foreground/70">{hint}</p>}
      </CardContent>
    </Card>
  );
}
