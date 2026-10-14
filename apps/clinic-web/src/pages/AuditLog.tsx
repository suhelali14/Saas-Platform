import { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, Download, Filter, X, AlertTriangle, RefreshCw } from 'lucide-react';
import { SkeletonList, SkeletonTable, SkeletonStats, SkeletonForm, SkeletonPanels } from '../components/Skeleton';
import { apiFetch, ApiError, getApiBaseUrl } from '../lib/api';
import { Pick } from '../components/Field';
import { DatePicker } from '../components/DatePicker';
import { todayInput } from '../lib/date';

/**
 * The clinic's PHI access log, required by India's DPDP Act 2023 and NABH:
 * every access to a patient record logged with user, timestamp and what was
 * touched, in a form that survives an audit.
 *
 * Read-only by construction -- the API exposes no way to edit or delete an
 * entry, and this screen offers none either. Admin-gated, because the log
 * itself is sensitive: it reveals which staff member looked at which
 * patient.
 */

interface Entry {
  id: string; at: string; clinicUserId: string | null; userName: string; userRole: string;
  action: string; resource: string; patientId: string | null;
  method: string; path: string; statusCode: number; ip: string | null;
}
interface Filters { actions: string[]; resources: string[]; users: { id: string; name: string; role: string }[] }

const ACTION_STYLE: Record<string, string> = {
  VIEW: 'bg-foreground/10 text-foreground/80',
  CREATE: 'bg-emerald-500/15 text-emerald-400',
  UPDATE: 'bg-blue-500/15 text-blue-400',
  DELETE: 'bg-red-500/15 text-red-400',
  LOGIN: 'bg-teal-500/15 text-teal-300',
  LOGIN_FAILED: 'bg-red-500/20 text-red-300',
};

export function AuditLog() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [filters, setFilters] = useState<Filters | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const [action, setAction] = useState('');
  const [resource, setResource] = useState('');
  const [clinicUserId, setClinicUserId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const buildParams = useCallback(() => {
    const params = new URLSearchParams({ limit: '100' });
    if (action) params.set('action', action);
    if (resource) params.set('resource', resource);
    if (clinicUserId) params.set('clinicUserId', clinicUserId);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    return params;
  }, [action, resource, clinicUserId, from, to]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ entries: Entry[]; nextCursor: string | null }>(`/audit?${buildParams()}`);
      setEntries(res.entries);
      setNextCursor(res.nextCursor);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load the audit log.');
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    apiFetch<Filters>('/audit/filters').then(setFilters).catch(() => setFilters(null));
  }, []);

  const loadMore = async () => {
    if (!nextCursor) return;
    const params = buildParams();
    params.set('cursor', nextCursor);
    try {
      const res = await apiFetch<{ entries: Entry[]; nextCursor: string | null }>(`/audit?${params}`);
      setEntries((prev) => [...prev, ...res.entries]);
      setNextCursor(res.nextCursor);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load more.');
    }
  };

  const hasFilters = Boolean(action || resource || clinicUserId || from || to);
  const clearFilters = () => { setAction(''); setResource(''); setClinicUserId(''); setFrom(''); setTo(''); };
  const failedLogins = entries.filter((e) => e.action === 'LOGIN_FAILED').length;
  const denied = entries.filter((e) => e.statusCode === 403).length;

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-1">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <ShieldCheck size={20} className="text-emerald-400" /> Audit Log
        </h1>
        <div className="flex items-center gap-2">
          <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground/10 text-xs hover:bg-foreground/20">
            <RefreshCw size={12} /> Refresh
          </button>
          <DownloadCsvButton />
        </div>
      </div>
      <p className="text-sm text-muted-foreground mb-5 max-w-3xl">
        Every action taken on a patient record, recorded automatically. This log is append-only — nobody,
        including you, can edit or delete an entry through this system. Required for DPDP Act and NABH audits.
      </p>

      {/* Signals worth surfacing rather than leaving buried in the table. */}
      {(failedLogins > 0 || denied > 0) && (
        <div className="flex flex-wrap gap-2 mb-4">
          {failedLogins > 0 && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-xs">
              <AlertTriangle size={12} /> {failedLogins} failed sign-in {failedLogins === 1 ? 'attempt' : 'attempts'} in view
            </span>
          )}
          {denied > 0 && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 text-xs">
              <AlertTriangle size={12} /> {denied} permission {denied === 1 ? 'denial' : 'denials'} in view
            </span>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2 mb-4 p-3 rounded-xl border border-border/10 bg-foreground/[0.02]">
        <Filter size={14} className="text-muted-foreground/70 mb-2" />
        <FilterSelect label="Staff member" value={clinicUserId} onChange={setClinicUserId}
          options={(filters?.users ?? []).map((u) => ({ value: u.id, label: `${u.name} (${u.role})` }))} />
        <FilterSelect label="Action" value={action} onChange={setAction}
          options={(filters?.actions ?? []).map((a) => ({ value: a, label: a }))} />
        <FilterSelect label="Record type" value={resource} onChange={setResource}
          options={(filters?.resources ?? []).map((r) => ({ value: r, label: r }))} />
        <div>
          <label className="block text-[11px] text-muted-foreground/70 mb-1">From</label>
          <DatePicker value={from} onChange={setFrom} label="From date" quickDays={false} clearable />
        </div>
        <div>
          <label className="block text-[11px] text-muted-foreground/70 mb-1">To</label>
          <DatePicker value={to} onChange={setTo} label="To date" min={from || undefined} quickDays={false} clearable />
        </div>
        {hasFilters && (
          <button onClick={clearFilters} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-foreground/10 text-xs hover:bg-foreground/20">
            <X size={11} /> Clear
          </button>
        )}
      </div>

      {error && <div className="px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-sm mb-4">{error}</div>}

      <div className="rounded-xl border border-border/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[820px]">
            <thead className="bg-foreground/[0.03] text-muted-foreground text-xs">
              <tr>
                <Th>When</Th><Th>Who</Th><Th>Action</Th><Th>Record</Th><Th>Result</Th><Th>Request</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/5">
              {entries.map((e) => (
                <tr key={e.id} className="hover:bg-foreground/[0.02]">
                  <Td><span className="text-muted-foreground whitespace-nowrap">{formatWhen(e.at)}</span></Td>
                  <Td>
                    <div className="font-medium">{e.userName}</div>
                    <div className="text-[11px] text-muted-foreground/70">{e.userRole}</div>
                  </Td>
                  <Td>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${ACTION_STYLE[e.action] ?? 'bg-foreground/10 text-foreground/80'}`}>
                      {e.action}
                    </span>
                  </Td>
                  <Td><span className="text-foreground/80">{e.resource}</span></Td>
                  <Td>
                    <span className={e.statusCode >= 400 ? 'text-red-400' : 'text-muted-foreground/70'}>
                      {e.statusCode}{e.statusCode === 403 ? ' denied' : ''}
                    </span>
                  </Td>
                  <Td>
                    <span className="text-[11px] text-muted-foreground/70 font-mono break-all">{e.method} {e.path}</span>
                  </Td>
                </tr>
              ))}
              {entries.length === 0 && !loading && (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground/60 text-sm">
                  {hasFilters ? 'No entries match these filters.' : 'No activity recorded yet.'}
                </td></tr>
              )}
              {loading && entries.length === 0 && (
                <tr><td colSpan={6} className="p-0">
                  <SkeletonTable rows={8} columns={6} label="Loading the audit log" />
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {nextCursor && (
        <button onClick={loadMore} className="mt-3 px-4 py-2 rounded-lg bg-foreground/10 text-sm hover:bg-foreground/20">
          Load older entries
        </button>
      )}
    </div>
  );
}

/** The CSV goes through a real fetch rather than a plain link: the export
 * route needs the Authorization header, which an <a href> can't send. */
function DownloadCsvButton() {
  const [busy, setBusy] = useState(false);

  const download = async () => {
    setBusy(true);
    try {
      const token = localStorage.getItem('clinicAccessToken');
      const apiBase = getApiBaseUrl();
      const res = await fetch(`${apiBase}/export/csv/audit`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-log-${todayInput()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Surfaced by the button returning to its normal state; the audit
      // screen itself stays usable.
    } finally {
      setBusy(false);
    }
  };

  return (
    <button onClick={download} disabled={busy} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground/10 text-xs hover:bg-foreground/20 disabled:opacity-50">
      <Download size={12} /> {busy ? 'Exporting…' : 'Export CSV'}
    </button>
  );
}

const selectCls = 'px-2.5 py-1.5 rounded-lg bg-foreground/5 border border-border/10 text-xs outline-none focus:border-primary';

function FilterSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="block text-[11px] text-muted-foreground/70 mb-1">{label}</label>
      <Pick value={value} onChange={onChange} emptyLabel="All" options={options} />
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 text-left font-medium">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2 align-top">{children}</td>;
}

/** Local time, not UTC -- an audit entry read by a clinic in IST must show
 * the hour that clinic experienced. */
function formatWhen(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
}
