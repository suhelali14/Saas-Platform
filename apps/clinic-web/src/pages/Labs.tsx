import { useState, useEffect } from 'react';
import { FlaskConical, CheckCircle2, Download, Upload } from 'lucide-react';
import { Button } from '../components/Button';
import { apiFetch, openPdf, ApiError, getApiBaseUrl } from '../lib/api';
import { useAssistantChanged } from '../lib/assistant-changed';

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

  // The assistant changed something: show it.
  useAssistantChanged(() => { void load(); });
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

  // One card for each patient. A patient with three orders was three
  // cards scattered down the page, and whoever was entering results from
  // one printed report had to hunt for the other two.
  const byPatient = new Map<string, { patient: LabOrderRow['patient']; orders: LabOrderRow[] }>();
  for (const order of orders) {
    const group = byPatient.get(order.patient.uhid) ?? { patient: order.patient, orders: [] };
    group.orders.push(order);
    byPatient.set(order.patient.uhid, group);
  }
  const groups = [...byPatient.values()];
  const awaited = orders.flatMap((o) => o.items).filter((i) => !i.completedAt).length;
  const shortDay = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2"><FlaskConical size={20} className="text-muted-foreground" /> Lab orders</h1>
        <button onClick={() => setShowAll((v) => !v)} className="px-3 py-1.5 rounded-lg bg-foreground/5 text-foreground/80 text-[13px] font-medium hover:bg-foreground/10">
          {showAll ? 'Show only results awaited' : 'Show finished ones too'}
        </button>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        {orders.length === 0
          ? 'Tests the doctor orders appear here, to have their results typed in or the report attached.'
          : `${awaited} result${awaited === 1 ? '' : 's'} awaited, for ${groups.length} patient${groups.length === 1 ? '' : 's'}. Type the result and press Save, or attach the lab's report.`}
      </p>

      {error && <div className="mb-4 px-3 py-2 rounded-lg tone-danger text-sm">{error}</div>}

      {orders.length === 0 && (
        <div className="rounded-xl border border-dashed border-border/25 px-5 py-10 text-center text-[14px] text-muted-foreground">
          {showAll ? 'No tests have been ordered yet.' : 'No results are awaited. Every test ordered has its result.'}
        </div>
      )}
      {/* Two columns that pack downwards, so a patient with one test does
          not leave a hole beside a patient with eight. */}
      <div className="gap-4 lg:columns-2">
        {groups.map(({ patient, orders: theirs }) => (
          <section key={patient.uhid} className={`mb-4 break-inside-avoid rounded-xl border bg-card p-4 ${theirs.some((o) => o.status === 'ORDERED') ? 'border-ink-warning/30' : 'border-border/15'}`}>
            <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-[15px] font-semibold">{patient.name} <span className="ml-1 font-mono text-xs font-normal text-muted-foreground">{patient.uhid}</span></h2>
              {theirs.every((o) => o.status === 'COMPLETED') && <span className="flex items-center gap-1 text-[13px] text-ink-success"><CheckCircle2 size={13} /> All results in</span>}
            </header>
            <div className="flex flex-col gap-2">
              {theirs.flatMap((order) => order.items.map((item) => (
                <div key={item.id} className="rounded-lg border border-border/10 bg-background/60 p-2.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                    <span className="text-[14px] font-medium">
                      {item.testName}
                      {/* Shown beside the name rather than only in the input,
                          so it is still there when someone reads the result
                          back weeks later -- which is when the reference
                          actually gets used. */}
                      {item.normalRange && (
                        <span className="ml-2 font-normal text-[12px] text-muted-foreground" title="Indicative adult reference range. Intervals vary by laboratory and method -- the range printed on the lab's own report governs.">
                          normal {item.normalRange}
                        </span>
                      )}
                    </span>
                    <span className="text-[12px] text-muted-foreground">Dr. {order.doctor.name.replace(/^Dr\.?\s*/i, '')} · {shortDay(order.createdAt)}</span>
                  </div>
                  {item.resultText && <p className="mt-1 text-[14px]"><span className="text-muted-foreground">Result: </span>{item.resultText}</p>}
                  {item.resultFilePath && (
                    <button onClick={() => openPdf(`/lab-orders/items/${item.id}/file`)} className="mt-1 flex items-center gap-1 text-[13px] font-medium text-ink-success hover:underline">
                      <Download size={12} /> {item.resultFileName}
                    </button>
                  )}
                  {!item.completedAt && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <input
                        aria-label={`Result of ${item.testName} for ${patient.name}`}
                        placeholder="Type the result"
                        value={resultDrafts[item.id] || ''}
                        onChange={(e) => setResultDrafts({ ...resultDrafts, [item.id]: e.target.value })}
                        onKeyDown={(e) => { if (e.key === 'Enter') void saveResultText(item.id); }}
                        className="min-w-0 flex-1 rounded-lg border border-border/15 bg-foreground/5 px-2.5 py-2 text-[14px] outline-none focus:border-ring"
                      />
                      <Button size="sm" onClick={() => saveResultText(item.id)} busy={saving === item.id}>Save</Button>
                      <label className="flex cursor-pointer items-center gap-1 rounded-lg bg-foreground/10 px-2.5 py-2 text-[13px] font-medium hover:bg-foreground/20" title="Attach the lab's report (PDF or photo)">
                        <Upload size={12} /> Report
                        <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadResultFile(item.id, f); e.target.value = ''; }} />
                      </label>
                    </div>
                  )}
                </div>
              )))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
