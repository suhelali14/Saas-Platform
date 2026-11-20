/**
 * Charges and payment, inside the Encounter screen.
 *
 * For a clinic without a dedicated cashier, billing has to live where
 * the doctor already is -- at the visit. This panel fetches (or
 * creates) the visit's invoice, lets the doctor add charges from the
 * catalogue in one tap, shows the running total, and takes the
 * payment. All before the visit closes.
 *
 * The catalogue items the picker shows come from the merged list of
 * the doctor's own board PLUS the clinic-wide items, with the
 * doctor's own first -- so the injections a doctor keeps for
 * themselves are the ones that come up first.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Receipt, Loader2, CheckCircle2 } from 'lucide-react';
import { apiFetch, ApiError } from '../lib/api';
import { useClinicAuth } from '../contexts/ClinicAuthContext';

interface ServiceItem {
  id: string;
  code: string | null;
  name: string;
  category: string;
  defaultPrice: string;
  doctorId: string | null;
}

interface InvoiceItem {
  id: string;
  category: string;
  description: string;
  quantity: number;
  amount: string;
  serviceItemId?: string | null;
}

interface Payment {
  id: string;
  amount: string;
  mode: string;
  paidAt: string;
  receivedBy: { name: string };
}

interface Invoice {
  id: string;
  items: InvoiceItem[];
  payments: Payment[];
  subtotal: number;
  paid: number;
  balance: number;
  status: 'PENDING' | 'PARTIAL' | 'PAID';
}

export function VisitCharges({ appointmentId, doctorId, onChanged }: { appointmentId: string; doctorId: string | null; onChanged?: () => void }) {
  const { canWriteClinical } = useClinicAuth();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [catalog, setCatalog] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQ, setPickerQ] = useState('');
  const [customOpen, setCustomOpen] = useState(false);
  const [custom, setCustom] = useState({ category: 'PROCEDURE', description: '', amount: '' });
  const [payOpen, setPayOpen] = useState(false);
  const [pay, setPay] = useState({ amount: '', mode: 'CASH' });
  const [payBusy, setPayBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const inv = await apiFetch<Invoice>(`/appointments/${appointmentId}/invoice`);
      setInvoice(inv);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load charges.');
    } finally {
      setLoading(false);
    }
  }, [appointmentId]);

  const loadCatalog = useCallback(async () => {
    try {
      const url = doctorId ? `/service-items?doctorId=${encodeURIComponent(doctorId)}` : '/service-items';
      const res = await apiFetch<{ data: ServiceItem[] }>(url);
      setCatalog(res.data || []);
    } catch {
      setCatalog([]);
    }
  }, [doctorId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void loadCatalog(); }, [loadCatalog]);

  const addFromCatalog = async (serviceItemId: string) => {
    if (!invoice) return;
    setAdding(true);
    try {
      const updated = await apiFetch<Invoice>(`/invoices/${invoice.id}/items`, {
        method: 'POST',
        data: { serviceItemId, appointmentId },
      });
      setInvoice(updated);
      setPickerOpen(false);
      setPickerQ('');
      onChanged?.();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not add charge.');
    } finally { setAdding(false); }
  };

  const addCustom = async () => {
    if (!invoice || !custom.description || !custom.amount) return;
    setAdding(true);
    try {
      const updated = await apiFetch<Invoice>(`/invoices/${invoice.id}/items`, {
        method: 'POST',
        data: {
          category: custom.category,
          description: custom.description,
          amount: Number(custom.amount),
          appointmentId,
        },
      });
      setInvoice(updated);
      setCustom({ category: 'PROCEDURE', description: '', amount: '' });
      setCustomOpen(false);
      onChanged?.();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not add charge.');
    } finally { setAdding(false); }
  };

  const removeItem = async (itemId: string) => {
    if (!invoice) return;
    try {
      const updated = await apiFetch<Invoice>(`/invoices/${invoice.id}/items/${itemId}`, { method: 'DELETE' });
      setInvoice(updated);
      onChanged?.();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not remove.');
    }
  };

  const takePayment = async () => {
    if (!invoice) return;
    const amt = Number(pay.amount);
    if (!amt || amt <= 0) return;
    setPayBusy(true);
    try {
      const updated = await apiFetch<Invoice>(`/invoices/${invoice.id}/payments`, {
        method: 'POST',
        data: { amount: amt, mode: pay.mode },
      });
      setInvoice(updated);
      setPayOpen(false);
      setPay({ amount: '', mode: 'CASH' });
      onChanged?.();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not record payment.');
    } finally { setPayBusy(false); }
  };

  // Filter catalogue by search, keeping doctor's own first.
  const filteredCatalog = useMemo(() => {
    const q = pickerQ.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter((c) => c.name.toLowerCase().includes(q) || c.code?.toLowerCase().includes(q));
  }, [catalog, pickerQ]);

  if (loading) return <div className="text-sm text-muted-foreground py-4"><Loader2 className="inline size-3 animate-spin mr-1" /> Loading charges…</div>;
  if (error && !invoice) return <div className="text-sm px-3 py-2 rounded tone-danger">{error}</div>;
  if (!invoice) return null;

  const money = (n: number | string) => '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });

  return (
    <div className="mb-6 p-4 rounded-xl border border-border/10 bg-foreground/[0.03]">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2"><Receipt size={14} /> Charges for this visit</h3>
          <p className="text-[11px] text-muted-foreground/70 mt-0.5">Add from your board or type a one-off, then take payment before the patient leaves.</p>
        </div>
        <div className="text-right">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Balance</div>
          <div className={`text-lg font-semibold tabular ${invoice.balance > 0 ? '' : 'text-emerald-500'}`}>{money(invoice.balance)}</div>
        </div>
      </div>

      {error && <div className="mb-2 text-xs px-2 py-1 rounded tone-danger">{error}</div>}

      {/* Line items */}
      {invoice.items.length === 0 ? (
        <div className="py-4 text-center text-xs italic text-muted-foreground/70">No charges added yet.</div>
      ) : (
        <ul className="divide-y divide-border/10 mb-3">
          {invoice.items.map((it) => (
            <li key={it.id} className="flex items-center gap-3 py-2 text-sm">
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-foreground/10 text-muted-foreground shrink-0">{it.category}</span>
              <span className="flex-1 min-w-0 truncate">{it.description}</span>
              {it.quantity > 1 && <span className="text-xs text-muted-foreground">× {it.quantity}</span>}
              <span className="tabular w-24 text-right">{money(Number(it.amount) * it.quantity)}</span>
              {canWriteClinical && (
                <button onClick={() => removeItem(it.id)} className="text-muted-foreground hover:text-destructive" title="Remove">
                  <Trash2 size={13} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Totals + payments */}
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
        <div>
          Subtotal <span className="tabular text-foreground">{money(invoice.subtotal)}</span>
          {invoice.paid > 0 && <> · Paid <span className="tabular text-foreground">{money(invoice.paid)}</span></>}
        </div>
        {invoice.payments.length > 0 && (
          <div>
            {invoice.payments.map((p) => `${p.mode} ${money(p.amount)}`).join(' · ')}
          </div>
        )}
      </div>

      {/* Actions */}
      {canWriteClinical && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => { setPickerOpen((v) => !v); setCustomOpen(false); setPayOpen(false); }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground/10 text-sm font-medium hover:bg-foreground/20"
          >
            <Plus size={13} /> From board
          </button>
          <button
            type="button"
            onClick={() => { setCustomOpen((v) => !v); setPickerOpen(false); setPayOpen(false); }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground/10 text-sm font-medium hover:bg-foreground/20"
          >
            <Plus size={13} /> Custom
          </button>
          <button
            type="button"
            disabled={invoice.balance <= 0}
            onClick={() => { setPayOpen((v) => !v); setCustomOpen(false); setPickerOpen(false); setPay({ amount: String(invoice.balance), mode: 'CASH' }); }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
          >
            <CheckCircle2 size={13} /> Collect {money(invoice.balance)}
          </button>
        </div>
      )}

      {/* From-board picker */}
      {pickerOpen && (
        <div className="mt-3 rounded-lg border border-border/10 bg-foreground/[0.04] p-3">
          <input
            autoFocus
            type="text"
            placeholder="Search your board (name or code)"
            value={pickerQ}
            onChange={(e) => setPickerQ(e.target.value)}
            className="w-full px-3 py-2 mb-2 rounded-lg bg-foreground/10 border border-border/10 text-sm outline-none focus:border-primary"
          />
          <div className="max-h-56 overflow-y-auto">
            {filteredCatalog.length === 0 ? (
              <div className="py-3 text-center text-xs italic text-muted-foreground/70">
                {pickerQ ? `No match for "${pickerQ}". Add it in Settings → Catalogue.` : 'Catalogue is empty. Add items in Settings → Catalogue.'}
              </div>
            ) : (
              <ul className="divide-y divide-border/10">
                {filteredCatalog.slice(0, 50).map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      disabled={adding}
                      onClick={() => addFromCatalog(c.id)}
                      className="w-full flex items-center gap-3 py-2 px-2 text-sm text-left hover:bg-foreground/5 rounded"
                    >
                      <span className="flex-1 min-w-0 truncate">
                        {c.code && <span className="text-[10px] text-muted-foreground mr-1.5">{c.code}</span>}
                        {c.name}
                        {c.doctorId && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary">your board</span>}
                      </span>
                      <span className="text-[10px] uppercase text-muted-foreground">{c.category}</span>
                      <span className="tabular w-20 text-right font-medium">{money(c.defaultPrice)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Custom line */}
      {customOpen && (
        <div className="mt-3 rounded-lg border border-border/10 bg-foreground/[0.04] p-3 grid grid-cols-1 sm:grid-cols-[120px_minmax(0,1fr)_100px_auto] gap-2">
          <select
            value={custom.category}
            onChange={(e) => setCustom({ ...custom, category: e.target.value })}
            className="px-2 py-2 rounded-lg bg-foreground/10 border border-border/10 text-sm outline-none focus:border-primary"
          >
            <option value="CONSULTATION">Consultation</option>
            <option value="MEDICINE">Medicine</option>
            <option value="PROCEDURE">Procedure</option>
            <option value="LAB">Lab</option>
            <option value="OTHER">Other</option>
          </select>
          <input
            type="text"
            placeholder="Description"
            value={custom.description}
            onChange={(e) => setCustom({ ...custom, description: e.target.value })}
            className="px-3 py-2 rounded-lg bg-foreground/10 border border-border/10 text-sm outline-none focus:border-primary"
          />
          <input
            type="number"
            placeholder="Amount"
            value={custom.amount}
            onChange={(e) => setCustom({ ...custom, amount: e.target.value })}
            className="px-3 py-2 rounded-lg bg-foreground/10 border border-border/10 text-sm outline-none focus:border-primary tabular"
          />
          <button
            type="button"
            disabled={adding || !custom.description || !custom.amount}
            onClick={addCustom}
            className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
          >
            Add
          </button>
        </div>
      )}

      {/* Payment */}
      {payOpen && (
        <div className="mt-3 rounded-lg border border-border/10 bg-foreground/[0.04] p-3 grid grid-cols-1 sm:grid-cols-[120px_minmax(0,1fr)_auto] gap-2">
          <select
            value={pay.mode}
            onChange={(e) => setPay({ ...pay, mode: e.target.value })}
            className="px-2 py-2 rounded-lg bg-foreground/10 border border-border/10 text-sm outline-none focus:border-primary"
          >
            <option value="CASH">Cash</option>
            <option value="UPI">UPI</option>
            <option value="CARD">Card</option>
          </select>
          <input
            type="number"
            placeholder="Amount"
            value={pay.amount}
            onChange={(e) => setPay({ ...pay, amount: e.target.value })}
            className="px-3 py-2 rounded-lg bg-foreground/10 border border-border/10 text-sm outline-none focus:border-primary tabular"
          />
          <button
            type="button"
            disabled={payBusy || !pay.amount || Number(pay.amount) <= 0}
            onClick={takePayment}
            className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50"
          >
            {payBusy ? 'Saving…' : 'Record payment'}
          </button>
        </div>
      )}
    </div>
  );
}
