import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Printer, Trash2 } from 'lucide-react';
import { apiFetch, ApiError } from '../lib/api';
import { useClinicAuth } from '../contexts/ClinicAuthContext';
import { Button } from '../components/Button';
import { Pick } from '../components/Field';
import { SkeletonPanels } from '../components/Skeleton';
import { useToast } from '../components/Toast';
import { Input } from '../components/ui/input';
import { Chip, FIELD, FieldLabel, Panel, Sums, dateTime, rupees, shortDate, since } from '../components/hosp';

interface Admission {
  id: string; ipNumber: string; status: string; admittedAt: string; dischargedAt: string | null; reason: string | null; provisionalDiagnosis: string | null;
  payerType: string; estimatedCost: string | null; finalDiagnosis: string | null; treatmentGiven: string | null; conditionAtDischarge: string | null;
  dischargeAdvice: string | null; followUpDate: string | null;
  patient: { id: string; name: string; uhid: string; age: number | null; gender: string | null; phone: string | null; allergies: string | null; chronicConditions: string | null; bloodGroup: string | null };
  admittingDoctor: { name: string } | null; department: { name: string } | null;
  bed: { id: string; label: string; ward: { name: string } } | null;
  invoices: { id: string; createdAt: string }[];
  claims: { id: string; payer: string; payerName: string; preauthStatus: string; claimStatus: string; preauthAmount: string | null; approvedAmount: string | null }[];
  otBookings: { id: string; procedure: string; theatre: string; scheduledAt: string; status: string; surgeon: { name: string } | null }[];
  radiologyOrders: { id: string; modality: string; study: string; status: string; impression: string | null }[];
}
interface Bill { room: { wardName: string; dailyRate: number; days: number; amount: number; from: string; to: string }[]; roomTotal: number; chargesTotal: number; total: number; depositHeld: number; balance: number; needsTopUp: boolean }
interface Charge { id: string; category: string; description: string; quantity: number; rate: string; at: string; byName: string }
interface Detail { admission: Admission; bill: Bill; charges: Charge[]; moves: { id: string; wardName: string; dailyRate: string; at: string; byName: string }[] }
interface NursingEntry { id: string; kind: string; at: string; byName: string; vitals: Record<string, string> | null; note: string | null; drugName: string | null; dose: string | null; route: string | null }
interface BoardWard { name: string; dailyRate: string; beds: { id: string; label: string; blockedReason: string | null; admission: unknown }[] }

const CATEGORY_WORDS: Record<string, string> = { NURSING: 'Nursing', DOCTOR_VISIT: 'Doctor visit', PROCEDURE: 'Procedure', MEDICINE: 'Medicine', CONSUMABLE: 'Consumable', LAB: 'Lab', RADIOLOGY: 'Radiology', OT: 'Theatre', OTHER: 'Other' };
const STATUS_WORDS: Record<string, string> = { NOT_NEEDED: 'not needed', DRAFT: 'draft', SUBMITTED: 'submitted', QUERY: 'query', APPROVED: 'approved', ENHANCEMENT: 'enhancement', REJECTED: 'rejected', NOT_SUBMITTED: 'not submitted', SETTLED: 'settled' };

/*
 * One inpatient stay.
 *
 * What the ward, the billing desk and the doctor each need, on one page:
 * the patient and their allergies at the top, the bed, the running bill
 * against the deposit (with a plain warning when the family must be asked
 * for more), the services posted, the nursing chart, theatre and imaging,
 * and the discharge.
 */
export function AdmissionPage() {
  const { id } = useParams<{ id: string }>();
  const { hasModule, canWriteClinical } = useClinicAuth();
  const toast = useToast();
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<'none' | 'charge' | 'transfer' | 'discharge'>('none');

  const load = useCallback(async () => {
    try { setData(await apiFetch<Detail>(`/admissions/${id}`)); setError(null); }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Could not load this admission.'); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  if (!data) return <div className="p-4 sm:p-6 md:p-8 max-w-6xl">{error ? <p className="text-muted-foreground">{error}</p> : <SkeletonPanels count={3} label="Loading the admission" />}</div>;
  const { admission: a, bill, charges, moves } = data;
  const open = a.status === 'ADMITTED';

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-6xl">
      <Link to="/ipd" className="mb-4 inline-flex items-center gap-1 text-[14px] text-muted-foreground hover:text-foreground"><ArrowLeft size={14} /> Bed board</Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="break-words">{a.patient.name}</h1>
          <p className="mt-2 text-[15px] text-muted-foreground">
            {[a.ipNumber, a.patient.age != null ? `${a.patient.age} years` : null, a.patient.gender, a.patient.bloodGroup ? `Blood ${a.patient.bloodGroup}` : null].filter(Boolean).join(' · ')}
          </p>
          <p className="mt-1 text-[14px]">
            {open ? <Chip tone="info">Admitted {since(a.admittedAt)}</Chip> : <Chip tone="quiet">Discharged {shortDate(a.dischargedAt)}</Chip>}{' '}
            <span className="text-muted-foreground">{[a.bed ? `${a.bed.ward.name}, bed ${a.bed.label}` : open ? 'No bed yet' : null, a.admittingDoctor ? `Dr. ${a.admittingDoctor.name}` : null, a.department?.name].filter(Boolean).join(' · ')}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {open && <Button variant="secondary" onClick={() => setPanel(panel === 'charge' ? 'none' : 'charge')}>Post a charge</Button>}
          {open && <Button variant="secondary" onClick={() => setPanel(panel === 'transfer' ? 'none' : 'transfer')}>Move bed</Button>}
          {open && <Button variant="primary" onClick={() => setPanel(panel === 'discharge' ? 'none' : 'discharge')}>Discharge</Button>}
          {!open && <Button variant="secondary" icon={<Printer size={14} />} onClick={() => window.print()}>Print discharge summary</Button>}
        </div>
      </header>

      {(a.patient.allergies || a.patient.chronicConditions) && (
        <div role="note" className="mt-5 flex items-start gap-2.5 rounded-xl border border-ink-danger/30 bg-ink-danger/10 px-4 py-3 text-ink-danger">
          <AlertTriangle size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
          <div className="text-[15px] leading-snug">
            {a.patient.allergies && <p><span className="font-semibold">Allergic to:</span> {a.patient.allergies}</p>}
            {a.patient.chronicConditions && <p><span className="font-semibold">Long-term conditions:</span> {a.patient.chronicConditions}</p>}
          </div>
        </div>
      )}

      {bill.needsTopUp && open && (
        <div role="status" className="mt-4 rounded-xl tone-warning tone-block px-4 py-3 text-[15px]">
          <span className="font-semibold">The bill has passed the deposit by {rupees(bill.balance)}.</span> Ask the family for a top-up at the cash counter.
        </div>
      )}

      <div className="mt-5 space-y-5">
        {panel === 'charge' && <ChargeForm admissionId={a.id} onDone={async () => { setPanel('none'); toast.success('Charge posted.'); await load(); }} onClose={() => setPanel('none')} />}
        {panel === 'transfer' && <TransferForm admissionId={a.id} currentBedId={a.bed?.id ?? null} onDone={async () => { setPanel('none'); toast.success('Moved.'); await load(); }} onClose={() => setPanel('none')} />}
        {panel === 'discharge' && <DischargeForm admission={a} bill={bill} onDone={async () => { setPanel('none'); toast.success('Discharged. The final bill is ready at the cash counter.'); await load(); }} onClose={() => setPanel('none')} />}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          {!open && <DischargeSummary a={a} />}
          <Panel title="Services posted" aside={`${charges.length} item${charges.length === 1 ? '' : 's'}`}>
            {charges.length === 0 ? <p className="text-[14px] text-muted-foreground">Nothing posted yet. Room days are added automatically.</p> : (
              <table className="w-full text-[14px]">
                <thead><tr className="border-b border-border/15 text-left text-[12.5px] text-muted-foreground"><th className="py-1.5 pr-2 font-medium">When</th><th className="py-1.5 pr-2 font-medium">Service</th><th className="py-1.5 pr-2 text-right font-medium">Qty</th><th className="py-1.5 text-right font-medium">Amount</th><th className="w-8" /></tr></thead>
                <tbody>
                  {charges.map((c) => (
                    <tr key={c.id} className="border-b border-border/10 align-top">
                      <td className="py-2 pr-2 text-[13px] text-muted-foreground whitespace-nowrap">{dateTime(c.at)}</td>
                      <td className="py-2 pr-2">{c.description} <span className="text-[12.5px] text-muted-foreground">· {CATEGORY_WORDS[c.category]}</span></td>
                      <td className="py-2 pr-2 text-right tabular-nums">{c.quantity}</td>
                      <td className="py-2 text-right tabular-nums">{rupees(Number(c.rate) * c.quantity)}</td>
                      <td className="py-2 text-right">
                        {open && (
                          <button type="button" aria-label={`Remove ${c.description}`} className="rounded p-1 text-muted-foreground hover:bg-foreground/[0.06] hover:text-ink-danger"
                            onClick={async () => { try { await apiFetch(`/admissions/${a.id}/charges/${c.id}`, { method: 'DELETE' }); toast.success('Removed.'); await load(); } catch (e) { toast.error(e instanceof ApiError ? e.message : 'Could not remove.'); } }}>
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
          {hasModule('nursing') && <NursingChart admissionId={a.id} open={open} />}
          {(a.otBookings.length > 0 || a.radiologyOrders.length > 0) && (
            <Panel title="Theatre and imaging">
              <ul className="space-y-1.5 text-[14px]">
                {a.otBookings.map((o) => <li key={o.id}><span className="font-medium">{o.procedure}</span> <span className="text-muted-foreground">· {o.theatre}, {dateTime(o.scheduledAt)}{o.surgeon ? `, Dr. ${o.surgeon.name}` : ''} · {o.status.toLowerCase().replace('_', ' ')}</span></li>)}
                {a.radiologyOrders.map((r) => <li key={r.id}><span className="font-medium">{r.study}</span> <span className="text-muted-foreground">· {r.status.toLowerCase()}{r.impression ? `: ${r.impression}` : ''}</span></li>)}
              </ul>
            </Panel>
          )}
        </div>

        <aside className="space-y-5">
          <Panel title="Running bill" aside={open ? 'to now' : 'final'}>
            <Sums rows={[
              ...bill.room.filter((r) => r.days > 0).map((r) => ({ label: `${r.wardName}, ${r.days} day${r.days === 1 ? '' : 's'}`, value: rupees(r.amount) })),
              { label: 'Services', value: rupees(bill.chargesTotal) },
              { label: 'Total', value: rupees(bill.total), strong: true },
              { label: 'Deposit held', value: rupees(bill.depositHeld) },
              bill.balance > 0
                ? { label: 'Still to pay', value: rupees(bill.balance), strong: true, tone: 'warn' as const }
                : { label: 'To refund', value: rupees(-bill.balance), strong: true, tone: 'good' as const },
            ]} />
            {a.estimatedCost && <p className="mt-3 text-[13px] text-muted-foreground">Estimate given at admission: {rupees(a.estimatedCost)}</p>}
            {a.invoices.length > 0 && <p className="mt-2 text-[13px]"><Link to="/counter" className="font-medium underline underline-offset-4">Settle the final bill at the counter</Link></p>}
          </Panel>
          {a.claims.length > 0 && (
            <Panel title="Claims">
              <ul className="space-y-2 text-[14px]">
                {a.claims.map((c) => (
                  <li key={c.id}>
                    <Link to={`/claims/${c.id}`} className="font-medium hover:underline">{c.payerName}</Link>
                    <p className="text-[13px] text-muted-foreground">Pre-auth {STATUS_WORDS[c.preauthStatus]}{c.preauthAmount ? ` (${rupees(c.preauthAmount)})` : ''} · claim {STATUS_WORDS[c.claimStatus]}</p>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          <Panel title="Beds">
            <ul className="space-y-1 text-[13.5px]">
              {moves.map((m) => <li key={m.id}><span className="font-medium">{m.wardName}</span> <span className="text-muted-foreground">from {dateTime(m.at)} · {rupees(m.dailyRate)}/day</span></li>)}
            </ul>
          </Panel>
          {(a.reason || a.provisionalDiagnosis) && (
            <Panel title="On admission">
              {a.reason && <p className="text-[14px]"><span className="text-muted-foreground">Reason: </span>{a.reason}</p>}
              {a.provisionalDiagnosis && <p className="text-[14px]"><span className="text-muted-foreground">Provisional diagnosis: </span>{a.provisionalDiagnosis}</p>}
            </Panel>
          )}
          {!canWriteClinical && open && <p className="text-[12.5px] text-muted-foreground">The discharge summary is written by the doctor; billing can post charges and take deposits.</p>}
        </aside>
      </div>
    </div>
  );
}

function ChargeForm({ admissionId, onDone, onClose }: { admissionId: string; onDone: () => void; onClose: () => void }) {
  const [f, setF] = useState({ category: 'DOCTOR_VISIT', description: '', quantity: '1', rate: '' });
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    setError(null);
    try { await apiFetch(`/admissions/${admissionId}/charges`, { method: 'POST', data: { ...f, quantity: Number(f.quantity || 1), rate: Number(f.rate || 0) } }); onDone(); }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Could not post the charge.'); }
  };
  return (
    <Panel title="Post a charge" aside={<button type="button" onClick={onClose} className="hover:text-foreground">Close</button>}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[180px_minmax(0,1fr)_90px_120px]">
        <div><FieldLabel>Kind</FieldLabel><Pick value={f.category} onChange={(v) => setF({ ...f, category: v })} options={Object.entries(CATEGORY_WORDS).map(([value, label]) => ({ value, label }))} /></div>
        <div><FieldLabel htmlFor="ch-d">Service</FieldLabel><Input id="ch-d" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Physician visit, dressing, IV set…" autoFocus /></div>
        <div><FieldLabel htmlFor="ch-q">Qty</FieldLabel><input id="ch-q" inputMode="numeric" value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value.replace(/\D/g, '') })} className={FIELD} /></div>
        <div><FieldLabel htmlFor="ch-r">Rate, ₹</FieldLabel><input id="ch-r" inputMode="decimal" value={f.rate} onChange={(e) => setF({ ...f, rate: e.target.value.replace(/[^\d.]/g, '') })} className={FIELD} /></div>
      </div>
      {error && <p role="alert" className="mt-3 rounded-md tone-danger px-3 py-2 text-[13px]">{error}</p>}
      <Button className="mt-4" variant="primary" onClick={submit} disabled={!f.description.trim() || !f.rate}>Post</Button>
    </Panel>
  );
}

function TransferForm({ admissionId, currentBedId, onDone, onClose }: { admissionId: string; currentBedId: string | null; onDone: () => void; onClose: () => void }) {
  const [beds, setBeds] = useState<{ value: string; label: string }[]>([]);
  const [bedId, setBedId] = useState('');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    apiFetch<{ wards: BoardWard[] }>('/ipd/board').then((b) => setBeds(b.wards.flatMap((w) => w.beds.filter((x) => !x.admission && !x.blockedReason && x.id !== currentBedId).map((x) => ({ value: x.id, label: `${w.name} · ${x.label} (${rupees(w.dailyRate)}/day)` }))))).catch(() => {});
  }, [currentBedId]);
  const submit = async () => {
    setError(null);
    try { await apiFetch(`/admissions/${admissionId}/transfer`, { method: 'POST', data: { bedId } }); onDone(); }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Could not move.'); }
  };
  return (
    <Panel title="Move to another bed" aside={<button type="button" onClick={onClose} className="hover:text-foreground">Close</button>}>
      <div className="max-w-md"><FieldLabel>Free beds</FieldLabel><Pick value={bedId} onChange={setBedId} placeholder="Choose a bed" options={beds} /></div>
      <p className="mt-2 text-[13px] text-muted-foreground">The new ward's day rate starts now; the days already spent stay at the old rate.</p>
      {error && <p role="alert" className="mt-3 rounded-md tone-danger px-3 py-2 text-[13px]">{error}</p>}
      <Button className="mt-4" variant="primary" onClick={submit} disabled={!bedId}>Move</Button>
    </Panel>
  );
}

function DischargeForm({ admission, bill, onDone, onClose }: { admission: Admission; bill: Bill; onDone: () => void; onClose: () => void }) {
  const [f, setF] = useState({ finalDiagnosis: admission.provisionalDiagnosis ?? '', treatmentGiven: '', conditionAtDischarge: 'Stable', dischargeAdvice: '', followUpDate: '' });
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    setError(null);
    try { await apiFetch(`/admissions/${admission.id}/discharge`, { method: 'POST', data: { ...f, followUpDate: f.followUpDate || undefined } }); onDone(); }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Could not discharge.'); }
  };
  const area = (k: keyof typeof f, label: string, rows = 3) => (
    <div><FieldLabel htmlFor={`dc-${k}`}>{label}</FieldLabel><textarea id={`dc-${k}`} rows={rows} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} className="w-full rounded-md border border-input/60 bg-background px-3 py-2 text-[14px] outline-none focus:border-ring" /></div>
  );
  return (
    <Panel title="Discharge" aside={<button type="button" onClick={onClose} className="hover:text-foreground">Close</button>}>
      <div className="space-y-3">
        {area('finalDiagnosis', 'Final diagnosis', 2)}
        {area('treatmentGiven', 'Treatment given')}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div><FieldLabel htmlFor="dc-cond">Condition at discharge</FieldLabel><Input id="dc-cond" value={f.conditionAtDischarge} onChange={(e) => setF({ ...f, conditionAtDischarge: e.target.value })} /></div>
          <div><FieldLabel htmlFor="dc-fu">Follow-up on</FieldLabel><input id="dc-fu" type="date" value={f.followUpDate} onChange={(e) => setF({ ...f, followUpDate: e.target.value })} className={FIELD} /></div>
        </div>
        {area('dischargeAdvice', 'Advice and medicines to continue')}
        <p className="text-[13px] text-muted-foreground">Discharging frees the bed and turns the account into one bill of {rupees(bill.total)}. The deposit of {rupees(bill.depositHeld)} is settled against it at the cash counter.</p>
        {error && <p role="alert" className="rounded-md tone-danger px-3 py-2 text-[13px]">{error}</p>}
        <Button variant="primary" onClick={submit} disabled={!f.finalDiagnosis.trim()}>Discharge and make the bill</Button>
      </div>
    </Panel>
  );
}

function DischargeSummary({ a }: { a: Admission }) {
  return (
    <Panel title="Discharge summary" aside={dateTime(a.dischargedAt)}>
      <dl className="space-y-2 text-[14px]">
        {[['Admitted', dateTime(a.admittedAt)], ['Final diagnosis', a.finalDiagnosis], ['Treatment given', a.treatmentGiven], ['Condition at discharge', a.conditionAtDischarge], ['Advice', a.dischargeAdvice], ['Follow-up', a.followUpDate ? shortDate(a.followUpDate) : null]]
          .filter(([, v]) => v).map(([k, v]) => (
            <div key={k as string}><dt className="text-[13px] text-muted-foreground">{k}</dt><dd className="whitespace-pre-line">{v}</dd></div>
          ))}
      </dl>
    </Panel>
  );
}

const VITAL_KEYS: [string, string][] = [['bp', 'BP'], ['pulse', 'Pulse'], ['temp', 'Temp'], ['spo2', 'SpO₂'], ['rr', 'Resp'], ['sugar', 'Sugar'], ['pain', 'Pain']];

/** The ward chart: vitals, notes, medicine given -- newest first. */
function NursingChart({ admissionId, open }: { admissionId: string; open: boolean }) {
  const toast = useToast();
  const [entries, setEntries] = useState<NursingEntry[]>([]);
  const [kind, setKind] = useState<'VITALS' | 'NOTE' | 'MEDICATION'>('VITALS');
  const [v, setV] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [med, setMed] = useState({ drugName: '', dose: '', route: 'Oral' });
  const load = useCallback(async () => {
    try { setEntries((await apiFetch<{ data: NursingEntry[] }>(`/admissions/${admissionId}/nursing`)).data); } catch { /* chart stays empty */ }
  }, [admissionId]);
  useEffect(() => { void load(); }, [load]);
  const save = async () => {
    try {
      await apiFetch(`/admissions/${admissionId}/nursing`, { method: 'POST', data: kind === 'VITALS' ? { kind, vitals: v } : kind === 'NOTE' ? { kind, note } : { kind, ...med } });
      toast.success('Charted.'); setV({}); setNote(''); setMed({ drugName: '', dose: '', route: 'Oral' }); await load();
    } catch (e) { toast.error(e instanceof ApiError ? e.message : 'Could not save.'); }
  };
  return (
    <Panel title="Nursing chart" aside={entries[0] ? `last ${since(entries[0].at)} ago` : 'nothing charted yet'}>
      {open && (
        <div className="mb-4 rounded-lg bg-accent/45 p-3">
          <div className="mb-3 flex gap-1.5">
            {(['VITALS', 'NOTE', 'MEDICATION'] as const).map((k) => (
              <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}
                className={`rounded-md px-3 py-1.5 text-[13px] font-medium ${kind === k ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground hover:bg-card/80'}`}>
                {k === 'VITALS' ? 'Vitals' : k === 'NOTE' ? 'Note' : 'Medicine given'}
              </button>
            ))}
          </div>
          {kind === 'VITALS' && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-7">
              {VITAL_KEYS.map(([k, label]) => (
                <div key={k}><FieldLabel htmlFor={`nv-${k}`}>{label}</FieldLabel><input id={`nv-${k}`} value={v[k] ?? ''} onChange={(e) => setV({ ...v, [k]: e.target.value })} className={FIELD} /></div>
              ))}
            </div>
          )}
          {kind === 'NOTE' && <textarea aria-label="Note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} className="w-full rounded-md border border-input/60 bg-background px-3 py-2 text-[14px] outline-none focus:border-ring" />}
          {kind === 'MEDICATION' && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_120px_120px]">
              <div><FieldLabel htmlFor="nm-d">Medicine</FieldLabel><Input id="nm-d" value={med.drugName} onChange={(e) => setMed({ ...med, drugName: e.target.value })} /></div>
              <div><FieldLabel htmlFor="nm-dose">Dose</FieldLabel><Input id="nm-dose" value={med.dose} onChange={(e) => setMed({ ...med, dose: e.target.value })} /></div>
              <div><FieldLabel htmlFor="nm-r">Route</FieldLabel><Input id="nm-r" value={med.route} onChange={(e) => setMed({ ...med, route: e.target.value })} /></div>
            </div>
          )}
          <Button className="mt-3" size="sm" variant="primary" onClick={save}>Save to chart</Button>
        </div>
      )}
      {entries.length === 0 ? <p className="text-[14px] text-muted-foreground">Nothing charted.</p> : (
        <ul className="divide-y divide-border/10 text-[14px]">
          {entries.slice(0, 30).map((e) => (
            <li key={e.id} className="flex gap-3 py-2">
              <span className="w-28 shrink-0 text-[13px] text-muted-foreground">{dateTime(e.at)}</span>
              <span className="min-w-0 flex-1">
                {e.kind === 'VITALS' && e.vitals && <span className="tabular-nums">{VITAL_KEYS.filter(([k]) => e.vitals![k]).map(([k, l]) => `${l} ${e.vitals![k]}`).join(' · ')}</span>}
                {e.kind === 'NOTE' && e.note}
                {e.kind === 'MEDICATION' && <><span className="font-medium">{e.drugName}</span> {e.dose}{e.route ? `, ${e.route}` : ''}</>}
                <span className="block text-[12.5px] text-muted-foreground">{e.byName}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
