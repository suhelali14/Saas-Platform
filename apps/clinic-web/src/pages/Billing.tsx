import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { IndianRupee, ArrowLeft, Download } from 'lucide-react';
import { SkeletonList, SkeletonTable, SkeletonStats, SkeletonForm, SkeletonPanels } from '../components/Skeleton';
import { Button } from '../components/Button';
import { apiFetch, openPdf, ApiError } from '../lib/api';

interface InvoiceItem { id: string; category: string; description: string; quantity: number; amount: string }
interface PaymentRow { id: string; amount: string; mode: string; paidAt: string; receivedBy: { name: string } }
interface Invoice {
  id: string; createdAt: string;
  patient: { id: string; name: string; uhid: string };
  items: InvoiceItem[]; payments: PaymentRow[];
  subtotal: number; paid: number; balance: number; status: string;
}

const CATEGORIES = [
  { id: 'CONSULTATION', label: 'Consultation' },
  { id: 'MEDICINE', label: 'Medicine' },
  { id: 'PROCEDURE', label: 'Procedure' },
  { id: 'LAB', label: 'Lab' },
  { id: 'OTHER', label: 'Other' },
];
const MODES = ['CASH', 'UPI', 'CARD'];
const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-amber-500/15 text-amber-400',
  PARTIAL: 'bg-blue-500/15 text-blue-400',
  PAID: 'bg-emerald-500/15 text-emerald-400',
};

export function Billing() {
  const location = useLocation();
  const [tab, setTab] = useState<'invoices' | 'closing'>('invoices');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (tab === 'invoices' && !selected) load();
  }, [tab, selected]);

  // Hand-off from PatientDetail.tsx's "New Bill" button -- lands here with
  // the just-created invoice's id and opens it directly.
  useEffect(() => {
    const invoiceId = (location.state as { invoiceId?: string } | null)?.invoiceId;
    if (invoiceId) openInvoice(invoiceId);
  }, [location.state]);

  const load = async () => {
    try {
      const res = await apiFetch<{ data: Invoice[] }>('/invoices');
      setInvoices(res.data);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load invoices.');
    }
  };

  const openInvoice = async (id: string) => {
    try {
      const res = await apiFetch<Invoice>(`/invoices/${id}`);
      setSelected(res);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load invoice.');
    }
  };

  if (selected) {
    return <InvoiceDetail invoice={selected} onBack={() => setSelected(null)} onChange={setSelected} />;
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-4xl">
      <h1 className="text-xl font-bold flex items-center gap-2 mb-1"><IndianRupee size={20} className="text-emerald-400" /> Billing</h1>
      <p className="text-sm text-gray-400 mb-4">Invoices, payments, and daily cash closing.</p>

      <div className="flex gap-2 mb-6">
        <button onClick={() => setTab('invoices')} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${tab === 'invoices' ? 'bg-white text-black' : 'bg-white/5 text-gray-300'}`}>Invoices</button>
        <button onClick={() => setTab('closing')} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${tab === 'closing' ? 'bg-white text-black' : 'bg-white/5 text-gray-300'}`}>Daily Closing</button>
      </div>

      {error && <div className="mb-4 px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-sm">{error}</div>}

      {tab === 'invoices' ? (
        <div className="flex flex-col gap-2">
          {invoices.length === 0 && <div className="text-center py-10 text-gray-500 text-sm">No invoices yet. Create one from a patient's profile.</div>}
          {invoices.map((inv) => (
            <button key={inv.id} onClick={() => openInvoice(inv.id)} className="flex items-center justify-between p-3.5 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] text-left">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{inv.patient.name}</span>
                  <span className="text-[10px] text-gray-500 font-mono">{inv.patient.uhid}</span>
                </div>
                <div className="text-xs text-gray-500">{new Date(inv.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-300">₹{inv.subtotal.toFixed(2)}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[inv.status]}`}>{inv.status}</span>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <DailyClosing />
      )}
    </div>
  );
}

function InvoiceDetail({ invoice, onBack, onChange }: { invoice: Invoice; onBack: () => void; onChange: (inv: Invoice) => void }) {
  const [category, setCategory] = useState('MEDICINE');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [amount, setAmount] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState('CASH');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    const res = await apiFetch<Invoice>(`/invoices/${invoice.id}`);
    onChange(res);
  };

  const addItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !amount) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/invoices/${invoice.id}/items`, { method: 'POST', data: { category, description, quantity: Number(quantity), amount: Number(amount) } });
      setDescription('');
      setAmount('');
      setQuantity('1');
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to add item.');
    } finally {
      setSaving(false);
    }
  };

  const removeItem = async (itemId: string) => {
    try {
      await apiFetch(`/invoices/${invoice.id}/items/${itemId}`, { method: 'DELETE' });
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to remove item.');
    }
  };

  const recordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payAmount) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/invoices/${invoice.id}/payments`, { method: 'POST', data: { amount: Number(payAmount), mode: payMode } });
      setPayAmount('');
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to record payment.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-2xl">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-400 hover:text-white mb-4"><ArrowLeft size={14} /> Back to invoices</button>

      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Link to={`/patients/${invoice.patient.id}`} className="text-xl font-bold hover:underline">{invoice.patient.name}</Link>
          <span className="text-xs text-gray-500 font-mono">{invoice.patient.uhid}</span>
        </div>
        <button onClick={() => openPdf(`/invoices/${invoice.id}/pdf`)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-white">
          <Download size={12} /> Print
        </button>
      </div>
      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium mb-4 ${STATUS_COLORS[invoice.status]}`}>{invoice.status}</span>

      {error && <div className="mb-4 px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-sm">{error}</div>}

      <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02] mb-4">
        <h3 className="text-sm font-semibold mb-2">Line Items</h3>
        <div className="flex flex-col gap-1 mb-3">
          {invoice.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between text-sm py-1 border-b border-white/5 last:border-0">
              <span className="text-gray-300">{item.description} <span className="text-gray-600 text-xs">({item.category}) x{item.quantity}</span></span>
              <div className="flex items-center gap-2">
                <span>₹{(Number(item.amount) * item.quantity).toFixed(2)}</span>
                <Button variant="ghost" size="sm" onClick={() => removeItem(item.id)} aria-label="Remove item">✕</Button>
              </div>
            </div>
          ))}
          {invoice.items.length === 0 && <p className="text-xs text-gray-500">No items yet.</p>}
        </div>
        <form onSubmit={addItem} className="grid grid-cols-2 sm:grid-cols-6 gap-2">
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="col-span-2 px-2 py-2 rounded-lg bg-white/5 border border-white/10 text-xs outline-none">
            {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <input placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} className="col-span-2 px-2 py-2 rounded-lg bg-white/5 border border-white/10 text-xs outline-none" />
          <input placeholder="Qty" type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="px-2 py-2 rounded-lg bg-white/5 border border-white/10 text-xs outline-none" />
          <input placeholder="₹" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="px-2 py-2 rounded-lg bg-white/5 border border-white/10 text-xs outline-none" />
          <button type="submit" disabled={saving} className="col-span-2 sm:col-span-6 self-start px-3 py-2 rounded-lg bg-white/10 text-xs font-medium hover:bg-white/20 disabled:opacity-50">Add Item</button>
        </form>
      </div>

      <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02] mb-4">
        <div className="flex justify-between text-sm mb-1"><span className="text-gray-400">Subtotal</span><span>₹{invoice.subtotal.toFixed(2)}</span></div>
        <div className="flex justify-between text-sm mb-1"><span className="text-gray-400">Paid</span><span>₹{invoice.paid.toFixed(2)}</span></div>
        <div className="flex justify-between text-sm font-semibold"><span>Balance Due</span><span>₹{invoice.balance.toFixed(2)}</span></div>
      </div>

      {invoice.payments.length > 0 && (
        <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02] mb-4">
          <h3 className="text-sm font-semibold mb-2">Payments</h3>
          {invoice.payments.map((p) => (
            <div key={p.id} className="flex justify-between text-xs text-gray-400 py-0.5">
              <span>{new Date(p.paidAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} · {p.receivedBy.name}</span>
              <span>₹{Number(p.amount).toFixed(2)} ({p.mode})</span>
            </div>
          ))}
        </div>
      )}

      {invoice.balance > 0 && (
        <form onSubmit={recordPayment} className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex gap-2">
          <input placeholder={`Up to ₹${invoice.balance.toFixed(2)}`} type="number" step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className="flex-1 px-2 py-2 rounded-lg bg-white/5 border border-white/10 text-sm outline-none" />
          <select value={payMode} onChange={(e) => setPayMode(e.target.value)} className="px-2 py-2 rounded-lg bg-white/5 border border-white/10 text-sm outline-none">
            {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-emerald-500 text-black text-sm font-semibold disabled:opacity-50">Record Payment</button>
        </form>
      )}
    </div>
  );
}

function DailyClosing() {
  const [summary, setSummary] = useState<{ byMode: Record<string, number>; totalCollected: number; pendingDues: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<any>('/billing/daily-summary').then(setSummary).catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load summary.'));
  }, []);

  if (error) return <div className="px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-sm">{error}</div>;
  if (!summary) return <SkeletonStats count={3} label="Loading the day's takings" />;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02]"><div className="text-xs text-gray-500 mb-1">Cash</div><div className="text-lg font-bold">₹{summary.byMode.CASH?.toFixed(2) ?? '0.00'}</div></div>
      <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02]"><div className="text-xs text-gray-500 mb-1">UPI</div><div className="text-lg font-bold">₹{summary.byMode.UPI?.toFixed(2) ?? '0.00'}</div></div>
      <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02]"><div className="text-xs text-gray-500 mb-1">Card</div><div className="text-lg font-bold">₹{summary.byMode.CARD?.toFixed(2) ?? '0.00'}</div></div>
      <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5"><div className="text-xs text-gray-500 mb-1">Total Today</div><div className="text-lg font-bold text-emerald-400">₹{summary.totalCollected.toFixed(2)}</div></div>
      <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 col-span-2 md:col-span-4"><div className="text-xs text-gray-500 mb-1">Pending Dues (all time)</div><div className="text-lg font-bold text-amber-400">₹{summary.pendingDues.toFixed(2)}</div></div>
    </div>
  );
}
