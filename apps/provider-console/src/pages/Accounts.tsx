import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2, Plus, Search, Activity, IndianRupee, CircleDot, X, AlertTriangle,
} from 'lucide-react';
import { apiFetch, ApiError } from '../lib/api';
import { Button } from '../components/Button';
import { SkeletonStats, SkeletonList } from '../components/Skeleton';
import { useToast } from '../components/Toast';
import { type AccountListItem, type Meta, STATUS_STYLE, PLAN_STYLE, money } from '../lib/types';

/**
 * Every clinic you have sold to, and what state each one is in.
 *
 * The three numbers at the top are the ones that actually matter running
 * this business: how many clinics are live, what they pay in total, and
 * whether any of them is currently down. Everything else is a click away.
 */
export function Accounts() {
  const [accounts, setAccounts] = useState<AccountListItem[]>([]);
  const [mrr, setMrr] = useState(0);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch<{ accounts: AccountListItem[]; mrr: number }>('/accounts');
      setAccounts(res.accounts);
      setMrr(res.mrr);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load accounts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { apiFetch<Meta>('/meta').then(setMeta).catch(() => setMeta(null)); }, []);

  const visible = accounts.filter((a) => {
    if (statusFilter && a.status !== statusFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return [a.name, a.city, a.contactName, a.publicDomain].some((v) => v?.toLowerCase().includes(q));
  });

  const live = accounts.filter((a) => a.status === 'LIVE');
  const down = live.filter((a) => a.lastHealth && !a.lastHealth.ok);

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-[1600px]">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-1">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Building2 size={20} className="text-emerald-400" /> Clinics
        </h1>
        <Button variant="primary" icon={<Plus size={15} />} onClick={() => setCreating(true)}>
          Onboard a clinic
        </Button>
      </div>
      <p className="text-sm text-gray-400 mb-5">Every clinic you have sold to, and where each one stands.</p>

      {/* Down clinics are the one thing worth interrupting for. */}
      {down.length > 0 && (
        <div className="flex items-start gap-3 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 mb-5">
          <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
          <div className="text-sm text-red-200">
            <strong className="text-red-300">{down.length} live {down.length === 1 ? 'clinic is' : 'clinics are'} not responding.</strong>{' '}
            {down.map((a) => a.name).join(', ')} — patients may be unable to reach the site.
          </div>
        </div>
      )}

      {loading ? <div className="mb-6"><SkeletonStats count={3} label="Loading totals" /></div> : (
      <div className="grid sm:grid-cols-3 gap-3 mb-6">
        <Stat icon={CircleDot} label="Live clinics" value={String(live.length)} tone="text-emerald-400" />
        <Stat icon={IndianRupee} label="Monthly recurring" value={money(mrr)} tone="text-white"
          hint="Live accounts only — a lead is a hope, not income." />
        <Stat icon={Activity} label="Onboarding" value={String(accounts.filter((a) => a.status === 'ONBOARDING').length)} tone="text-amber-400" />
      </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by clinic, city, contact or domain"
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm outline-none focus:border-emerald-400"
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm outline-none">
          <option value="">All statuses</option>
          {(meta?.statuses ?? []).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {error && <div className="px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-sm mb-4">{error}</div>}
      {loading && <SkeletonList rows={5} label="Loading clinics" />}

      <div className="flex flex-col gap-2">
        {visible.map((a) => (
          <Link key={a.id} to={`/clinics/${a.id}`}
            className="flex items-center gap-3 p-3.5 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium truncate">{a.name}</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${STATUS_STYLE[a.status]}`}>{a.status}</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${PLAN_STYLE[a.plan]}`}>{a.plan}</span>
              </div>
              <div className="text-[11px] text-gray-500 truncate mt-0.5">
                {[a.city, a.contactName, a.publicDomain].filter(Boolean).join('  ·  ') || 'No details yet'}
              </div>
            </div>

            {a.status === 'LIVE' && a.lastHealth && (
              <span className={`flex items-center gap-1.5 text-[11px] shrink-0 ${a.lastHealth.ok ? 'text-emerald-400' : 'text-red-400'}`}
                title={`Checked ${new Date(a.lastHealth.checkedAt).toLocaleString()}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${a.lastHealth.ok ? 'bg-emerald-400' : 'bg-red-400'}`} />
                {a.lastHealth.ok ? `${a.lastHealth.latencyMs}ms` : 'down'}
              </span>
            )}

            {a.progress.total > 0 && a.progress.done < a.progress.total && (
              <span className="text-[11px] text-gray-500 shrink-0">{a.progress.done}/{a.progress.total}</span>
            )}
            <span className="text-sm shrink-0 tabular-nums">{a.monthlyFee ? money(a.monthlyFee, a.currency) : '—'}</span>
          </Link>
        ))}

        {!loading && visible.length === 0 && (
          <p className="text-sm text-gray-600 py-12 text-center">
            {accounts.length === 0
              ? 'No clinics yet. Onboard your first one to get started.'
              : 'No clinics match that search.'}
          </p>
        )}
      </div>

      {creating && <NewAccountDialog meta={meta} onClose={() => setCreating(false)} onCreated={() => { setCreating(false); load(); }} />}
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone, hint }: {
  icon: any; label: string; value: string; tone: string; hint?: string;
}) {
  return (
    <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
      <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
        <Icon size={13} className={tone} /> {label}
      </div>
      <div className={`text-2xl font-bold ${tone}`}>{value}</div>
      {hint && <div className="text-[11px] text-gray-600 mt-1">{hint}</div>}
    </div>
  );
}

function NewAccountDialog({ meta, onClose, onCreated }: {
  meta: Meta | null; onClose: () => void; onCreated: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState('');
  // The slug IS the clinic's subdomain, so it has to be deliberate rather
  // than derived from a legal name: "Dr Asif's Family Clinic Pvt Ltd"
  // slugifies to something nobody wants to read out over the phone. It is
  // also effectively permanent -- changing it later would move every URL
  // the clinic has given to patients.
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [city, setCity] = useState('');
  const [plan, setPlan] = useState<'BASIC' | 'STANDARD' | 'PREMIUM'>('STANDARD');
  const [monthlyFee, setMonthlyFee] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Prefill the fee from the plan, but let it be overridden -- the console
  // should suggest the list price, not insist on it.
  useEffect(() => {
    if (meta?.suggestedFees) setMonthlyFee(String(meta.suggestedFees[plan]));
  }, [plan, meta]);

  // Mirrors the server's slugify so the preview matches what would
  // actually be stored. Kept in sync deliberately rather than fetched:
  // the field needs to update on every keystroke.
  const suggestedSlug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

  // Follow the name until the operator takes over, then leave it alone.
  useEffect(() => {
    if (!slugEdited) setSlug(suggestedSlug);
  }, [suggestedSlug, slugEdited]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch('/accounts', {
        method: 'POST',
        data: {
          name,
          slug: slug || undefined,
          contactName: contactName || undefined,
          contactEmail: contactEmail || undefined,
          contactPhone: contactPhone || undefined,
          city: city || undefined,
          plan,
          monthlyFee: monthlyFee ? Number(monthlyFee) : undefined,
        },
      });
      toast.success(name + " added.");
      onCreated();
    } catch (err) {
      const m = err instanceof ApiError ? err.message : 'Could not create the account.';
      setError(m);
      toast.error(m);
      throw err;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} aria-hidden="true" />
      <form onSubmit={submit} role="dialog" aria-label="Onboard a clinic"
        className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#11141a] p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">Onboard a clinic</h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-white/10" aria-label="Close"><X size={16} /></button>
        </div>

        {error && <div className="px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-sm mb-3">{error}</div>}

        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Clinic name" span><input value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} /></Field>

          <Field label="Subdomain" span>
            <input
              value={slug}
              onChange={(e) => { setSlugEdited(true); setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')); }}
              required
              className={inputCls}
              placeholder="acme"
              aria-describedby="slug-hint"
            />
            <p id="slug-hint" className="mt-1 text-[11px] leading-relaxed text-gray-400">
              {slug ? (
                <>
                  Patients: <span className="text-gray-300">{slug}.{meta?.platformDomain ?? 'yourdomain'}</span>
                  {' · '}Staff: <span className="text-gray-300">{slug}.portal.{meta?.platformDomain ?? 'yourdomain'}</span>
                </>
              ) : (
                'Becomes the clinic’s web address. Keep it short.'
              )}
              <br />
              Must match the slug used when the API was created, and cannot be changed later.
            </p>
          </Field>
          <Field label="Contact person"><input value={contactName} onChange={(e) => setContactName(e.target.value)} className={inputCls} /></Field>
          <Field label="City"><input value={city} onChange={(e) => setCity(e.target.value)} className={inputCls} /></Field>
          <Field label="Email" hint="Becomes their first sign-in."><input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className={inputCls} /></Field>
          <Field label="Phone"><input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className={inputCls} /></Field>
          <Field label="Plan">
            <select value={plan} onChange={(e) => setPlan(e.target.value as any)} className={inputCls}>
              {(meta?.plans ?? ['BASIC', 'STANDARD', 'PREMIUM']).map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
          <Field label="Monthly fee (₹)" hint="Suggested from the plan; change it to match the deal.">
            <input type="number" min="0" value={monthlyFee} onChange={(e) => setMonthlyFee(e.target.value)} className={inputCls} />
          </Field>
        </div>

        <p className="text-[11px] text-gray-600 mt-4 leading-relaxed">
          Creating the account only records the deal. Domains and provisioning come next, on the clinic's own page.
        </p>

        <div className="flex gap-2 mt-4">
          <Button variant="primary" type="submit" busyLabel="Creating…">Create account</Button>
          <Button type="button" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}

const inputCls = 'w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm outline-none focus:border-emerald-400';

function Field({ label, hint, span, children }: { label: string; hint?: string; span?: boolean; children: React.ReactNode }) {
  return (
    <div className={span ? 'sm:col-span-2' : ''}>
      <label className="block text-xs font-medium text-gray-400 mb-1">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-gray-600 mt-1">{hint}</p>}
    </div>
  );
}
