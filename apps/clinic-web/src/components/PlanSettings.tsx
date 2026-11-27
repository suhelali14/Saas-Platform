import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CreditCard, ShieldCheck } from 'lucide-react';
import { apiFetch, ApiError } from '../lib/api';
import { useToast } from './Toast';
import { Button } from './Button';
import { SegmentedControl } from './SegmentedControl';

/**
 * Settings, Plan: this clinic's plan, as a monthly or yearly subscription
 * sold by the Nayaversse console (the API's routes/clinic-plan.ts). A plan
 * paid for here is in force at once. Admins only, as the API requires.
 */

interface Offer {
  code: string;
  name: string;
  summary: string;
  includes: string[];
  monthlyPaise: number;
  yearlyPaise: number;
  yearlyDiscountPct: number;
}

interface Sub {
  id: string;
  names: string[];
  interval: 'MONTH' | 'YEAR';
  amountPaise: number;
  status: string;
  currentEnd: string | null;
  cancelAtEnd: boolean;
  startsAt: string | null;
  url: string | null;
}

interface PlanData {
  label: string;
  plan: string;
  readOnly: boolean;
  paidUntil: string | null;
  source: 'console' | 'env';
  connected: boolean;
  unreachable?: boolean;
  mode: string;
  offers: Offer[];
  subscriptions: Sub[];
}

const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

function statusWords(s: Sub): string {
  if (s.startsAt && new Date(s.startsAt) > new Date()) return `Starts on ${date(s.startsAt)}`;
  switch (s.status) {
    case 'CREATED':
      return 'Waiting for payment';
    case 'AUTHENTICATED':
      return 'Payment set up; the first charge is on its way';
    case 'ACTIVE':
      return s.cancelAtEnd ? `Stops on ${date(s.currentEnd)}` : `Renews on ${date(s.currentEnd)}`;
    case 'PENDING':
      return 'A renewal failed; Razorpay is trying again';
    case 'HALTED':
      return 'Renewals stopped: the payment failed';
    default:
      return 'Ended';
  }
}

export function PlanSettings() {
  const toast = useToast();
  const nav = useNavigate();
  const [query] = useSearchParams();
  const checkout = query.get('checkout');
  const [data, setData] = useState<PlanData | null>(null);
  const [interval, setBilled] = useState<'month' | 'year'>('month');
  const [busy, setBusy] = useState('');

  const load = () =>
    apiFetch<PlanData>('/plan').then(setData, (e) => toast.error(e instanceof ApiError ? e.message : 'Could not load the plan.'));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const subscribe = async (o: Offer) => {
    setBusy(o.code);
    try {
      const r = await apiFetch<{ url: string }>('/plan/subscribe', { method: 'POST', data: { offer: o.code, interval } });
      if (r.url.startsWith('/')) nav(r.url);
      else window.location.assign(r.url); // Razorpay's own page: UPI AutoPay, a card or a bank mandate
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not start the subscription.');
    } finally {
      setBusy('');
    }
  };
  const cancel = async (s: Sub) => {
    if (!window.confirm(`Stop renewing? The plan stays as it is until ${date(s.currentEnd)}.`)) return;
    try {
      await apiFetch(`/plan/subscriptions/${s.id}/cancel`, { method: 'POST' });
      toast.success('Renewals stopped.');
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not stop it.');
    }
  };

  if (!data) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (checkout) return <TestCheckout id={checkout} onDone={() => { nav('/settings?tab=plan', { replace: true }); load(); }} />;

  const live = data.subscriptions.filter((s) => !['CANCELLED', 'COMPLETED', 'EXPIRED'].includes(s.status));
  const bestYearly = Math.max(0, ...data.offers.map((o) => o.yearlyDiscountPct));

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-border/10 bg-foreground/[0.02] p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck size={15} className="text-muted-foreground" /> Your plan: {data.label}
          {data.readOnly && <span className="rounded bg-ink-danger/15 px-1.5 py-0.5 text-xs text-ink-danger">paused</span>}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {data.paidUntil ? `Paid until ${date(data.paidUntil)}.` : data.source === 'env' ? 'Set by Nayaversse for your deal.' : ''} Patient records are never hidden or locked by a plan.
        </p>
      </div>

      {!data.connected ? (
        <p className="text-sm text-muted-foreground">Plans for this clinic are arranged with Nayaversse directly. Write to us to change yours.</p>
      ) : data.unreachable ? (
        <p className="text-sm text-ink-danger">Plans could not be loaded just now. Try again in a minute.</p>
      ) : (
        <>
          {data.mode === 'test' && <p className="rounded-md border border-border/10 px-3 py-2 text-xs text-muted-foreground">A test server: paying opens a test checkout and no money moves.</p>}
          {live.length > 0 && (
            <div className="rounded-xl border border-border/10 p-4">
              <h2 className="text-sm font-semibold">Subscriptions</h2>
              <ul className="mt-2 divide-y divide-border/10">
                {live.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div>
                      <p className="text-sm font-medium">{s.names.join(' + ')}</p>
                      <p className="text-xs text-muted-foreground">
                        {rupees(s.amountPaise)} {s.interval === 'MONTH' ? 'a month' : 'a year'} · {statusWords(s)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {s.status === 'CREATED' && (
                        <Button size="sm" variant="primary" onClick={() => (s.url ? window.location.assign(s.url) : nav(`/settings?tab=plan&checkout=${s.id}`))}>
                          Pay now
                        </Button>
                      )}
                      {['ACTIVE', 'AUTHENTICATED', 'PENDING', 'CREATED'].includes(s.status) && !s.cancelAtEnd && (
                        <Button size="sm" variant="ghost" onClick={() => cancel(s)}>
                          Stop renewing
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.offers.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <CreditCard size={15} className="text-muted-foreground" /> Plans
                </h2>
                <SegmentedControl
                  label="Billed"
                  value={interval}
                  onChange={setBilled}
                  options={[
                    { value: 'month' as const, label: 'Monthly' },
                    { value: 'year' as const, label: bestYearly > 0 ? `Yearly, save up to ${Math.round(bestYearly)}%` : 'Yearly' },
                  ]}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {data.offers.map((o) => (
                  <div key={o.code} className="flex flex-col rounded-xl border border-border/10 p-4">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="font-semibold">{o.name}</p>
                      {o.code.toUpperCase() === data.plan && <span className="text-xs text-muted-foreground">your plan now</span>}
                    </div>
                    <p className="mt-1 text-xl font-semibold tabular-nums">
                      {rupees(interval === 'month' ? o.monthlyPaise : o.yearlyPaise)}
                      <span className="ml-1 text-xs font-normal text-muted-foreground">{interval === 'month' ? 'a month' : 'a year'}</span>
                    </p>
                    <p className="mt-1 flex-1 text-sm text-muted-foreground">{o.summary}</p>
                    <Button className="mt-3" variant="primary" busy={busy === o.code} disabled={busy !== ''} onClick={() => subscribe(o)}>
                      Subscribe {interval === 'month' ? 'monthly' : 'yearly'}
                    </Button>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                It renews by itself until you stop it. Above ₹15,000 a debit, a card or UPI asks you to approve each renewal; a bank mandate (net banking or debit card) renews without asking.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TestCheckout({ id, onDone }: { id: string; onDone: () => void }) {
  const toast = useToast();
  const [sub, setSub] = useState<Sub | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    apiFetch<{ subscription: Sub }>(`/plan/subscriptions/${encodeURIComponent(id)}`).then((r) => setSub(r.subscription), () => setSub(null));
  }, [id]);
  const pay = async () => {
    setBusy(true);
    try {
      await apiFetch(`/plan/subscriptions/${encodeURIComponent(id)}/pay`, { method: 'POST' });
      toast.success('Paid. Your plan is in force now.');
      onDone();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not pay.');
      setBusy(false);
    }
  };
  if (!sub) return <p className="text-sm text-muted-foreground">Loading…</p>;
  return (
    <div className="max-w-md rounded-xl border border-border/10 p-5">
      <p className="text-xs font-semibold text-ink-warning">Test payment: no money moves</p>
      <p className="mt-2 font-semibold">{sub.names.join(' + ')}</p>
      <p className="text-sm text-muted-foreground">{sub.interval === 'MONTH' ? 'Every month, until you stop it' : 'Every year, until you stop it'}</p>
      <p className="mt-3 text-2xl font-semibold tabular-nums">{rupees(sub.amountPaise)}</p>
      {sub.status === 'CREATED' ? (
        <div className="mt-4 flex gap-2">
          <Button variant="primary" busy={busy} onClick={pay}>Pay (test)</Button>
          <Button variant="ghost" onClick={onDone}>Cancel</Button>
        </div>
      ) : (
        <Button className="mt-4" onClick={onDone}>Back to the plan</Button>
      )}
    </div>
  );
}
