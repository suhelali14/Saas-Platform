import { useState, useEffect, useCallback } from 'react';
import { Wallet, Plus, Trash2, TrendingUp, TrendingDown, IndianRupee, X } from 'lucide-react';
import { useToast } from '../components/Toast';
import { SkeletonList, SkeletonTable, SkeletonStats, SkeletonForm, SkeletonPanels } from '../components/Skeleton';
import { Button } from '../components/Button';
import { apiFetch, ApiError } from '../lib/api';
import { useClinicAuth } from '../contexts/ClinicAuthContext';

/**
 * Expense ledger and profit & loss -- the other half of the SRS's billing
 * module. Phase 4 built the revenue side; without expenses the doctor could
 * see what came in but never what the clinic actually earned.
 */

interface Expense {
  id: string; category: string; description: string; amount: string;
  paidAt: string; paymentMode: string; vendor: string | null; notes: string | null;
  recordedBy: { name: string };
}
interface ExpenseList {
  expenses: Expense[]; total: number;
  byCategory: { category: string; amount: number }[];
}
interface ProfitLoss {
  from: string; to: string; revenue: number; expenses: number; netProfit: number; outstanding: number;
  revenueByMode: { mode: string; amount: number }[];
  expenseByCategory: { category: string; amount: number }[];
}

const ADMIN_ROLES = new Set(['DOCTOR', 'ADMIN']);

export function Expenses() {
  const { user } = useClinicAuth();
  const canSeeProfitLoss = user && ADMIN_ROLES.has(user.role);

  const [tab, setTab] = useState<'ledger' | 'pl'>('ledger');
  const [range, setRange] = useState(() => defaultRange());

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl">
      <h1 className="text-xl font-bold flex items-center gap-2 mb-1">
        <Wallet size={20} className="text-emerald-400" /> Expenses
      </h1>
      <p className="text-sm text-muted-foreground mb-4">What the clinic spends, and what it actually earned.</p>

      <div className="flex flex-wrap items-end gap-3 mb-5">
        <div className="flex gap-2">
          <button onClick={() => setTab('ledger')} className={tabCls(tab === 'ledger')}>Ledger</button>
          {canSeeProfitLoss && <button onClick={() => setTab('pl')} className={tabCls(tab === 'pl')}>Profit &amp; Loss</button>}
        </div>
        <div className="flex items-end gap-2 ml-auto">
          <div>
            <label className="block text-[11px] text-muted-foreground/70 mb-1">From</label>
            <input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className="block text-[11px] text-muted-foreground/70 mb-1">To</label>
            <input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} className={inputCls} />
          </div>
        </div>
      </div>

      {tab === 'ledger' ? <Ledger range={range} /> : <ProfitLossView range={range} />}
    </div>
  );
}

function Ledger({ range }: { range: { from: string; to: string } }) {
  const toast = useToast();
  const { user } = useClinicAuth();
  const canDelete = user && ADMIN_ROLES.has(user.role);
  const [data, setData] = useState<ExpenseList | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await apiFetch<ExpenseList>(`/expenses?from=${range.from}&to=${range.to}`));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load expenses.');
    }
  }, [range.from, range.to]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    apiFetch<{ categories: string[] }>('/expenses/categories').then((r) => setCategories(r.categories)).catch(() => setCategories([]));
  }, []);

  const remove = async (id: string) => {
    try {
      await apiFetch(`/expenses/${id}`, { method: 'DELETE' });
      toast.success('Expense deleted.');
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not delete.');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {error && <div className="px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-sm">{error}</div>}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold">₹{(data?.total ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          <span className="text-sm text-muted-foreground/70">total in this period</span>
        </div>
        <button onClick={() => setAdding((v) => !v)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold">
          {adding ? <><X size={14} /> Cancel</> : <><Plus size={14} /> Record Expense</>}
        </button>
      </div>

      {adding && <ExpenseForm categories={categories} onSaved={() => { setAdding(false); load(); }} />}

      {data && data.byCategory.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {data.byCategory.map((c) => (
            <span key={c.category} className="px-2.5 py-1.5 rounded-lg bg-foreground/5 border border-border/10 text-xs">
              {c.category} <span className="text-muted-foreground">₹{c.amount.toLocaleString('en-IN')}</span>
            </span>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-border/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="bg-foreground/[0.03] text-muted-foreground text-xs">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Date</th>
                <th className="px-3 py-2 text-left font-medium">Category</th>
                <th className="px-3 py-2 text-left font-medium">Description</th>
                <th className="px-3 py-2 text-left font-medium">Vendor</th>
                <th className="px-3 py-2 text-left font-medium">Mode</th>
                <th className="px-3 py-2 text-right font-medium">Amount</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/5">
              {(data?.expenses ?? []).map((e) => (
                <tr key={e.id} className="hover:bg-foreground/[0.02]">
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{new Date(e.paidAt).toLocaleDateString()}</td>
                  <td className="px-3 py-2">{e.category}</td>
                  <td className="px-3 py-2">
                    {e.description}
                    {e.notes && <div className="text-[11px] text-muted-foreground/70">{e.notes}</div>}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{e.vendor || '—'}</td>
                  <td className="px-3 py-2 text-muted-foreground">{e.paymentMode}</td>
                  <td className="px-3 py-2 text-right font-medium whitespace-nowrap">₹{Number(e.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td className="px-3 py-2 text-right">
                    {canDelete && (
                      <Button variant="ghost" size="sm" onClick={() => remove(e.id)} title="Delete expense" aria-label="Delete expense">
                        <Trash2 size={13} />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {data && data.expenses.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground/60 text-sm">No expenses recorded in this period.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ExpenseForm({ categories, onSaved }: { categories: string[]; onSaved: () => void }) {
  const toast = useToast();
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paidAt, setPaidAt] = useState(() => toDateInput(new Date()));
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [vendor, setVendor] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiFetch('/expenses', {
        method: 'POST',
        data: { category, description, amount: Number(amount), paidAt, paymentMode, vendor: vendor || undefined, notes: notes || undefined },
      });
      toast.success('Expense recorded.');
      onSaved();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Could not save the expense.';
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="p-4 rounded-xl border border-border/10 bg-foreground/[0.02] grid md:grid-cols-2 gap-3">
      {error && <div className="md:col-span-2 px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-sm">{error}</div>}
      <div>
        <label className="block text-xs text-muted-foreground mb-1">Category</label>
        <select value={category} onChange={(e) => setCategory(e.target.value)} required className={inputCls + ' w-full'}>
          <option value="">Select…</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs text-muted-foreground mb-1">Amount (₹)</label>
        <input type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required className={inputCls + ' w-full'} />
      </div>
      <div className="md:col-span-2">
        <label className="block text-xs text-muted-foreground mb-1">Description</label>
        <input value={description} onChange={(e) => setDescription(e.target.value)} required maxLength={300} placeholder="e.g. September electricity bill" className={inputCls + ' w-full'} />
      </div>
      <div>
        <label className="block text-xs text-muted-foreground mb-1">Date paid</label>
        <input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} required className={inputCls + ' w-full'} />
      </div>
      <div>
        <label className="block text-xs text-muted-foreground mb-1">Paid by</label>
        <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)} className={inputCls + ' w-full'}>
          <option value="CASH">Cash</option><option value="UPI">UPI</option><option value="CARD">Card</option>
        </select>
      </div>
      <div>
        <label className="block text-xs text-muted-foreground mb-1">Vendor (optional)</label>
        <input value={vendor} onChange={(e) => setVendor(e.target.value)} maxLength={200} className={inputCls + ' w-full'} />
      </div>
      <div>
        <label className="block text-xs text-muted-foreground mb-1">Notes (optional)</label>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} className={inputCls + ' w-full'} />
      </div>
      <button type="submit" disabled={saving} className="md:col-span-2 justify-self-start px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">
        {saving ? 'Saving…' : 'Save Expense'}
      </button>
    </form>
  );
}

function ProfitLossView({ range }: { range: { from: string; to: string } }) {
  const [pl, setPl] = useState<ProfitLoss | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<ProfitLoss>(`/expenses/profit-loss?from=${range.from}&to=${range.to}`)
      .then(setPl)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load profit & loss.'));
  }, [range.from, range.to]);

  if (error) return <div className="px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-sm">{error}</div>;
  if (!pl) return <SkeletonStats count={3} label="Loading profit and loss" />;

  const profitable = pl.netProfit >= 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid sm:grid-cols-3 gap-3">
        <StatCard label="Revenue received" value={pl.revenue} icon={TrendingUp} tone="text-emerald-400" />
        <StatCard label="Expenses paid" value={pl.expenses} icon={TrendingDown} tone="text-red-400" />
        <StatCard label="Net profit" value={pl.netProfit} icon={IndianRupee} tone={profitable ? 'text-emerald-400' : 'text-red-400'} />
      </div>

      {/* Deliberately separate from revenue: money billed but not collected
          is not income, and folding it in would overstate what the clinic
          actually earned. */}
      {pl.outstanding > 0 && (
        <div className="px-3 py-2.5 rounded-lg bg-amber-500/10 text-amber-300 text-sm">
          ₹{pl.outstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })} billed in this period is still unpaid.
          It is <strong>not</strong> counted in revenue above — these figures reflect money actually received.
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <Breakdown title="Revenue by payment mode" rows={pl.revenueByMode.map((r) => ({ label: r.mode, amount: r.amount }))} tone="bg-emerald-400" />
        <Breakdown title="Expenses by category" rows={pl.expenseByCategory.map((r) => ({ label: r.category, amount: r.amount }))} tone="bg-red-400" />
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tone }: { label: string; value: number; icon: any; tone: string }) {
  return (
    <div className="p-4 rounded-xl border border-border/10 bg-foreground/[0.02]">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
        <Icon size={13} className={tone} /> {label}
      </div>
      <div className={`text-2xl font-bold ${tone}`}>
        ₹{value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
      </div>
    </div>
  );
}

/** Proportional bars, single hue per chart -- same convention as Analytics. */
function Breakdown({ title, rows, tone }: { title: string; rows: { label: string; amount: number }[]; tone: string }) {
  const max = Math.max(1, ...rows.map((r) => r.amount));
  return (
    <div className="p-4 rounded-xl border border-border/10 bg-foreground/[0.02]">
      <h2 className="text-sm font-semibold mb-3">{title}</h2>
      {rows.length === 0 && <p className="text-xs text-muted-foreground/60">Nothing recorded in this period.</p>}
      <div className="flex flex-col gap-2">
        {rows.map((r) => (
          <div key={r.label}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-foreground/80">{r.label}</span>
              <span className="text-muted-foreground">₹{r.amount.toLocaleString('en-IN')}</span>
            </div>
            <div className="h-1.5 rounded-full bg-foreground/5 overflow-hidden">
              <div className={`h-full ${tone} rounded-full`} style={{ width: `${(r.amount / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const inputCls = 'px-2.5 py-1.5 rounded-lg bg-foreground/5 border border-border/10 text-xs outline-none focus:border-emerald-400';
const tabCls = (active: boolean) =>
  `px-3 py-1.5 rounded-lg text-xs font-medium ${active ? 'bg-foreground text-background' : 'bg-foreground/5 text-foreground/80'}`;

/** Local date, never toISOString().slice(0,10) -- that shifts to UTC and
 * lands on the wrong day in IST. Same fix as the queue's date picker. */
function toDateInput(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Defaults to the current calendar month, which is how a clinic thinks
 * about rent, salaries and bills. */
function defaultRange() {
  const now = new Date();
  return { from: toDateInput(new Date(now.getFullYear(), now.getMonth(), 1)), to: toDateInput(now) };
}
