import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../lib/api';

interface TicketRow {
  id: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  business: { name: string };
  assignedAdmin: { name: string } | null;
  updatedAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-amber-500/15 text-amber-400',
  IN_PROGRESS: 'bg-blue-500/15 text-blue-400',
  RESOLVED: 'bg-emerald-500/15 text-emerald-400',
  CLOSED: 'bg-gray-500/15 text-gray-400',
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'text-gray-400',
  MEDIUM: 'text-gray-300',
  HIGH: 'text-orange-400',
  URGENT: 'text-red-400',
};

export function Tickets() {
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [statusFilter, setStatusFilter] = useState('OPEN');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, [statusFilter]);

  const load = async () => {
    try {
      const qs = statusFilter ? `?status=${statusFilter}` : '';
      const res = await apiFetch<{ data: TicketRow[] }>(`/tickets${qs}`);
      setTickets(res.data);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Could not load tickets.');
    }
  };

  return (
    <div className="p-8 max-w-5xl">
      <h1 className="text-xl font-bold mb-1">Support Tickets</h1>
      <p className="text-sm text-gray-400 mb-6">Business-raised issues, questions, and KYC follow-ups.</p>

      <div className="flex gap-2 mb-4">
        {['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', ''].map((s) => (
          <button
            key={s || 'ALL'}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium ${statusFilter === s ? 'bg-white text-black' : 'bg-white/5 text-gray-300'}`}
          >
            {s.replace('_', ' ') || 'All'}
          </button>
        ))}
      </div>

      {error && <div className="mb-4 px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-sm">{error} <button onClick={load} className="underline">Retry</button></div>}

      <div className="rounded-xl border border-white/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white/5 text-gray-400 text-xs uppercase tracking-wide">
              <th className="text-left px-4 py-3">Subject</th>
              <th className="text-left px-4 py-3">Business</th>
              <th className="text-left px-4 py-3">Category</th>
              <th className="text-left px-4 py-3">Priority</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Updated</th>
            </tr>
          </thead>
          <tbody>
            {tickets.length === 0 && (
              <tr><td colSpan={6} className="text-center py-10 text-gray-500">No tickets in this state.</td></tr>
            )}
            {tickets.map((t) => (
              <tr key={t.id} className="border-t border-white/5 hover:bg-white/[0.03]">
                <td className="px-4 py-3"><Link to={`/tickets/${t.id}`} className="font-medium hover:underline">{t.subject}</Link></td>
                <td className="px-4 py-3 text-gray-300">{t.business.name}</td>
                <td className="px-4 py-3 text-gray-400 text-xs">{t.category.replace(/_/g, ' ')}</td>
                <td className={`px-4 py-3 text-xs font-medium ${PRIORITY_COLORS[t.priority]}`}>{t.priority}</td>
                <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[t.status]}`}>{t.status.replace('_', ' ')}</span></td>
                <td className="px-4 py-3 text-gray-400 text-xs">{new Date(t.updatedAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
