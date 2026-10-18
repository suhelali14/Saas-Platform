import { useState, useEffect } from 'react';
import { Pill, CheckCircle2, AlertTriangle, Search, Plus, Package, Ban, Clock, PackageMinus } from 'lucide-react';
import { Button } from '../components/Button';
import { apiFetch, ApiError } from '../lib/api';
import { DatePicker } from '../components/DatePicker';
import { SegmentedControl } from '../components/SegmentedControl';

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
      <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2 mb-1"><Pill size={20} className="text-muted-foreground" /> Pharmacy</h1>
      <p className="text-sm text-muted-foreground mb-4">Dispensing queue and stock management.</p>
      <SegmentedControl
        label="Pharmacy view"
        className="mb-6"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'dispensing', label: 'Dispensing' },
          { value: 'inventory', label: 'Inventory' },
        ]}
      />
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
      <button onClick={() => setShowAll((v) => !v)} className="mb-4 px-3 py-1.5 rounded-lg bg-foreground/5 text-foreground/80 text-xs font-medium hover:bg-foreground/10">
        {showAll ? 'Show pending only' : 'Show all'}
      </button>

      {error && <div className="mb-4 px-3 py-2 rounded-lg tone-danger text-sm">{error}</div>}
      {warnings.length > 0 && (
        <div className="mb-4 px-3 py-2 rounded-lg tone-warning text-sm">
          {warnings.map((w, i) => <div key={i} className="flex items-center gap-1"><AlertTriangle size={12} /> {w}</div>)}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {prescriptions.length === 0 && <div className="text-center py-10 text-muted-foreground/70 text-sm">Nothing to dispense.</div>}
        {prescriptions.map((rx) => (
          <div key={rx.id} className={`p-4 rounded-xl border bg-foreground/[0.02] ${rx.dispensed ? 'border-border/10' : 'border-ink-warning/30'}`}>
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="font-medium text-sm">{rx.patient.name}</span>
                <span className="text-xs text-muted-foreground/70 font-mono ml-2">{rx.patient.uhid}</span>
              </div>
              {rx.dispensed ? (
                <span className="flex items-center gap-1 text-xs text-ink-success"><CheckCircle2 size={13} /> Dispensed</span>
              ) : (
                <Button variant="primary" size="sm" onClick={() => dispense(rx.id)} busy={dispensing === rx.id} busyLabel="Dispensing…">
                  Mark Dispensed
                </Button>
              )}
            </div>
            <div className="flex flex-col gap-0.5">
              {rx.items.map((item, i) => (
                <div key={i} className="text-sm text-foreground/80">
                  <span className="font-medium text-foreground">{item.drugName}</span> — {item.dosage}, {item.frequency}, {item.duration}
                  {item.instructions && <span className="text-muted-foreground/70"> ({item.instructions})</span>}
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
      {error && <div className="px-3 py-2 rounded-lg tone-danger text-sm">{error}</div>}

      {alerts && (alerts.expired.length > 0 || alerts.nearExpiry.length > 0 || alerts.lowStock.length > 0) && (
        <div className="flex flex-col gap-2">
          {alerts.expired.length > 0 && <AlertBlock icon={Ban} label="Expired" tone="danger" items={alerts.expired} />}
          {alerts.nearExpiry.length > 0 && <AlertBlock icon={Clock} label="Near Expiry (30 days)" tone="warning" items={alerts.nearExpiry} />}
          {/* Low stock is the one of the three you can still dispense
              against, so it is the one that is not a warm colour. */}
          {alerts.lowStock.length > 0 && <AlertBlock icon={PackageMinus} label="Low Stock" tone="info" items={alerts.lowStock} />}
        </div>
      )}

      <div className="p-4 rounded-xl border border-border/10 bg-foreground/[0.02]">
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5"><Package size={14} /> Add / View Batches</h3>
        <div className="relative mb-3">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/70" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setSelectedDrug(null); }}
            placeholder="Search a medicine..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-foreground/5 border border-border/10 text-sm outline-none focus:border-primary"
          />
          {drugOptions.length > 0 && !selectedDrug && (
            <div className="absolute z-10 mt-1 w-full rounded-lg border border-border/10 bg-[#14171f] max-h-40 overflow-y-auto">
              {drugOptions.map((d) => (
                <button key={d.id} onClick={() => selectDrug(d)} className="block w-full text-left px-3 py-2 text-sm hover:bg-foreground/5">{d.name}</button>
              ))}
            </div>
          )}
        </div>

        {selectedDrug && (
          <>
            {batches.length > 0 && (
              <div className="flex flex-col gap-1 mb-3">
                {batches.map((b) => (
                  <div key={b.id} className="flex justify-between text-xs text-muted-foreground py-1 border-b border-border/5 last:border-0">
                    <span>Batch {b.batchNumber} · Exp {new Date(b.expiryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                    <span>{b.quantityInHand} in stock</span>
                  </div>
                ))}
              </div>
            )}
            <form onSubmit={addBatch} className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <input placeholder="Batch No." value={form.batchNumber} onChange={(e) => setForm({ ...form, batchNumber: e.target.value })} className="px-2 py-2 rounded-lg bg-foreground/5 border border-border/10 text-xs outline-none" />
              {/* No "Today"/"Tomorrow" here: an expiry is months or years out,
                  and no min date either -- receiving a batch that is already
                  expired is a real case the FEFO logic has to see. */}
              <DatePicker value={form.expiryDate} onChange={(iso) => setForm({ ...form, expiryDate: iso })} label="Batch expiry date" placeholder="Expiry" quickDays={false} />
              <input placeholder="Qty" type="number" value={form.quantityInHand} onChange={(e) => setForm({ ...form, quantityInHand: e.target.value })} className="px-2 py-2 rounded-lg bg-foreground/5 border border-border/10 text-xs outline-none" />
              <input placeholder="Reorder at" type="number" value={form.reorderThreshold} onChange={(e) => setForm({ ...form, reorderThreshold: e.target.value })} className="px-2 py-2 rounded-lg bg-foreground/5 border border-border/10 text-xs outline-none" />
              <button type="submit" disabled={saving} className="col-span-2 sm:col-span-4 self-start flex items-center gap-1 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50">
                <Plus size={12} /> Add Batch
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

/*
 * Spelled out, not built with `tone-${tone}`.
 *
 * The tone classes live in a Tailwind `@layer components`, and Tailwind
 * prunes that layer against a scan of the source -- it cannot see a class
 * name assembled from a variable at runtime. This worked only because
 * every tone here also appears as a literal somewhere else in the app
 * (`tone-info` on the nurse role badge, for one), so deleting an
 * unrelated badge would have silently un-coloured this alert.
 */
const ALERT_TONE = {
  danger: 'tone-danger',
  warning: 'tone-warning',
  info: 'tone-info',
} as const;

function AlertBlock({ icon: Icon, label, tone, items }: {
  icon: typeof Ban; label: string; tone: keyof typeof ALERT_TONE; items: AlertBatch[];
}) {
  return (
    <div className={`p-3 rounded-xl ${ALERT_TONE[tone]} tone-block`}>
      <div className="flex items-center gap-1.5 text-xs font-semibold mb-1">
        <Icon size={13} className="shrink-0" aria-hidden />
        {label} ({items.length})
      </div>
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
