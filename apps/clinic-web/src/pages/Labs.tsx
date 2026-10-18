import { useState, useEffect } from 'react';
import { FlaskConical, CheckCircle2, Download, Upload } from 'lucide-react';
import { Button } from '../components/Button';
import { apiFetch, openPdf, ApiError, getApiBaseUrl } from '../lib/api';

// `normalRange` comes from the clinic's test catalogue, joined by name on
// the server. Null when the test was typed in free-hand and matches no
// catalogue entry, so every use of it has to tolerate that.
interface LabItem { id: string; testName: string; normalRange: string | null; resultText: string | null; resultFilePath: string | null; resultFileName: string | null; completedAt: string | null }
interface LabOrderRow {
  id: string; createdAt: string; status: string;
  patient: { id: string; name: string; uhid: string };
  doctor: { name: string };
  items: LabItem[];
}

export function Labs() {
  const [orders, setOrders] = useState<LabOrderRow[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultDrafts, setResultDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, [showAll]);

  const load = async () => {
    try {
      const qs = showAll ? '' : '?status=ORDERED';
      const res = await apiFetch<{ data: LabOrderRow[] }>(`/lab-orders${qs}`);
      setOrders(res.data);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load lab orders.');
    }
  };

  const saveResultText = async (itemId: string) => {
    const text = resultDrafts[itemId];
    if (!text?.trim()) return;
    setSaving(itemId);
    setError(null);
    try {
      await apiFetch(`/lab-orders/items/${itemId}`, { method: 'PATCH', data: { resultText: text } });
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to save result.');
    } finally {
      setSaving(null);
    }
  };

  const uploadResultFile = async (itemId: string, file: File) => {
    setSaving(itemId);
    setError(null);
    try {
      const token = localStorage.getItem('clinicAccessToken');
      const apiBase = getApiBaseUrl();
      const body = new FormData();
      body.append('file', file);
      const res = await fetch(`${apiBase}/lab-orders/items/${itemId}/result-file`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Upload failed');
      }
      await load();
    } catch (e: any) {
      setError(e?.message || 'Upload failed.');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2"><FlaskConical size={20} className="text-muted-foreground" /> Lab Orders</h1>
        <button onClick={() => setShowAll((v) => !v)} className="px-3 py-1.5 rounded-lg bg-foreground/5 text-foreground/80 text-xs font-medium hover:bg-foreground/10">
          {showAll ? 'Show pending only' : 'Show all'}
        </button>
      </div>
      <p className="text-sm text-muted-foreground mb-6">Tests ordered during consultation -- enter or upload results as they come back.</p>

      {error && <div className="mb-4 px-3 py-2 rounded-lg tone-danger text-sm">{error}</div>}

      <div className="flex flex-col gap-3">
        {orders.length === 0 && <div className="text-center py-10 text-muted-foreground/70 text-sm">No lab orders.</div>}
        {orders.map((order) => (
          <div key={order.id} className={`p-4 rounded-xl border bg-foreground/[0.02] ${order.status === 'ORDERED' ? 'border-ink-warning/30' : 'border-border/10'}`}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="font-medium text-sm">{order.patient.name}</span>
                <span className="text-xs text-muted-foreground/70 font-mono ml-2">{order.patient.uhid}</span>
                <div className="text-xs text-muted-foreground/70">Ordered by Dr. {order.doctor.name} · {new Date(order.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</div>
              </div>
              {order.status === 'COMPLETED' && <span className="flex items-center gap-1 text-xs text-ink-success"><CheckCircle2 size={13} /> Completed</span>}
            </div>
            <div className="flex flex-col gap-2">
              {order.items.map((item) => (
                <div key={item.id} className="p-2.5 rounded-lg bg-foreground/[0.02] border border-border/5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">
                      {item.testName}
                      {/* Shown beside the name rather than only in the input,
                          so it is still there when someone reads the result
                          back weeks later -- which is when the reference
                          actually gets used. */}
                      {item.normalRange && (
                        <span className="ml-2 font-normal text-[11px] text-muted-foreground/70" title="Indicative adult reference range. Intervals vary by laboratory and method -- the range printed on the lab's own report governs.">
                          ref {item.normalRange}
                        </span>
                      )}
                    </span>
                    {item.completedAt && <span className="text-[10px] text-ink-success">Done</span>}
                  </div>
                  {item.resultText && <p className="text-xs text-foreground/80 mb-1">{item.resultText}</p>}
                  {item.resultFilePath && (
                    <button onClick={() => openPdf(`/lab-orders/items/${item.id}/file`)} className="flex items-center gap-1 text-xs text-ink-success hover:underline mb-1">
                      <Download size={11} /> {item.resultFileName}
                    </button>
                  )}
                  {!item.completedAt && (
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        placeholder={item.normalRange ? `Enter result  (ref ${item.normalRange})` : 'Enter result...'}
                        value={resultDrafts[item.id] || ''}
                        onChange={(e) => setResultDrafts({ ...resultDrafts, [item.id]: e.target.value })}
                        className="flex-1 px-2 py-1.5 rounded-lg bg-foreground/5 border border-border/10 text-xs outline-none"
                      />
                      <Button size="sm" onClick={() => saveResultText(item.id)} busy={saving === item.id}>Save</Button>
                      <label className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-foreground/10 text-xs hover:bg-foreground/20 cursor-pointer">
                        <Upload size={11} />
                        <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadResultFile(item.id, f); e.target.value = ''; }} />
                      </label>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
