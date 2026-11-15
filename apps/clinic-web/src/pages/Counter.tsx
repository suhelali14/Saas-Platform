import { useCallback, useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../lib/api';
import { useClinicAuth } from '../contexts/ClinicAuthContext';
import { Button } from '../components/Button';
import { SkeletonPanels } from '../components/Skeleton';
import { useToast } from '../components/Toast';
import { Input } from '../components/ui/input';
import { Chip, FIELD, FieldLabel, PageHeader, Panel, PatientPicker, Sums, dateTime, rupees, type PickedPatient } from '../components/hosp';

interface Session { id: string; counterName: string; openedAt: string; openingCash: string; openedByName: string; closedAt: string | null; countedCash: string | null; expectedCash: string | null; difference?: number | null; notes: string | null }
interface Current {
  session: Session | null;
  totals?: { byMode: Record<string, number>; advances: number; refunds: number; receipts: number; expectedCash: number };
  payments?: { id: string; amount: string; mode: string; paidAt: string; invoice: { patient: { name: string; uhid: string } } }[];
  deposits?: { id: string; kind: string; amount: string; mode: string | null; at: string; patient: { name: string; uhid: string } }[];
}
interface Invoice { id: string; createdAt: string; total: number; balance: number; status: string; discount: string | null; discountStatus: string; discountReason: string | null; discountRequestedBy: string | null; patient: { name: string; uhid: string }; admissionId: string | null }
const MODE_WORDS: Record<string, string> = { CASH: 'cash', UPI: 'UPI', CARD: 'card', DEPOSIT: 'from advance' };

/*
 * The cash counter.
 *
 * Open the counter with what is in the drawer, take payments and
 * deposits, and close it by counting what is there. The screen keeps the
 * running totals by mode and says what the drawer should hold, so the
 * close is a comparison, not a calculation done on paper.
 */
export function Counter() {
  const { isAdmin } = useClinicAuth();
  const toast = useToast();
  const [cur, setCur] = useState<Current | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [pending, setPending] = useState<Invoice[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [c, s] = await Promise.all([apiFetch<Current>('/counter/current'), apiFetch<{ data: Session[] }>('/counter/sessions')]);
      setCur(c); setSessions(s.data); setError(null);
      if (isAdmin) apiFetch<{ data: Invoice[] }>('/discounts/pending').then((r) => setPending(r.data)).catch(() => {});
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Could not load the counter.'); }
  }, [isAdmin]);
  useEffect(() => { void load(); }, [load]);

  if (!cur) return <div className="p-4 sm:p-6 md:p-8 max-w-6xl">{error ? <p className="text-muted-foreground">{error}</p> : <SkeletonPanels count={2} label="Loading the counter" />}</div>;
  const s = cur.session;

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-6xl">
      <PageHeader title="Cash counter" sub={s ? `${s.counterName} open since ${dateTime(s.openedAt)}` : 'Closed'} />

      {pending.length > 0 && (
        <Panel title={`Discounts waiting for you · ${pending.length}`} className="mb-6">
          <ul className="divide-y divide-border/10">
            {pending.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-medium">{rupees(inv.discount || 0)} off {inv.patient.name}'s bill</p>
                  <p className="text-[13px] text-muted-foreground">{inv.discountReason} · asked by {inv.discountRequestedBy}</p>
                </div>
                <PendingDecision invoiceId={inv.id} onDone={load} />
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {!s ? <OpenCounter onDone={load} /> : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-5">
            <TakeMoney onDone={load} />
            <Panel title="On this counter" aside={`${cur.totals!.receipts} receipts`}>
              {(cur.payments!.length + cur.deposits!.length) === 0 ? <p className="text-[14px] text-muted-foreground">Nothing taken yet.</p> : (
                <ul className="divide-y divide-border/10 text-[14px]">
                  {[...cur.deposits!.map((d) => ({ id: d.id, at: d.at, who: d.patient.name, what: d.kind === 'ADVANCE' ? 'Advance' : d.kind === 'REFUND' ? 'Refund' : 'Applied', mode: d.mode, amount: d.kind === 'REFUND' ? -Number(d.amount) : Number(d.amount) })),
                    ...cur.payments!.map((p) => ({ id: p.id, at: p.paidAt, who: p.invoice.patient.name, what: 'Bill payment', mode: p.mode, amount: Number(p.amount) }))]
                    .sort((a, b) => b.at.localeCompare(a.at))
                    .map((r) => (
                      <li key={r.id} className="flex items-center gap-3 py-2">
                        <span className="w-24 shrink-0 text-[13px] text-muted-foreground">{new Date(r.at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</span>
                        <span className="min-w-0 flex-1">{r.who} <span className="text-muted-foreground">· {r.what}{r.mode ? `, ${MODE_WORDS[r.mode] ?? r.mode}` : ''}</span></span>
                        <span className={`tabular-nums ${r.amount < 0 ? 'text-ink-warning' : ''}`}>{r.amount < 0 ? '−' : ''}{rupees(Math.abs(r.amount))}</span>
                      </li>
                    ))}
                </ul>
              )}
            </Panel>
          </div>
          <aside className="space-y-5">
            <Panel title="Drawer">
              <Sums rows={[
                { label: 'Opening cash', value: rupees(s.openingCash) },
                { label: 'Cash in', value: rupees(cur.totals!.byMode.CASH ?? 0) },
                { label: 'Should hold now', value: rupees(cur.totals!.expectedCash), strong: true },
                { label: 'UPI', value: rupees(cur.totals!.byMode.UPI ?? 0) },
                { label: 'Card', value: rupees(cur.totals!.byMode.CARD ?? 0) },
              ]} />
            </Panel>
            <CloseCounter expected={cur.totals!.expectedCash} onDone={load} />
          </aside>
        </div>
      )}

      <Panel title="Counter sessions" className="mt-6">
        {sessions.length === 0 ? <p className="text-[14px] text-muted-foreground">None yet.</p> : (
          <table className="w-full text-[14px]">
            <thead><tr className="border-b border-border/15 text-left text-[12.5px] text-muted-foreground"><th className="py-1.5 pr-2 font-medium">Counter</th><th className="py-1.5 pr-2 font-medium">Opened</th><th className="py-1.5 pr-2 font-medium">Closed</th><th className="py-1.5 pr-2 text-right font-medium">Expected</th><th className="py-1.5 pr-2 text-right font-medium">Counted</th><th className="py-1.5 text-right font-medium">Difference</th></tr></thead>
            <tbody>
              {sessions.map((x) => (
                <tr key={x.id} className="border-b border-border/10">
                  <td className="py-2 pr-2">{x.counterName} <span className="text-[12.5px] text-muted-foreground">· {x.openedByName}</span></td>
                  <td className="py-2 pr-2 text-[13px] text-muted-foreground">{dateTime(x.openedAt)}</td>
                  <td className="py-2 pr-2 text-[13px] text-muted-foreground">{x.closedAt ? dateTime(x.closedAt) : <Chip tone="info">open</Chip>}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{x.expectedCash !== null ? rupees(x.expectedCash) : '—'}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{x.countedCash !== null ? rupees(x.countedCash) : '—'}</td>
                  <td className="py-2 text-right tabular-nums">{x.difference == null ? '—' : x.difference === 0 ? 'balanced' : <span className="font-semibold text-ink-warning" title={x.notes ?? ''}>{x.difference > 0 ? '+' : '−'}{rupees(Math.abs(x.difference))}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}

function PendingDecision({ invoiceId, onDone }: { invoiceId: string; onDone: () => void }) {
  const toast = useToast();
  const decide = async (approve: boolean) => {
    try { await apiFetch(`/invoices/${invoiceId}/discount/decision`, { method: 'POST', data: { approve } }); toast.success(approve ? 'Discount approved.' : 'Discount turned down.'); onDone(); }
    catch (e) { toast.error(e instanceof ApiError ? e.message : 'Could not save.'); }
  };
  return (
    <div className="flex gap-2">
      <Button size="sm" variant="primary" onClick={() => decide(true)}>Approve</Button>
      <Button size="sm" variant="ghost" onClick={() => decide(false)}>Turn down</Button>
    </div>
  );
}

function OpenCounter({ onDone }: { onDone: () => void }) {
  const toast = useToast();
  const [name, setName] = useState('Counter 1');
  const [cash, setCash] = useState('');
  const open = async () => {
    try { await apiFetch('/counter/open', { method: 'POST', data: { counterName: name, openingCash: Number(cash || 0) } }); toast.success('Counter open.'); onDone(); }
    catch (e) { toast.error(e instanceof ApiError ? e.message : 'Could not open the counter.'); }
  };
  return (
    <Panel title="Open the counter" className="max-w-lg">
      <p className="mb-3 text-[14px] text-muted-foreground">Count the cash in the drawer first. Only you take money on the counter you open.</p>
      <div className="grid grid-cols-2 gap-3">
        <div><FieldLabel htmlFor="c-name">Counter</FieldLabel><Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><FieldLabel htmlFor="c-cash">Cash in the drawer, ₹</FieldLabel><input id="c-cash" inputMode="decimal" value={cash} onChange={(e) => setCash(e.target.value.replace(/[^\d.]/g, ''))} className={FIELD} autoFocus /></div>
      </div>
      <Button className="mt-4" variant="primary" onClick={open}>Open counter</Button>
    </Panel>
  );
}

/** Take an advance, give a refund, or settle a bill from the advance. */
function TakeMoney({ onDone }: { onDone: () => void }) {
  const toast = useToast();
  const [patient, setPatient] = useState<PickedPatient | null>(null);
  const [held, setHeld] = useState<number | null>(null);
  const [bills, setBills] = useState<Invoice[]>([]);
  const [f, setF] = useState({ kind: 'ADVANCE', amount: '', mode: 'CASH' });

  const refresh = useCallback(async (p: PickedPatient | null) => {
    if (!p) { setHeld(null); setBills([]); return; }
    try {
      const [d, inv] = await Promise.all([
        apiFetch<{ held: number }>(`/patients/${p.id}/deposits`),
        apiFetch<{ data: Invoice[] }>(`/invoices?patientId=${p.id}`),
      ]);
      setHeld(d.held); setBills(inv.data.filter((i) => i.balance > 0));
    } catch { setHeld(null); }
  }, []);
  useEffect(() => { void refresh(patient); }, [patient, refresh]);

  const submit = async () => {
    if (!patient) return;
    try {
      await apiFetch('/deposits', { method: 'POST', data: { patientId: patient.id, kind: f.kind, amount: Number(f.amount), mode: f.mode } });
      toast.success(f.kind === 'ADVANCE' ? `Advance of ${rupees(f.amount)} taken.` : `Refund of ${rupees(f.amount)} given.`);
      setF({ ...f, amount: '' }); await refresh(patient); onDone();
    } catch (e) { toast.error(e instanceof ApiError ? e.message : 'Could not save.'); }
  };
  const applyTo = async (inv: Invoice) => {
    try {
      const r = await apiFetch<{ applied: number }>(`/invoices/${inv.id}/apply-deposit`, { method: 'POST', data: { amount: inv.balance } });
      toast.success(`${rupees(r.applied)} of the advance used for the bill.`); await refresh(patient); onDone();
    } catch (e) { toast.error(e instanceof ApiError ? e.message : 'Could not apply the advance.'); }
  };
  const payBill = async (inv: Invoice) => {
    try {
      await apiFetch(`/invoices/${inv.id}/payments`, { method: 'POST', data: { amount: inv.balance, mode: f.mode } });
      toast.success(`${rupees(inv.balance)} received by ${f.mode}.`); await refresh(patient); onDone();
    } catch (e) { toast.error(e instanceof ApiError ? e.message : 'Could not take the payment.'); }
  };

  return (
    <Panel title="Take money">
      <div className="space-y-4">
        <div><FieldLabel>Patient</FieldLabel><PatientPicker value={patient} onChange={setPatient} /></div>
        {patient && (
          <>
            <p className="text-[14px]">Advance held: <span className="font-semibold tabular-nums">{held === null ? '…' : rupees(held)}</span></p>
            {bills.length > 0 && (
              <div className="rounded-lg border border-border/15">
                {bills.map((inv) => (
                  <div key={inv.id} className="flex flex-wrap items-center gap-2 border-b border-border/10 px-3 py-2 last:border-0">
                    <span className="min-w-0 flex-1 text-[14px]">{inv.admissionId ? 'Final bill (inpatient)' : 'Bill'} of {new Date(inv.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · <span className="font-semibold">{rupees(inv.balance)}</span> due{inv.discountStatus === 'PENDING' ? ' · discount waiting for approval' : ''}</span>
                    {held !== null && held > 0 && <Button size="sm" variant="secondary" onClick={() => applyTo(inv)}>Use advance</Button>}
                    <Button size="sm" variant="primary" onClick={() => payBill(inv)}>Take {rupees(inv.balance)} by {f.mode}</Button>
                  </div>
                ))}
              </div>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[auto_140px_auto]">
              <div>
                <FieldLabel>Advance or refund</FieldLabel>
                <div className="flex gap-1.5">
                  {(['ADVANCE', 'REFUND'] as const).map((k) => (
                    <button key={k} type="button" aria-pressed={f.kind === k} onClick={() => setF({ ...f, kind: k })}
                      className={`rounded-md px-3 py-1.5 text-[13px] font-medium ${f.kind === k ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}>{k === 'ADVANCE' ? 'Advance in' : 'Refund out'}</button>
                  ))}
                </div>
              </div>
              <div><FieldLabel htmlFor="tm-amt">Amount, ₹</FieldLabel><input id="tm-amt" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value.replace(/[^\d.]/g, '') })} className={FIELD} /></div>
              <div>
                <FieldLabel>Mode</FieldLabel>
                <div className="flex gap-1.5">
                  {(['CASH', 'UPI', 'CARD'] as const).map((m) => (
                    <button key={m} type="button" aria-pressed={f.mode === m} onClick={() => setF({ ...f, mode: m })}
                      className={`rounded-md px-3 py-1.5 text-[13px] font-medium ${f.mode === m ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}>{m === 'CASH' ? 'Cash' : m === 'UPI' ? 'UPI' : 'Card'}</button>
                  ))}
                </div>
              </div>
            </div>
            <Button variant="primary" onClick={submit} disabled={!f.amount}>{f.kind === 'ADVANCE' ? 'Take advance' : 'Give refund'}</Button>
          </>
        )}
      </div>
    </Panel>
  );
}

function CloseCounter({ expected, onDone }: { expected: number; onDone: () => void }) {
  const toast = useToast();
  const [counted, setCounted] = useState('');
  const [notes, setNotes] = useState('');
  const diff = counted === '' ? null : Math.round((Number(counted) - expected) * 100) / 100;
  const close = async () => {
    try {
      await apiFetch('/counter/close', { method: 'POST', data: { countedCash: Number(counted), notes: notes || undefined } });
      toast.success(diff === 0 ? 'Counter closed. Balanced.' : `Counter closed, ${diff! > 0 ? 'over' : 'short'} by ${rupees(Math.abs(diff!))}.`);
      onDone();
    } catch (e) { toast.error(e instanceof ApiError ? e.message : 'Could not close.'); }
  };
  return (
    <Panel title="Close the counter">
      <FieldLabel htmlFor="cc-count">Cash counted in the drawer, ₹</FieldLabel>
      <input id="cc-count" inputMode="decimal" value={counted} onChange={(e) => setCounted(e.target.value.replace(/[^\d.]/g, ''))} className={FIELD} />
      {diff !== null && <p className={`mt-2 text-[14px] ${diff === 0 ? 'text-ink-success' : 'font-semibold text-ink-warning'}`}>{diff === 0 ? 'Balanced.' : `${diff > 0 ? 'Over' : 'Short'} by ${rupees(Math.abs(diff))}.`}</p>}
      {diff !== null && diff !== 0 && (
        <div className="mt-2"><FieldLabel htmlFor="cc-note">Why</FieldLabel><Input id="cc-note" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Needed to close when the drawer does not balance" /></div>
      )}
      <Button className="mt-3" variant="secondary" onClick={close} disabled={counted === '' || (diff !== 0 && !notes.trim())}>Close counter</Button>
    </Panel>
  );
}
