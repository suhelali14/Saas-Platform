import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, FileText, Check, X } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { openDocumentFile } from '../lib/file';

interface KycDoc {
  id: string;
  type: string;
  fileName: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason: string | null;
  uploadedAt: string;
}

interface BusinessDetail {
  id: string;
  name: string;
  type: string | null;
  city: string;
  address: string | null;
  email: string | null;
  phone: string | null;
  panNumber: string | null;
  gstin: string | null;
  noGstinDeclared: boolean;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  verificationNotes: string | null;
  documents: KycDoc[];
}

export function KycDetail() {
  const { id } = useParams<{ id: string }>();
  const [business, setBusiness] = useState<BusinessDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [rejectingDocId, setRejectingDocId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    load();
  }, [id]);

  const load = async () => {
    try {
      const res = await apiFetch<BusinessDetail>(`/kyc/businesses/${id}`);
      setBusiness(res);
      setNotes(res.verificationNotes || '');
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Could not load this business.');
    }
  };

  const reviewDocument = async (docId: string, status: 'APPROVED' | 'REJECTED', reason?: string) => {
    setActionError(null);
    try {
      await apiFetch(`/kyc/documents/${docId}/review`, { method: 'POST', data: { status, rejectionReason: reason } });
      setRejectingDocId(null);
      setRejectionReason('');
      await load();
    } catch (e: any) {
      setActionError(e?.message || 'Failed to review document.');
    }
  };

  const decideBusiness = async (status: 'VERIFIED' | 'REJECTED') => {
    setActionError(null);
    try {
      await apiFetch(`/kyc/businesses/${id}/decision`, { method: 'POST', data: { status, notes } });
      await load();
    } catch (e: any) {
      setActionError(e?.message || 'Failed to update verification status.');
    }
  };

  if (error) return <div className="p-8 text-red-400">{error}</div>;
  if (!business) return <div className="p-8 text-gray-400">Loading...</div>;

  return (
    <div className="p-8 max-w-3xl">
      <Link to="/kyc" className="flex items-center gap-1 text-sm text-gray-400 hover:text-white mb-4"><ArrowLeft size={14} /> Back to queue</Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">{business.name}</h1>
          <p className="text-sm text-gray-400">{business.type} · {business.city}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
          business.verificationStatus === 'VERIFIED' ? 'bg-emerald-500/15 text-emerald-400' :
          business.verificationStatus === 'REJECTED' ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-400'
        }`}>{business.verificationStatus}</span>
      </div>

      {actionError && <div className="mb-4 px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-sm">{actionError}</div>}

      <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
        <div className="p-3 rounded-lg bg-white/[0.03] border border-white/10">
          <div className="text-xs text-gray-500 mb-1">PAN Number</div>
          <div>{business.panNumber || <span className="text-gray-600">Not provided</span>}</div>
        </div>
        <div className="p-3 rounded-lg bg-white/[0.03] border border-white/10">
          <div className="text-xs text-gray-500 mb-1">GSTIN</div>
          <div>{business.gstin || (business.noGstinDeclared ? 'Declared: no GSTIN' : <span className="text-gray-600">Not provided</span>)}</div>
        </div>
        <div className="p-3 rounded-lg bg-white/[0.03] border border-white/10">
          <div className="text-xs text-gray-500 mb-1">Contact</div>
          <div>{business.email || '—'}</div>
          <div className="text-gray-400">{business.phone || '—'}</div>
        </div>
        <div className="p-3 rounded-lg bg-white/[0.03] border border-white/10">
          <div className="text-xs text-gray-500 mb-1">Address</div>
          <div>{business.address || business.city}</div>
        </div>
      </div>

      <h2 className="text-sm font-semibold mb-3">Documents</h2>
      <div className="flex flex-col gap-2 mb-6">
        {business.documents.length === 0 && <p className="text-sm text-gray-500">No documents uploaded yet.</p>}
        {business.documents.map((doc) => (
          <div key={doc.id} className="p-3 rounded-lg bg-white/[0.03] border border-white/10">
            <div className="flex items-center justify-between">
              <button onClick={() => openDocumentFile(doc.id)} className="flex items-center gap-2 text-sm hover:underline">
                <FileText size={15} className="text-gray-400" />
                <span>{doc.type.replace(/_/g, ' ')}</span>
                <span className="text-gray-500 text-xs">({doc.fileName})</span>
              </button>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                doc.status === 'APPROVED' ? 'bg-emerald-500/15 text-emerald-400' :
                doc.status === 'REJECTED' ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-400'
              }`}>{doc.status}</span>
            </div>
            {doc.rejectionReason && <div className="mt-1 text-xs text-red-400">Rejected: {doc.rejectionReason}</div>}
            {doc.status === 'PENDING' && (
              <div className="mt-2 flex items-center gap-2">
                <button onClick={() => reviewDocument(doc.id, 'APPROVED')} className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-500/15 text-emerald-400 text-xs font-medium">
                  <Check size={12} /> Approve
                </button>
                {rejectingDocId === doc.id ? (
                  <>
                    <input
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Reason for rejection"
                      className="px-2 py-1 rounded-md bg-white/5 border border-white/10 text-xs flex-1"
                    />
                    <button
                      onClick={() => reviewDocument(doc.id, 'REJECTED', rejectionReason)}
                      disabled={!rejectionReason.trim()}
                      className="px-2.5 py-1 rounded-md bg-red-500/15 text-red-400 text-xs font-medium disabled:opacity-40"
                    >
                      Confirm
                    </button>
                  </>
                ) : (
                  <button onClick={() => setRejectingDocId(doc.id)} className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-red-500/15 text-red-400 text-xs font-medium">
                    <X size={12} /> Reject
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <h2 className="text-sm font-semibold mb-3">Overall Decision</h2>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes for this decision (visible to the business)"
        rows={3}
        className="w-full mb-3 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm outline-none focus:border-emerald-400"
      />
      <div className="flex gap-2">
        <button onClick={() => decideBusiness('VERIFIED')} className="px-4 py-2 rounded-lg bg-emerald-500 text-black text-sm font-semibold">
          Approve Business
        </button>
        <button onClick={() => decideBusiness('REJECTED')} className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 text-sm font-semibold">
          Reject Business
        </button>
      </div>
    </div>
  );
}
