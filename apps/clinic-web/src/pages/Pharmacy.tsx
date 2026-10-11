import { useState, useEffect } from 'react';
import { Pill, CheckCircle2, AlertTriangle, Search, Plus, Package } from 'lucide-react';
import { Button } from '../components/Button';
import { apiFetch, ApiError } from '../lib/api';

interface Item { drugName: string; dosage: string; frequency: string; duration: string; instructions: string | null }
interface RxRow {
  id: string; createdAt: string; items: Item[];
  patient: { id: string; name: string; uhid: string };
  dispensed: boolean;
}

export function Pharmacy() {
  const [tab, setTab] = useState<'dispensing' | 'inventory'>('dispensing');
  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-3xl">
      <h1 className="text-xl font-bold flex items-center gap-2 mb-1"><Pill size={20} className="text-emerald-400" /> Pharmacy</h1>
      <p className="text-sm text-gray-400 mb-4">Dispensing queue and stock management.</p>
      <div className="flex gap-2 mb-6">
        <button onClick={() => setTab('dispensing')} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${tab === 'dispensing' ? 'bg-white text-black' : 'bg-white/5 text-gray-300'}`}>Dispensing</button>
        <button onClick={() => setTab('inventory')} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${tab === 'inventory' ? 'bg-white text-black' : 'bg-white/5 text-gray-300'}`}>Inventory</button>
      </div>
      {tab === 'dispensing' ? <Dispensing /> : <Inventory />}
    </div>
  );
}

function Dispensing() {
  const [prescriptions, setPrescriptions] = useState<RxRow[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [dispensing, setDispensing] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, [showAll]);

  const load = async () => {
    try {
      const qs = showAll ? '' : '?dispensed=false';
      const res = await apiFetch<{ data: RxRow[] }>(`/prescriptions${qs}`);
      setPrescriptions(res.data);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load prescriptions.');
    }
  };

  const dispense = async (id: string) => {
    setDispensing(id);
    setError(null);
    try {
      const res = await apiFetch<{ stockWarnings: string[] }>(`/prescriptions/${id}/dispense`, { method: 'PATCH' });
      setWarnings(res.stockWarnings || []);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to mark dispensed.');
    } finally {
      setDispensing(null);
    }
  };

  return (
    <>
      <button onClick={() => setShowAll((v) => !v)} className="mb-4 px-3 py-1.5 rounded-lg bg-white/5 text-gray-300 text-xs font-medium hover:bg-white/10">
        {showAll ? 'Show pending only' : 'Show all'}
      </button>

      {error && <div className="mb-4 px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-sm">{error}</div>}
      {warnings.length > 0 && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-amber-500/10 text-amber-400 text-sm">
          {warnings.map((w, i) => <div key={i} className="flex items-center gap-1"><AlertTriangle size={12} /> {w}</div>)}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {prescriptions.length === 0 && <div className="text-center py-10 text-gray-500 text-sm">Nothing to dispense.</div>}
        {prescriptions.map((rx) => (
          <div key={rx.id} className={`p-4 rounded-xl border bg-white/[0.02] ${rx.dispensed ? 'border-white/10' : 'border-amber-500/30'}`}>
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="font-medium text-sm">{rx.patient.name}</span>
                <span className="text-xs text-gray-500 font-mono ml-2">{rx.patient.uhid}</span>
              </div>
              {rx.dispensed ? (
                <span className="flex items-center gap-1 text-xs text-emerald-400"><CheckCircle2 size={13} /> Dispensed</span>
              ) : (
                <Button variant="primary" size="sm" onClick={() => dispense(rx.id)} busy={dispensing === rx.id} busyLabel="Dispensing…">
                  Mark Dispensed
                </Button>
              )}
            </div>
            <div className="flex flex-col gap-0.5">
              {rx.items.map((item, i) => (
                <div key={i} className="text-sm text-gray-300">
                  <span className="font-medium text-white">{item.drugName}</span> — {item.dosage}, {item.frequency}, {item.duration}
                  {item.instructions && <span className="text-gray-500"> ({item.instructions})</span>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

interface Drug { id: string; name: string; manufacturer: string | null }
interface Batch { id: string; batchNumber: string; expiryDate: string; quantityInHand: number; reorderThreshold: number }
interface AlertBatch extends Batch { drug: { id: string; name: string } }

function Inventory() {
  const [alerts, setAlerts] = useState<{ expired: AlertBatch[]; nearExpiry: AlertBatch[]; lowStock: AlertBatch[] } | null>(null);
  const [search, setSearch] = useState('');
  const [drugOptions, setDrugOptions] = useState<Drug[]>([]);
  const [selectedDrug, setSelectedDrug] = useState<Drug | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ batchNumber: '', expiryDate: '', quantityInHand: '', reorderThreshold: '10' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    try {
      const res = await apiFetch<{ expired: AlertBatch[]; nearExpiry: AlertBatch[]; lowStock: AlertBatch[] }>('/inventory/alerts');
      setAlerts(res);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load alerts.');
    }
  };

  useEffect(() => {
    if (search.length < 2) {
      setDrugOptions([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await apiFetch<{ data: Drug[] }>(`/drugs?search=${encodeURIComponent(search)}`);
        setDrugOptions(res.data);
      } catch {
        // ignore
      }
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  const selectDrug = async (drug: Drug) => {
    setSelectedDrug(drug);
    setSearch(drug.name);
    setDrugOptions([]);
    try {
      const res = await apiFetch<{ data: Batch[] }>(`/drugs/${drug.id}/batches`);
      setBatches(res.data);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load batches.');
    }
  };

  const addBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDrug || !form.batchNumber || !form.expiryDate || !form.quantityInHand) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/drugs/${selectedDrug.id}/batches`, {
        method: 'POST',
        data: {
          batchNumber: form.batchNumber,
          expiryDate: new Date(form.expiryDate).toISOString(),
          quantityInHand: Number(form.quantityInHand),
          reorderThreshold: Number(form.reorderThreshold),
        },
      });
      setForm({ batchNumber: '', expiryDate: '', quantityInHand: '', reorderThreshold: '10' });
      const res = await apiFetch<{ data: Batch[] }>(`/drugs/${selectedDrug.id}/batches`);
      setBatches(res.data);
      await loadAlerts();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to add batch.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {error && <div className="px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-sm">{error}</div>}

      {alerts && (alerts.expired.length > 0 || alerts.nearExpiry.length > 0 || alerts.lowStock.length > 0) && (
        <div className="flex flex-col gap-2">
          {alerts.expired.length > 0 && <AlertBlock icon="🔴" label="Expired" color="border-red-500/30 bg-red-500/5 text-red-400" items={alerts.expired} />}
          {alerts.nearExpiry.length > 0 && <AlertBlock icon="🟡" label="Near Expiry (30 days)" color="border-amber-500/30 bg-amber-500/5 text-amber-400" items={alerts.nearExpiry} />}
          {alerts.lowStock.length > 0 && <AlertBlock icon="🟠" label="Low Stock" color="border-orange-500/30 bg-orange-500/5 text-orange-400" items={alerts.lowStock} />}
        </div>
      )}

      <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5"><Package size={14} /> Add / View Batches</h3>
        <div className="relative mb-3">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setSelectedDrug(null); }}
            placeholder="Search a medicine..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm outline-none focus:border-emerald-400"
          />
          {drugOptions.length > 0 && !selectedDrug && (
            <div className="absolute z-10 mt-1 w-full rounded-lg border border-white/10 bg-[#14171f] max-h-40 overflow-y-auto">
              {drugOptions.map((d) => (
                <button key={d.id} onClick={() => selectDrug(d)} className="block w-full text-left px-3 py-2 text-sm hover:bg-white/5">{d.name}</button>
              ))}
            </div>
          )}
        </div>

        {selectedDrug && (
          <>
            {batches.length > 0 && (
              <div className="flex flex-col gap-1 mb-3">
                {batches.map((b) => (
                  <div key={b.id} className="flex justify-between text-xs text-gray-400 py-1 border-b border-white/5 last:border-0">
                    <span>Batch {b.batchNumber} · Exp {new Date(b.expiryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                    <span>{b.quantityInHand} in stock</span>
                  </div>
                ))}
              </div>
            )}
            <form onSubmit={addBatch} className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <input placeholder="Batch No." value={form.batchNumber} onChange={(e) => setForm({ ...form, batchNumber: e.target.value })} className="px-2 py-2 rounded-lg bg-white/5 border border-white/10 text-xs outline-none" />
              <input type="date" placeholder="Expiry" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} className="px-2 py-2 rounded-lg bg-white/5 border border-white/10 text-xs outline-none" />
              <input placeholder="Qty" type="number" value={form.quantityInHand} onChange={(e) => setForm({ ...form, quantityInHand: e.target.value })} className="px-2 py-2 rounded-lg bg-white/5 border border-white/10 text-xs outline-none" />
              <input placeholder="Reorder at" type="number" value={form.reorderThreshold} onChange={(e) => setForm({ ...form, reorderThreshold: e.target.value })} className="px-2 py-2 rounded-lg bg-white/5 border border-white/10 text-xs outline-none" />
              <button type="submit" disabled={saving} className="col-span-2 sm:col-span-4 self-start flex items-center gap-1 px-3 py-2 rounded-lg bg-emerald-500 text-black text-xs font-semibold disabled:opacity-50">
                <Plus size={12} /> Add Batch
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

function AlertBlock({ icon, label, color, items }: { icon: string; label: string; color: string; items: AlertBatch[] }) {
  return (
    <div className={`p-3 rounded-xl border ${color}`}>
      <div className="text-xs font-semibold mb-1">{icon} {label} ({items.length})</div>
      <div className="flex flex-col gap-0.5">
        {items.slice(0, 8).map((b) => (
          <div key={b.id} className="text-xs opacity-90">
            {b.drug.name} · Batch {b.batchNumber} · {b.quantityInHand} units · Exp {new Date(b.expiryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
          </div>
        ))}
        {items.length > 8 && <div className="text-xs opacity-60">+{items.length - 8} more</div>}
      </div>
    </div>
  );
}
