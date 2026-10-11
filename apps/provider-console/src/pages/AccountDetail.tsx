import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Rocket, Check, CircleDashed, Copy, AlertTriangle, ExternalLink,
  Globe, Activity, ShieldCheck, History,
} from 'lucide-react';
import { apiFetch, ApiError } from '../lib/api';
import { Button } from '../components/Button';
import { SkeletonPanels } from '../components/Skeleton';
import { useToast } from '../components/Toast';
import {
  type AccountDetail as Detail, type Meta, type ProvisionOutcome,
  STATUS_STYLE, PLAN_STYLE, money,
} from '../lib/types';

export function AccountDetail() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Detail | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<ProvisionOutcome | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    if (!id) return;
    try { setData(await apiFetch<Detail>(`/accounts/${id}`)); }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Could not load this clinic.'); }
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { apiFetch<Meta>('/meta').then(setMeta).catch(() => setMeta(null)); }, []);

  if (error) return <div className="p-8"><div className="px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-sm">{error}</div></div>;
  if (!data || !meta) return <div className="p-4 sm:p-6 md:p-8 max-w-[1400px]"><SkeletonPanels count={4} label="Loading this clinic" /></div>;

  const a = data.account;
  const save = async (patch: Record<string, unknown>) => {
    try {
      await apiFetch(`/accounts/${id}`, { method: 'PUT', data: patch });
      toast.success('Saved.');
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not save.');
      throw e;
    }
  };

  const provision = async () => {
    setOutcome(null);
    try {
      const res = await apiFetch<ProvisionOutcome>(`/accounts/${id}/provision`, { method: 'POST', data: {} });
      setOutcome(res);
      // A failed step is the one outcome that must not be missed, so it
      // wins over the dry-run notice.
      const failed = res.steps.filter((s) => s.status === 'failed').length;
      if (failed > 0) toast.error(failed + (failed === 1 ? ' step failed.' : ' steps failed.') + ' See the details below.');
      else if (res.dryRun) toast.info('Rehearsal complete — nothing was created.');
      else toast.success('Clinic deployed.');
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Provisioning failed.');
      throw e;
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-[1400px]">
      <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white mb-4">
        <ArrowLeft size={13} /> All clinics
      </Link>

      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2.5 flex-wrap">
            {a.name}
            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${STATUS_STYLE[a.status]}`}>{a.status}</span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${PLAN_STYLE[a.plan]}`}>{a.plan}</span>
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            {[a.city, a.contactName, a.contactEmail].filter(Boolean).join('  ·  ') || 'No contact details yet'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select value={a.status} onChange={(e) => save({ status: e.target.value })}
            className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm outline-none">
            {meta.statuses.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)] gap-6 items-start">
        <div className="flex flex-col gap-5 min-w-0">
          <Provisioning account={a} meta={meta} outcome={outcome} onProvision={provision} />
          <Checklist accountId={id!} steps={a.steps} meta={meta} onChange={load} />
          <Plan account={a} features={data.features} meta={meta} onSave={save} />
        </div>

        <div className="flex flex-col gap-5 min-w-0">
          <Deployment account={a} onSave={save} />
          <Deal account={a} onSave={save} />
          <Health account={a} />
          <ActivityFeed entries={a.activity} />
        </div>
      </div>
    </div>
  );
}

/* ── Provisioning ───────────────────────────────────────────────────────── */

function Provisioning({ account, meta, outcome, onProvision }: {
  account: Detail['account']; meta: Meta; outcome: ProvisionOutcome | null; onProvision: () => Promise<void>;
}) {
  const ready = Boolean(account.contactEmail && account.publicDomain && account.apiDomain);

  return (
    <Panel title="Deploy" icon={Rocket}>
      {meta.provisioning.dryRun && (
        <div className="flex gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 mb-4">
          <AlertTriangle size={15} className="text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-200/90 leading-relaxed">
            <strong className="text-amber-300">Dry run.</strong> No {!meta.provisioning.neon && 'Neon'}
            {!meta.provisioning.neon && !meta.provisioning.vercel && ' or '}{!meta.provisioning.vercel && 'Vercel'} credentials
            are configured, so this will show you every call it would make and make none of them. Nothing is created
            and nothing is billed. Add the keys to the provider API's <code className="text-amber-300">.env</code> to go live.
          </div>
        </div>
      )}

      {!ready && (
        <p className="text-xs text-gray-500 mb-3">
          Add a contact email and the domains before deploying — the email becomes the clinic's first sign-in, and the
          domains are attached to the deployments as they are created.
        </p>
      )}

      <Button variant="primary" icon={<Rocket size={15} />} onClick={onProvision} disabled={!ready}
        busyLabel={meta.provisioning.dryRun ? 'Rehearsing…' : 'Deploying…'}>
        {meta.provisioning.dryRun ? 'Rehearse deployment' : account.provisionedAt ? 'Re-deploy' : 'Deploy this clinic'}
      </Button>

      {outcome && (
        <div className="mt-4 flex flex-col gap-2">
          {outcome.steps.map((s) => (
            <div key={s.key} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-white/[0.02] border border-white/10">
              <span className={`mt-0.5 shrink-0 ${
                s.status === 'ok' ? 'text-emerald-400' : s.status === 'failed' ? 'text-red-400' : 'text-gray-500'
              }`}>
                {s.status === 'ok' ? <Check size={14} /> : s.status === 'failed' ? <AlertTriangle size={14} /> : <CircleDashed size={14} />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium">{s.label}</div>
                <div className={`text-[11px] mt-0.5 ${s.status === 'failed' ? 'text-red-400' : 'text-gray-500'}`}>{s.detail}</div>
                {s.wouldCall && (
                  <code className="block text-[10px] text-gray-600 mt-1 break-all font-mono">{s.wouldCall}</code>
                )}
              </div>
              {s.durationMs != null && <span className="text-[10px] text-gray-600 shrink-0">{s.durationMs}ms</span>}
            </div>
          ))}

          {outcome.adminPassword && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 mt-1">
              <div className="text-xs text-emerald-300 font-medium mb-1.5">
                First sign-in for {account.contactEmail}
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-2.5 py-1.5 rounded bg-black/40 text-sm font-mono tracking-wide">{outcome.adminPassword}</code>
                <Button size="sm" icon={<Copy size={12} />} onClick={() => navigator.clipboard?.writeText(outcome.adminPassword!)}>Copy</Button>
              </div>
              {/* Stating this plainly matters: an operator who assumes they
                  can look it up later will not write it down now. */}
              <p className="text-[11px] text-emerald-200/70 mt-2 leading-relaxed">
                Shown once and never stored. Give it to the clinic directly and have them change it on first sign-in.
              </p>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

/* ── Checklist ──────────────────────────────────────────────────────────── */

function Checklist({ accountId, steps, meta, onChange }: {
  accountId: string; steps: Detail['account']['steps']; meta: Meta; onChange: () => Promise<void>;
}) {
  const hint = (key: string) => meta.onboardingTemplate.find((t) => t.key === key)?.hint;
  const done = steps.filter((s) => s.done).length;

  const toggle = async (key: string, next: boolean) => {
    await apiFetch(`/accounts/${accountId}/steps/${key}`, { method: 'PATCH', data: { done: next } });
    await onChange();
  };

  return (
    <Panel title="Onboarding" icon={Check} badge={`${done}/${steps.length}`}>
      <div className="flex flex-col gap-1">
        {steps.map((s) => (
          <label key={s.id} className="group flex items-start gap-2.5 p-2 rounded-lg hover:bg-white/[0.03] cursor-pointer">
            <input type="checkbox" checked={s.done} onChange={(e) => toggle(s.key, e.target.checked)}
              className="mt-0.5 accent-emerald-500 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className={`text-[13px] ${s.done ? 'text-gray-500 line-through' : ''}`}>{s.label}</span>
                {/* Which steps the console does and which you do. Without
                    this an operator waits on a button that never existed. */}
                {s.automated && <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-blue-500/15 text-blue-400 shrink-0">AUTO</span>}
              </div>
              <div className="text-[11px] text-gray-600 hidden group-hover:block mt-0.5">{hint(s.key)}</div>
            </div>
          </label>
        ))}
      </div>
    </Panel>
  );
}

/* ── Plan and features ──────────────────────────────────────────────────── */

function Plan({ account, features, meta, onSave }: {
  account: Detail['account']; features: string[]; meta: Meta; onSave: (patch: Record<string, unknown>) => Promise<void>;
}) {
  const overrides = account.featureOverrides ?? {};

  const setOverride = async (key: string, value: boolean | null) => {
    const next = { ...overrides };
    if (value === null) delete next[key];
    else next[key] = value;
    await onSave({ featureOverrides: next });
  };

  return (
    <Panel title="Plan & features" icon={ShieldCheck}>
      <div className="flex flex-wrap gap-2 mb-4">
        {meta.plans.map((p) => (
          <Button key={p} variant="ghost" size="sm" onClick={() => onSave({ plan: p })}
            className={`border ${
              account.plan === p ? 'border-emerald-400 bg-emerald-500/10' : 'border-white/10 bg-white/[0.02]'
            }`}>
            {p} <span className="text-gray-500">· {money(meta.suggestedFees[p])}</span>
          </Button>
        ))}
      </div>

      <div className="flex flex-col gap-1">
        {meta.features.map((f) => {
          const included = features.includes(f.key);
          const overridden = f.key in overrides;
          const byPlan = meta.plans.indexOf(f.from) <= meta.plans.indexOf(account.plan);
          return (
            <div key={f.key} className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-white/[0.03]">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setOverride(f.key, overridden ? null : !byPlan)}
                className={`mt-0.5 !min-h-0 !px-0 h-5 w-5 rounded shrink-0 ${
                  included ? 'bg-emerald-500 text-black' : 'bg-white/10'
                }`}
                aria-label={`${included ? 'Remove' : 'Grant'} ${f.label}`}
              >
                {included && <Check size={11} />}
              </Button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[13px]">{f.label}</span>
                  <span className="text-[10px] text-gray-600">{f.from}+</span>
                  {overridden && <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-500/15 text-amber-400">DEAL</span>}
                  {/* Honest about which flags the clinic app actually acts
                      on. Promising an unenforced one in a sales call would
                      be promising something the software does not do. */}
                  {!f.enforced && <span className="text-[10px] text-gray-600" title="Ships to every tier today; not gated by the clinic API">not gated</span>}
                </div>
                <div className="text-[11px] text-gray-600">{f.description}</div>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-gray-600 mt-3 leading-relaxed">
        Ticking a feature outside the plan records it as a deal term, so a promise made in a sales call survives as
        configuration rather than as a note nobody reads.
      </p>
    </Panel>
  );
}

/* ── Deployment, deal, health, activity ─────────────────────────────────── */

function Deployment({ account, onSave }: { account: Detail['account']; onSave: (p: Record<string, unknown>) => Promise<void> }) {
  const [form, setForm] = useState({
    publicDomain: account.publicDomain ?? '',
    portalDomain: account.portalDomain ?? '',
    apiDomain: account.apiDomain ?? '',
  });

  return (
    <Panel title="Domains" icon={Globe}>
      <div className="flex flex-col gap-2.5">
        {([
          ['publicDomain', 'Patient website', 'drasif.in'],
          ['portalDomain', 'Staff portal', 'dashboard.drasif.in'],
          ['apiDomain', 'API', 'api.drasif.in'],
        ] as const).map(([key, label, placeholder]) => (
          <div key={key}>
            <label className="block text-xs font-medium text-gray-400 mb-1">{label}</label>
            <div className="flex gap-1.5">
              <input value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                onBlur={() => form[key] !== (account[key] ?? '') && onSave({ [key]: form[key] })}
                placeholder={placeholder} className={inputCls} />
              {account[key] && (
                <a href={`https://${account[key]}`} target="_blank" rel="noopener noreferrer"
                  className="px-2 rounded-lg bg-white/10 hover:bg-white/20 flex items-center" aria-label={`Open ${label}`}>
                  <ExternalLink size={12} />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-gray-600 mt-3 leading-relaxed">
        The website and portal share one deployment; the hostname decides which a visitor gets. DNS is always manual —
        it is the clinic's own registrar.
      </p>
    </Panel>
  );
}

function Deal({ account, onSave }: { account: Detail['account']; onSave: (p: Record<string, unknown>) => Promise<void> }) {
  const [fee, setFee] = useState(account.monthlyFee ?? '');
  return (
    <Panel title="Deal" icon={Activity}>
      <div className="grid grid-cols-2 gap-2.5">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-400 mb-1">Monthly fee (₹)</label>
          <input type="number" min="0" value={fee} onChange={(e) => setFee(e.target.value)}
            onBlur={() => String(fee) !== String(account.monthlyFee ?? '') && onSave({ monthlyFee: fee === '' ? null : Number(fee) })}
            className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Started</label>
          <input type="date" value={account.startedAt?.slice(0, 10) ?? ''}
            onChange={(e) => onSave({ startedAt: e.target.value || null })} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Renews</label>
          <input type="date" value={account.renewsAt?.slice(0, 10) ?? ''}
            onChange={(e) => onSave({ renewsAt: e.target.value || null })} className={inputCls} />
        </div>
      </div>
    </Panel>
  );
}

function Health({ account }: { account: Detail['account'] }) {
  const latest = account.health[0];
  return (
    <Panel title="Health" icon={Activity}>
      {!account.apiDomain && <p className="text-xs text-gray-600">Add the API domain to start monitoring.</p>}
      {account.apiDomain && !latest && <p className="text-xs text-gray-600">Not checked yet. Only LIVE clinics are polled.</p>}
      {latest && (
        <>
          <div className={`flex items-center gap-2 text-sm ${latest.ok ? 'text-emerald-400' : 'text-red-400'}`}>
            <span className={`h-2 w-2 rounded-full ${latest.ok ? 'bg-emerald-400' : 'bg-red-400'}`} />
            {latest.ok ? `Responding in ${latest.latencyMs}ms` : (latest.error ?? 'Not responding')}
          </div>
          <div className="text-[11px] text-gray-600 mt-1">Checked {new Date(latest.checkedAt).toLocaleString()}</div>
          <div className="flex gap-0.5 mt-3" title="Most recent checks, newest on the right">
            {[...account.health].reverse().map((h) => (
              <span key={h.id} className={`h-6 flex-1 rounded-sm ${h.ok ? 'bg-emerald-500/40' : 'bg-red-500/60'}`} />
            ))}
          </div>
        </>
      )}
      <p className="text-[11px] text-gray-600 mt-3 leading-relaxed">
        Only the public <code>/health</code> endpoint is read. This console never sees patient data.
      </p>
    </Panel>
  );
}

function ActivityFeed({ entries }: { entries: Detail['account']['activity'] }) {
  return (
    <Panel title="Activity" icon={History}>
      <div className="flex flex-col gap-2">
        {entries.map((e) => (
          <div key={e.id} className="text-[11px]">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-gray-300">{e.action}</span>
              {!e.applied && <span className="px-1 py-0.5 rounded text-[9px] bg-white/10 text-gray-500">rehearsal</span>}
            </div>
            {e.detail && <div className="text-gray-600 truncate">{e.detail}</div>}
            <div className="text-gray-700">{e.actorName} · {new Date(e.at).toLocaleString()}</div>
          </div>
        ))}
        {entries.length === 0 && <p className="text-xs text-gray-600">Nothing yet.</p>}
      </div>
    </Panel>
  );
}

/* ── Shared ─────────────────────────────────────────────────────────────── */

const inputCls = 'w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm outline-none focus:border-emerald-400';

function Panel({ title, icon: Icon, badge, children }: {
  title: string; icon: any; badge?: string; children: React.ReactNode;
}) {
  return (
    <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
      <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">
        <Icon size={14} className="text-emerald-400" /> {title}
        {badge && <span className="ml-auto text-[11px] text-gray-500 font-normal">{badge}</span>}
      </h2>
      {children}
    </div>
  );
}
