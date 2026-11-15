import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check } from 'lucide-react';
import { apiFetch, ApiError } from '../lib/api';
import { useClinicAuth } from '../contexts/ClinicAuthContext';
import { Button } from '../components/Button';
import { Pick } from '../components/Field';
import { SegmentedControl } from '../components/SegmentedControl';
import { SkeletonList } from '../components/Skeleton';
import { useToast } from '../components/Toast';
import { Input } from '../components/ui/input';
import { Chip, FIELD, FieldLabel, PageHeader, Panel, PatientPicker, Sums, dateTime, rupees, shortDate, type PickedPatient } from '../components/hosp';

interface Claim {
  id: string; payer: 'INSURANCE' | 'SCHEME'; payerName: string; scheme: string | null; memberId: string | null;
  packageCode: string | null; packageName: string | null; packageRate: string | null;
  preauthStatus: string; preauthNumber: string | null; preauthAmount: string | null; preauthValidTill: string | null;
  claimStatus: string; claimAmount: string | null; claimSubmittedAt: string | null; approvedAmount: string | null; settledAmount: string | null; settledAt: string | null;
  settlementRef: string | null; deductionReason: string | null; documents: { name: string; done: boolean }[] | null; notes: string | null;
  updatedAt: string; ageDays?: number | null;
  patient: { id: string; name: string; uhid: string };
  admission: { id: string; ipNumber: string; status: string; admittedAt: string; dischargedAt: string | null; finalDiagnosis?: string | null; provisionalDiagnosis?: string | null } | null;
  events?: { id: string; at: string; byName: string; what: string; note: string | null }[];
}
interface Summary { open: number; pendingPreauth: number; queries: number; owed: number; buckets: { under30: number; d30to60: number; d60to90: number; over90: number } }
interface Pkg { id: string; scheme: string; code: string; name: string; rate: string }

export const PREAUTH_WORDS: Record<string, string> = { NOT_NEEDED: 'Not needed', DRAFT: 'Draft', SUBMITTED: 'Submitted', QUERY: 'Query', APPROVED: 'Approved', ENHANCEMENT: 'Enhancement asked', REJECTED: 'Rejected' };
export const CLAIM_WORDS: Record<string, string> = { NOT_SUBMITTED: 'Not submitted', SUBMITTED: 'Submitted', QUERY: 'Query', APPROVED: 'Approved', SETTLED: 'Settled', REJECTED: 'Rejected' };
const SCHEME_WORDS: Record<string, string> = { PMJAY: 'PM-JAY', MJPJAY: 'MJPJAY', CGHS: 'CGHS', ECHS: 'ECHS', OTHER: 'Other scheme' };
const tone = (s: string) => (s === 'APPROVED' || s === 'SETTLED' ? 'good' : s === 'QUERY' || s === 'REJECTED' ? 'bad' : s === 'SUBMITTED' || s === 'ENHANCEMENT' ? 'info' : 'quiet');

/*
 * The claims desk: insurance and government schemes.
 *
 * The claim itself is filed on the payer's portal; this is the hospital's
 * own record of it. The list is ordered by what needs doing -- a query to
 * answer, a pre-auth to chase -- and the summary ages what payers owe,
 * which is how a hospital's receivables are actually chased.
 */
export function Claims() {
  const { hasModule } = useClinicAuth();
  const [claims, setClaims] = useState<Claim[] | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const both = hasModule('insurance') && hasModule('schemes');
  const [payer, setPayer] = useState<'ALL' | 'INSURANCE' | 'SCHEME'>('ALL');
  const [creating, setCreating] = useState(false);
  const [showPkgs, setShowPkgs] = useState(false);

  const load = useCallback(async () => {
    const q = payer === 'ALL' ? '' : `?payer=${payer}`;
    const [c, s] = await Promise.all([apiFetch<{ data: Claim[] }>(`/claims${q}`), apiFetch<Summary>('/claims-summary')]);
    setClaims(c.data); setSummary(s);
  }, [payer]);
  useEffect(() => { void load().catch(() => setClaims([])); }, [load]);

  const rank = (c: Claim) => (c.preauthStatus === 'QUERY' || c.claimStatus === 'QUERY' ? 0 : c.claimStatus === 'SETTLED' || c.claimStatus === 'REJECTED' ? 3 : c.preauthStatus === 'SUBMITTED' ? 1 : 2);
  const sorted = [...(claims ?? [])].sort((a, b) => rank(a) - rank(b));

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-[1300px]">
      <PageHeader
        title="Claims"
        sub={summary ? `${summary.open} open · ${summary.queries} with a query · ${rupees(summary.owed)} submitted and not yet settled` : 'Insurance and schemes'}
      >
        {hasModule('schemes') && <Button variant="secondary" onClick={() => setShowPkgs((v) => !v)}>Scheme packages</Button>}
        <Button variant="primary" onClick={() => setCreating((v) => !v)}>Open a claim</Button>
      </PageHeader>

      {both && (
        <SegmentedControl label="Which desk" className="mb-5" value={payer} onChange={setPayer}
          options={[{ value: 'ALL', label: 'All' }, { value: 'INSURANCE', label: 'Insurance' }, { value: 'SCHEME', label: 'Schemes' }]} />
      )}

      {summary && summary.owed > 0 && (
        <p className="mb-5 text-[14px] text-muted-foreground">
          Owed by payers: <span className="font-medium text-foreground">{rupees(summary.buckets.under30)}</span> under 30 days ·{' '}
          <span className="font-medium text-foreground">{rupees(summary.buckets.d30to60)}</span> 30–60 ·{' '}
          <span className={summary.buckets.d60to90 > 0 ? 'font-semibold text-ink-warning' : 'font-medium text-foreground'}>{rupees(summary.buckets.d60to90)}</span> 60–90 ·{' '}
          <span className={summary.buckets.over90 > 0 ? 'font-semibold text-ink-danger' : 'font-medium text-foreground'}>{rupees(summary.buckets.over90)}</span> over 90
        </p>
      )}

      {creating && <NewClaim onClose={() => setCreating(false)} />}
      {showPkgs && <Packages />}

      {!claims ? <SkeletonList rows={5} label="Loading claims" /> : sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/25 px-6 py-10 text-center text-[14px] text-muted-foreground">No claims yet. Open one from an admission, or here.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/15 bg-card">
          <table className="w-full min-w-[820px] text-[14px]">
            <thead><tr className="border-b border-border/15 text-left text-[12.5px] text-muted-foreground"><th className="px-4 py-2 font-medium">Patient</th><th className="px-2 py-2 font-medium">Payer</th><th className="px-2 py-2 font-medium">Pre-auth</th><th className="px-2 py-2 font-medium">Claim</th><th className="px-2 py-2 text-right font-medium">Amount</th><th className="px-4 py-2 text-right font-medium">Waiting</th></tr></thead>
            <tbody>
              {sorted.map((c) => (
                <tr key={c.id} className="border-b border-border/10 hover:bg-foreground/[0.02]">
                  <td className="px-4 py-2.5"><Link to={`/claims/${c.id}`} className="font-medium hover:underline">{c.patient.name}</Link><span className="block text-[12.5px] text-muted-foreground">{c.admission?.ipNumber ?? c.patient.uhid}</span></td>
                  <td className="px-2 py-2.5">{c.payer === 'SCHEME' ? SCHEME_WORDS[c.scheme ?? 'OTHER'] : c.payerName}{c.packageName && <span className="block truncate text-[12.5px] text-muted-foreground max-w-[220px]">{c.packageName}</span>}</td>
                  <td className="px-2 py-2.5"><Chip tone={tone(c.preauthStatus)}>{PREAUTH_WORDS[c.preauthStatus]}</Chip></td>
                  <td className="px-2 py-2.5"><Chip tone={tone(c.claimStatus)}>{CLAIM_WORDS[c.claimStatus]}</Chip></td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{rupees(c.settledAmount ?? c.approvedAmount ?? c.claimAmount ?? c.preauthAmount ?? c.packageRate ?? 0)}</td>
                  <td className={`px-4 py-2.5 text-right tabular-nums ${(c.ageDays ?? 0) >= 60 ? 'font-semibold text-ink-warning' : 'text-muted-foreground'}`}>{c.ageDays != null ? `${c.ageDays} days` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function NewClaim({ onClose }: { onClose: () => void }) {
  const { hasModule } = useClinicAuth();
  const navigate = useNavigate();
  const [patient, setPatient] = useState<PickedPatient | null>(null);
  const [admissions, setAdmissions] = useState<{ value: string; label: string }[]>([]);
  const [pkgs, setPkgs] = useState<Pkg[]>([]);
  const [f, setF] = useState({ payer: hasModule('insurance') ? 'INSURANCE' : 'SCHEME', payerName: '', scheme: 'PMJAY', memberId: '', admissionId: '', packageId: '' });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!patient) { setAdmissions([]); return; }
    apiFetch<{ data: { id: string; ipNumber: string; status: string; admittedAt: string }[] }>(`/admissions?patientId=${patient.id}`)
      .then((r) => setAdmissions(r.data.map((a) => ({ value: a.id, label: `${a.ipNumber} · ${shortDate(a.admittedAt)}${a.status === 'ADMITTED' ? ' (admitted)' : ''}` })))).catch(() => {});
  }, [patient]);
  useEffect(() => {
    if (f.payer !== 'SCHEME') return;
    apiFetch<{ data: Pkg[] }>(`/scheme-packages?scheme=${f.scheme}`).then((r) => setPkgs(r.data)).catch(() => setPkgs([]));
  }, [f.payer, f.scheme]);

  const submit = async () => {
    setError(null);
    if (!patient) { setError('Choose the patient.'); return; }
    try {
      const c = await apiFetch<{ id: string }>('/claims', {
        method: 'POST',
        data: {
          patientId: patient.id, payer: f.payer, payerName: f.payer === 'SCHEME' ? SCHEME_WORDS[f.scheme] : f.payerName,
          scheme: f.payer === 'SCHEME' ? f.scheme : undefined, memberId: f.memberId || undefined, admissionId: f.admissionId || undefined, packageId: f.packageId || undefined,
        },
      });
      navigate(`/claims/${c.id}`);
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Could not open the claim.'); }
  };
  return (
    <Panel title="Open a claim" aside={<button type="button" onClick={onClose} className="hover:text-foreground">Close</button>} className="mb-6">
      <div className="space-y-4">
        <div><FieldLabel>Patient</FieldLabel><PatientPicker value={patient} onChange={setPatient} autoFocus /></div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <FieldLabel>Payer</FieldLabel>
            <div className="flex gap-1.5">
              {hasModule('insurance') && <button type="button" aria-pressed={f.payer === 'INSURANCE'} onClick={() => setF({ ...f, payer: 'INSURANCE' })} className={`rounded-md px-3 py-1.5 text-[13px] font-medium ${f.payer === 'INSURANCE' ? 'bg-primary text-primary-foreground' : 'bg-secondary hover:bg-secondary/80'}`}>Insurance / TPA</button>}
              {hasModule('schemes') && <button type="button" aria-pressed={f.payer === 'SCHEME'} onClick={() => setF({ ...f, payer: 'SCHEME' })} className={`rounded-md px-3 py-1.5 text-[13px] font-medium ${f.payer === 'SCHEME' ? 'bg-primary text-primary-foreground' : 'bg-secondary hover:bg-secondary/80'}`}>Government scheme</button>}
            </div>
          </div>
          {f.payer === 'INSURANCE'
            ? <div><FieldLabel htmlFor="nc-payer">Insurer and TPA</FieldLabel><Input id="nc-payer" value={f.payerName} onChange={(e) => setF({ ...f, payerName: e.target.value })} /></div>
            : <div><FieldLabel>Scheme</FieldLabel><Pick value={f.scheme} onChange={(v) => setF({ ...f, scheme: v, packageId: '' })} options={Object.entries(SCHEME_WORDS).map(([value, label]) => ({ value, label }))} /></div>}
          <div><FieldLabel htmlFor="nc-mem">{f.payer === 'SCHEME' ? 'Beneficiary / card no.' : 'Policy no.'}</FieldLabel><Input id="nc-mem" value={f.memberId} onChange={(e) => setF({ ...f, memberId: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div><FieldLabel>Admission</FieldLabel><Pick value={f.admissionId} onChange={(v) => setF({ ...f, admissionId: v })} emptyLabel="Not linked" options={admissions} /></div>
          {f.payer === 'SCHEME' && <div><FieldLabel>Package</FieldLabel><Pick value={f.packageId} onChange={(v) => setF({ ...f, packageId: v })} emptyLabel={pkgs.length ? 'Choose later' : 'No packages loaded for this scheme'} options={pkgs.map((p) => ({ value: p.id, label: `${p.code} · ${p.name} · ${rupees(p.rate)}` }))} /></div>}
        </div>
        {error && <p role="alert" className="rounded-md tone-danger px-3 py-2 text-[13px]">{error}</p>}
        <Button variant="primary" onClick={submit} disabled={f.payer === 'INSURANCE' && !f.payerName.trim()}>Open claim</Button>
      </div>
    </Panel>
  );
}

/** The hospital's own copy of scheme package rates. */
function Packages() {
  const toast = useToast();
  const [pkgs, setPkgs] = useState<Pkg[]>([]);
  const [f, setF] = useState({ scheme: 'PMJAY', code: '', name: '', rate: '', documents: '' });
  const load = useCallback(() => apiFetch<{ data: Pkg[] }>('/scheme-packages').then((r) => setPkgs(r.data)).catch(() => {}), []);
  useEffect(() => { void load(); }, [load]);
  const add = async () => {
    try {
      await apiFetch('/scheme-packages', { method: 'POST', data: { ...f, rate: Number(f.rate), documents: f.documents.split('\n').map((d) => d.trim()).filter(Boolean) } });
      toast.success('Package saved.'); setF({ ...f, code: '', name: '', rate: '', documents: '' }); await load();
    } catch (e) { toast.error(e instanceof ApiError ? e.message : 'Could not save.'); }
  };
  return (
    <Panel title="Scheme packages" aside="your own copy of each scheme's current rate list" className="mb-6">
      <p className="mb-3 text-[13px] text-muted-foreground">Enter packages from the scheme's latest list. Rates change by circular; a package entered from an old list makes a wrong claim.</p>
      {pkgs.length > 0 && (
        <ul className="mb-4 divide-y divide-border/10 text-[14px]">
          {pkgs.map((p) => <li key={p.id} className="flex justify-between gap-3 py-1.5"><span><span className="font-medium">{SCHEME_WORDS[p.scheme]} {p.code}</span> · {p.name}</span><span className="tabular-nums">{rupees(p.rate)}</span></li>)}
        </ul>
      )}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[130px_120px_minmax(0,1fr)_120px]">
        <div><FieldLabel>Scheme</FieldLabel><Pick value={f.scheme} onChange={(v) => setF({ ...f, scheme: v })} options={Object.entries(SCHEME_WORDS).map(([value, label]) => ({ value, label }))} /></div>
        <div><FieldLabel htmlFor="pk-code">Code</FieldLabel><Input id="pk-code" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} /></div>
        <div><FieldLabel htmlFor="pk-name">Package</FieldLabel><Input id="pk-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div><FieldLabel htmlFor="pk-rate">Rate, ₹</FieldLabel><input id="pk-rate" inputMode="decimal" value={f.rate} onChange={(e) => setF({ ...f, rate: e.target.value.replace(/[^\d.]/g, '') })} className={FIELD} /></div>
      </div>
      <div className="mt-2"><FieldLabel htmlFor="pk-docs" hint="(one per line)">Documents a claim needs</FieldLabel><textarea id="pk-docs" rows={3} value={f.documents} onChange={(e) => setF({ ...f, documents: e.target.value })} className="w-full rounded-md border border-input/60 bg-background px-3 py-2 text-[14px] outline-none focus:border-ring" /></div>
      <Button className="mt-3" variant="secondary" onClick={add} disabled={!f.code.trim() || !f.name.trim() || !f.rate}>Save package</Button>
    </Panel>
  );
}

/** One claim: pre-auth, claim, documents, history. */
export function ClaimPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const [c, setC] = useState<Claim | null>(null);
  const [f, setF] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const load = useCallback(async () => {
    const claim = await apiFetch<Claim>(`/claims/${id}`);
    setC(claim);
    const n = (v: string | null) => (v === null ? '' : String(Number(v)));
    setF({
      preauthStatus: claim.preauthStatus, preauthNumber: claim.preauthNumber ?? '', preauthAmount: n(claim.preauthAmount), preauthValidTill: claim.preauthValidTill?.slice(0, 10) ?? '',
      claimStatus: claim.claimStatus, claimAmount: n(claim.claimAmount), approvedAmount: n(claim.approvedAmount), settledAmount: n(claim.settledAmount),
      settlementRef: claim.settlementRef ?? '', deductionReason: claim.deductionReason ?? '', memberId: claim.memberId ?? '',
    });
  }, [id]);
  useEffect(() => { void load().catch(() => {}); }, [load]);
  if (!c) return <div className="p-4 sm:p-6 md:p-8"><SkeletonList rows={4} label="Loading the claim" /></div>;

  const save = async (extra: Record<string, unknown> = {}) => {
    const num = (v: string) => (v === '' ? null : Number(v));
    try {
      await apiFetch(`/claims/${c.id}`, {
        method: 'PUT',
        data: {
          preauthStatus: f.preauthStatus, preauthNumber: f.preauthNumber || null, preauthAmount: num(f.preauthAmount!), preauthValidTill: f.preauthValidTill || null,
          claimStatus: f.claimStatus, claimAmount: num(f.claimAmount!), approvedAmount: num(f.approvedAmount!), settledAmount: num(f.settledAmount!),
          settlementRef: f.settlementRef || null, deductionReason: f.deductionReason || null, memberId: f.memberId || null, note: note || undefined, ...extra,
        },
      });
      toast.success('Saved.'); setNote(''); await load();
    } catch (e) { toast.error(e instanceof ApiError ? e.message : 'Could not save.'); }
  };
  const toggleDoc = (i: number) => {
    const docs = (c.documents ?? []).map((d, j) => (j === i ? { ...d, done: !d.done } : d));
    void save({ documents: docs });
  };
  const docs = c.documents ?? [];
  const field = (k: string, label: string, numeric = false) => (
    <div><FieldLabel htmlFor={`cl-${k}`}>{label}</FieldLabel><input id={`cl-${k}`} inputMode={numeric ? 'decimal' : undefined} value={f[k] ?? ''} onChange={(e) => setF({ ...f, [k]: numeric ? e.target.value.replace(/[^\d.]/g, '') : e.target.value })} className={FIELD} /></div>
  );
  const owed = Number(c.approvedAmount ?? c.claimAmount ?? 0) - Number(c.settledAmount ?? 0);

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-6xl">
      <Link to="/claims" className="mb-4 inline-flex items-center gap-1 text-[14px] text-muted-foreground hover:text-foreground"><ArrowLeft size={14} /> Claims</Link>
      <PageHeader title={c.patient.name} sub={`${c.payer === 'SCHEME' ? SCHEME_WORDS[c.scheme ?? 'OTHER'] : c.payerName}${c.memberId ? ` · ${c.memberId}` : ''}${c.admission ? ` · ${c.admission.ipNumber}` : ''}`} />
      {c.packageName && <p className="-mt-3 mb-5 text-[15px]"><span className="text-muted-foreground">Package: </span>{c.packageCode} · {c.packageName}{c.packageRate ? ` · ${rupees(c.packageRate)}` : ''}</p>}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <Panel title="Pre-authorisation" aside={<Chip tone={tone(c.preauthStatus)}>{PREAUTH_WORDS[c.preauthStatus]}</Chip>}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div><FieldLabel>Status</FieldLabel><Pick value={f.preauthStatus!} onChange={(v) => setF({ ...f, preauthStatus: v })} options={Object.entries(PREAUTH_WORDS).map(([value, label]) => ({ value, label }))} /></div>
              {field('preauthNumber', 'Pre-auth no.')}
              {field('preauthAmount', 'Approved, ₹', true)}
              <div><FieldLabel htmlFor="cl-valid">Valid till</FieldLabel><input id="cl-valid" type="date" value={f.preauthValidTill ?? ''} onChange={(e) => setF({ ...f, preauthValidTill: e.target.value })} className={FIELD} /></div>
            </div>
          </Panel>
          <Panel title="Claim" aside={<Chip tone={tone(c.claimStatus)}>{CLAIM_WORDS[c.claimStatus]}</Chip>}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div><FieldLabel>Status</FieldLabel><Pick value={f.claimStatus!} onChange={(v) => setF({ ...f, claimStatus: v })} options={Object.entries(CLAIM_WORDS).map(([value, label]) => ({ value, label }))} /></div>
              {field('claimAmount', 'Claimed, ₹', true)}
              {field('approvedAmount', 'Approved, ₹', true)}
              {field('settledAmount', 'Settled, ₹', true)}
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {field('settlementRef', 'UTR / settlement ref.')}
              {field('deductionReason', 'Deductions, and why')}
            </div>
            <div className="mt-3"><FieldLabel htmlFor="cl-note" hint="(goes in the history)">Note</FieldLabel><Input id="cl-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Query answered with the USG report…" /></div>
            <Button className="mt-4" variant="primary" onClick={() => save()}>Save</Button>
          </Panel>
          <Panel title="Documents" aside={`${docs.filter((d) => d.done).length} of ${docs.length} ready`}>
            <ul className="space-y-1">
              {docs.map((d, i) => (
                <li key={d.name}>
                  <button type="button" onClick={() => toggleDoc(i)} aria-pressed={d.done} className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[14px] hover:bg-foreground/[0.04]">
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${d.done ? 'border-transparent bg-primary text-primary-foreground' : 'border-input'}`}>{d.done && <Check size={13} />}</span>
                    <span className={d.done ? 'text-muted-foreground line-through' : ''}>{d.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
        <aside className="space-y-5">
          <Panel title="Money">
            <Sums rows={[
              { label: 'Pre-auth approved', value: c.preauthAmount ? rupees(c.preauthAmount) : '—' },
              { label: 'Claimed', value: c.claimAmount ? rupees(c.claimAmount) : '—' },
              { label: 'Settled', value: c.settledAmount ? rupees(c.settledAmount) : '—' },
              ...(c.claimStatus !== 'SETTLED' && owed > 0 ? [{ label: 'Still owed by the payer', value: rupees(owed), strong: true, tone: 'warn' as const }] : []),
            ]} />
            {c.preauthValidTill && <p className="mt-3 text-[13px] text-muted-foreground">Pre-auth valid till {shortDate(c.preauthValidTill)}.</p>}
          </Panel>
          {c.admission && (
            <Panel title="Stay">
              <p className="text-[14px]"><Link to={`/ipd/${c.admission.id}`} className="font-medium hover:underline">{c.admission.ipNumber}</Link> · {c.admission.status === 'ADMITTED' ? 'admitted' : `discharged ${shortDate(c.admission.dischargedAt)}`}</p>
              <p className="text-[13px] text-muted-foreground">{c.admission.finalDiagnosis ?? c.admission.provisionalDiagnosis}</p>
            </Panel>
          )}
          <Panel title="History">
            <ul className="space-y-2 text-[13.5px]">
              {(c.events ?? []).map((e) => (
                <li key={e.id}><span className="font-medium">{e.what}</span>{e.note && <span className="block">{e.note}</span>}<span className="block text-[12.5px] text-muted-foreground">{e.byName} · {dateTime(e.at)}</span></li>
              ))}
            </ul>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
