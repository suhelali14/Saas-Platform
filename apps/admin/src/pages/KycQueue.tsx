import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { apiFetch } from '../lib/api';

interface BusinessRow {
  id: string;
  name: string;
  type: string | null;
  city: string;
  email: string | null;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  createdAt: string;
  _count: { kycDocuments: number };
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-amber-500/15 text-amber-400',
  VERIFIED: 'bg-emerald-500/15 text-emerald-400',
  REJECTED: 'bg-red-500/15 text-red-400',
};

export function KycQueue() {
  const [businesses, setBusinesses] = useState<BusinessRow[]>([]);
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, [statusFilter]);

  const load = async () => {
    setLoading(true);
    try {
      const qs = statusFilter ? `?status=${statusFilter}` : '';
      const res = await apiFetch<{ data: BusinessRow[] }>(`/kyc/businesses${qs}`);
      setBusinesses(res.data);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Could not load businesses.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-5xl">
      <h1 className="text-xl font-bold mb-1">KYC Review Queue</h1>
      <p className="text-sm text-gray-400 mb-6">Review submitted documents and approve or reject business verification.</p>

      <div className="flex gap-2 mb-4">
        {['PENDING', 'VERIFIED', 'REJECTED', ''].map((s) => (
          <button
            key={s || 'ALL'}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium ${statusFilter === s ? 'bg-white text-black' : 'bg-white/5 text-gray-300'}`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {error && <div className="mb-4 px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-sm">{error} <button onClick={load} className="underline">Retry</button></div>}

      <div className="rounded-xl border border-white/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white/5 text-gray-400 text-xs uppercase tracking-wide">
              <th className="text-left px-4 py-3">Business</th>
              <th className="text-left px-4 py-3">Type</th>
              <th className="text-left px-4 py-3">City</th>
              <th className="text-left px-4 py-3">Documents</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Submitted</th>
            </tr>
          </thead>
          <tbody>
            {!loading && businesses.length === 0 && (
              <tr><td colSpan={6} className="text-center py-10 text-gray-500">No businesses in this state.</td></tr>
            )}
            {businesses.map((b) => (
              <tr key={b.id} className="border-t border-white/5 hover:bg-white/[0.03]">
                <td className="px-4 py-3">
                  <Link to={`/kyc/${b.id}`} className="font-medium text-white hover:underline">{b.name}</Link>
                  <div className="text-xs text-gray-500">{b.email}</div>
                </td>
                <td className="px-4 py-3 text-gray-300">{b.type || '—'}</td>
                <td className="px-4 py-3 text-gray-300">{b.city}</td>
                <td className="px-4 py-3 text-gray-300 flex items-center gap-1"><FileText size={13} /> {b._count.kycDocuments}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[b.verificationStatus]}`}>{b.verificationStatus}</span>
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">{new Date(b.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
