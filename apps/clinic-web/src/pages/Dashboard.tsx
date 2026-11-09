import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Info, RefreshCw } from 'lucide-react';
import { apiFetch, ApiError } from '../lib/api';
import { cn } from '@/lib/utils';
import { Button } from '../components/Button';
import { Card, CardContent } from '../components/ui';
import { SkeletonStats } from '../components/Skeleton';
import { Sparkline } from '../components/charts';
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
 * Not a chart. The data's job here is a handful of single headlines,
 * written as sentences and short lists rather than a grid of tiles — Analytics already owns the trend
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
    waiting: number; notArrived?: number; inProgress: number; completed: number; noShow: number;
    cancelled: number; booked: number; awaitingVitals: number;
    /** Who is carrying today. Empty on a single-doctor practice. */
    loadByDoctor: { doctorId: string; doctorName: string; booked: number; seen: number }[];
    /** The last 14 days including today, so today's count has a scale. */
    dailyContext: { date: string; count: number }[];
    nowServing: { tokenNumber?: number | null; patientName: string; uhid: string; allergies: string | null; doctorName: string | null } | null;
    next: {
      tokenNumber?: number | null;
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
  const dateLabel = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
  const notArrived = today.notArrived ?? 0;
  const token = (n?: number | null) => (n ? `Token ${n} · ` : '');
  const byMode = money ? Object.entries(money.byMode).filter(([, v]) => v > 0) : [];

  return (
    <div className="max-w-[1100px] p-4 sm:p-6 md:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1>Overview</h1>
          <p className="mt-2 text-[15px] text-muted-foreground">
            {dateLabel} · <Freshness iso={data.generatedAt} />
          </p>
        </div>
        <Button variant="ghost" size="sm" icon={<RefreshCw size={12} />} onClick={load}>
          Refresh
        </Button>
      </div>

      {/* ── Right now: who is waiting, who is in, who is next. ────────── */}
      <section className="mb-6 rounded-xl border border-border/15 bg-card">
        <div className="flex flex-wrap items-stretch">
          <div className="flex min-w-[180px] flex-col justify-center border-border/10 px-5 py-5 sm:border-r">
            {/* The one big figure, because it decides the next minute. */}
            <p className="font-display text-[3.4rem] font-semibold leading-none"><Changed value={String(today.waiting)} /></p>
            <p className="mt-1.5 text-[14px] font-medium">{today.waiting === 1 ? 'patient waiting' : 'patients waiting'}</p>
            {notArrived > 0 && <p className="text-[13px] text-muted-foreground">{notArrived} booked, not here yet</p>}
          </div>
          <dl className="grid min-w-0 flex-1 gap-x-6 gap-y-4 px-5 py-5 sm:grid-cols-2">
            <div className="min-w-0">
              <dt className="text-[13px] text-muted-foreground">With the doctor</dt>
              {today.nowServing ? (
                <dd className="mt-0.5">
                  <span className="block truncate text-[15px] font-semibold">{token(today.nowServing.tokenNumber)}{today.nowServing.patientName}</span>
                  <span className="text-[13px] text-muted-foreground">{today.nowServing.doctorName ? `Dr. ${today.nowServing.doctorName}` : 'No doctor chosen'}</span>
                </dd>
              ) : (
                <dd className="mt-0.5 text-[15px] text-muted-foreground">No one</dd>
              )}
            </div>
            <div className="min-w-0">
              <dt className="text-[13px] text-muted-foreground">Next</dt>
              {today.next ? (
                <dd className="mt-0.5">
                  <span className="flex flex-wrap items-center gap-2 text-[15px] font-semibold">
                    <span className="truncate">{token(today.next.tokenNumber)}{today.next.patientName}</span>
                    {today.next.category !== 'GENERAL' && CATEGORY_BADGES[today.next.category] && (
                      <span className={cn('rounded px-1.5 py-0.5 text-[12px] font-semibold', CATEGORY_BADGES[today.next.category]!.color)}>
                        {CATEGORY_BADGES[today.next.category]!.label}
                      </span>
                    )}
                  </span>
                  {/* The one fact a doctor must never have to click to find. */}
                  {today.next.allergies ? (
                    <span className="mt-0.5 flex items-start gap-1 text-[13px] font-medium text-ink-danger">
                      <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden="true" /> Allergic to {today.next.allergies}
                    </span>
                  ) : (
                    <span className="text-[13px] text-muted-foreground">{today.next.doctorName ? `For Dr. ${today.next.doctorName}` : today.next.uhid}</span>
                  )}
                </dd>
              ) : (
                <dd className="mt-0.5 text-[15px] text-muted-foreground">No one waiting</dd>
              )}
            </div>
          </dl>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border/10 px-5 py-2.5 text-[14px]">
          <span className="text-muted-foreground">
            {today.completed} seen{today.booked ? ` of ${today.booked} today` : ''}
            {today.noShow > 0 ? ` · ${today.noShow} did not come` : ''}
            {today.awaitingVitals > 0 ? ` · ${today.awaitingVitals} waiting without vitals` : ''}
          </span>
          <Link to="/queue" className="inline-flex shrink-0 items-center gap-1.5 font-medium underline-offset-4 hover:underline">
            Open the queue <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* ── What needs doing, most urgent first ──────────────────────── */}
        <section>
          <h2 className="mb-2.5 text-[16px] font-semibold">Needs doing</h2>
          {attention.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border/25 px-4 py-5 text-[14px] text-muted-foreground">Nothing is waiting on anyone right now.</p>
          ) : (
            <ul className="divide-y divide-border/10 overflow-hidden rounded-xl border border-border/15 bg-card">
              {attention.map((item) => (
                <li key={item.key}>
                  <Link to={item.href} className="flex items-center gap-3 px-4 py-3 hover:bg-foreground/[0.03]">
                    {/* Colour never carries the meaning alone: an icon and
                        the words say the same thing. */}
                    {item.severity === 'warn'
                      ? <AlertTriangle size={15} className="shrink-0 text-ink-warning" aria-hidden="true" />
                      : <Info size={15} className="shrink-0 text-muted-foreground" aria-hidden="true" />}
                    <span className="min-w-0 flex-1 text-[14px]">
                      <span className="font-semibold">{item.count}</span> {item.label}
                    </span>
                    <ArrowRight size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {stock && (stock.expiringSoon > 0 || stock.lowStock > 0) && (
            <p className="mt-3 text-[13px] text-muted-foreground">
              Pharmacy:{' '}
              {[
                stock.expiringSoon > 0 && `${stock.expiringSoon} batch${stock.expiringSoon === 1 ? '' : 'es'} expiring within 30 days`,
                stock.lowStock > 0 && `${stock.lowStock} medicine${stock.lowStock === 1 ? '' : 's'} at or below the reorder level`,
              ].filter(Boolean).join(' · ')}
              {'. '}
              <Link to="/pharmacy" className="font-medium text-foreground underline underline-offset-4">Open stock</Link>
            </p>
          )}
        </section>

        <div className="space-y-6">
          {money && (
            <section>
              <h2 className="mb-2.5 text-[16px] font-semibold">Money today</h2>
              <dl className="divide-y divide-border/10 rounded-xl border border-border/15 bg-card text-[14px]">
                <div className="flex items-baseline justify-between gap-3 px-4 py-3">
                  <dt>Collected</dt>
                  <dd className="text-right">
                    <span className="font-display text-[1.6rem] font-semibold leading-none tabular-nums">{rupees(money.collectedToday)}</span>
                    <span className="block text-[13px] text-muted-foreground">
                      {byMode.length ? byMode.map(([k, v]) => `${k === 'UPI' ? 'UPI' : k.charAt(0) + k.slice(1).toLowerCase()} ${rupees(v)}`).join(' · ') : 'Nothing received yet'}
                    </span>
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3 px-4 py-3">
                  <dt>Still owed by patients</dt>
                  <dd className={money.outstanding > 0 ? 'font-semibold text-ink-warning tabular-nums' : 'font-medium tabular-nums'}>{rupees(money.outstanding)}</dd>
                </div>
              </dl>
            </section>
          )}

          {(today.dailyContext?.length ?? 0) >= 2 && (
            <section>
              <h2 className="mb-2.5 text-[16px] font-semibold">The last two weeks</h2>
              <div className="flex items-end justify-between gap-4 rounded-xl border border-border/15 bg-card px-4 py-3">
                <p className="text-[14px] text-muted-foreground">
                  Appointments a day. Today: <span className="font-semibold text-foreground">{today.booked}</span>
                </p>
                {/* A scale for today's figure, not a chart to study: the
                    date-by-date question belongs to Reports. */}
                <Sparkline data={today.dailyContext} />
              </div>
            </section>
          )}

          {/* Only with a second doctor; on a single-doctor practice this is
              one row that says what they already know. */}
          {today.loadByDoctor?.length > 1 && (
            <section>
              <h2 className="mb-2.5 text-[16px] font-semibold">By doctor</h2>
              <ul className="divide-y divide-border/10 rounded-xl border border-border/15 bg-card text-[14px]">
                {today.loadByDoctor.map((d) => (
                  <li key={d.doctorId} className="px-4 py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-medium">Dr. {d.doctorName}</span>
                      <span className="tabular-nums text-muted-foreground">{d.seen} of {d.booked} seen</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-foreground/[0.07]" aria-hidden="true">
                      <div className="h-full rounded-full bg-[hsl(var(--chart-1))]" style={{ width: `${d.booked ? Math.round((d.seen / d.booked) * 100) : 0}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>

      {error && <p className="mt-4 text-[13px] text-ink-danger">{error}</p>}
    </div>
  );
}

/** A figure that marks itself when a refresh changes it. */
function Changed({ value }: { value: string }) {
  const changed = useChanged(value);
  return <span className={changed ? 'just-changed' : undefined}>{value}</span>;
}

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
