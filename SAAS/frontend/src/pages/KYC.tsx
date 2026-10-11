import { useState, useEffect, useRef } from 'react';
import { useApi } from '../hooks/useApi';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { ShieldCheck, FileText, Upload, CheckCircle2, XCircle, Clock } from 'lucide-react';

// Platform trust layer -- business-side KYC (docs/plans platform-trust-layer).

const DOCUMENT_TYPES: { id: string; label: string }[] = [
  { id: 'PAN_CARD', label: 'PAN Card' },
  { id: 'BUSINESS_REGISTRATION', label: 'Business Registration Proof' },
  { id: 'GST_CERTIFICATE', label: 'GST Certificate' },
  { id: 'CANCELLED_CHEQUE', label: 'Cancelled Cheque' },
  { id: 'SIGNATORY_ID', label: 'Authorized Signatory ID' },
];

const STATUS_BADGE: Record<string, { icon: any; color: string; label: string }> = {
  PENDING: { icon: Clock, color: '#f59e0b', label: 'Under Review' },
  APPROVED: { icon: CheckCircle2, color: '#10b981', label: 'Approved' },
  REJECTED: { icon: XCircle, color: '#ef4444', label: 'Rejected' },
};

interface KycDoc {
  id: string;
  type: string;
  fileName: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason: string | null;
  uploadedAt: string;
}

export function KYC() {
  const { fetchWithAuth } = useApi();
  const [status, setStatus] = useState<any>(null);
  const [panNumber, setPanNumber] = useState('');
  const [gstin, setGstin] = useState('');
  const [noGstin, setNoGstin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailsSaved, setDetailsSaved] = useState(false);
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingUploadType, setPendingUploadType] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      const res = await fetchWithAuth('/kyc/status');
      setStatus(res.data);
      setPanNumber(res.data.panNumber || '');
      setGstin(res.data.gstin || '');
      setNoGstin(res.data.noGstinDeclared || false);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Could not load KYC status.');
    }
  };

  const saveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await fetchWithAuth('/kyc/details', { method: 'PUT', data: { panNumber: panNumber || undefined, gstin: noGstin ? undefined : gstin || undefined, noGstinDeclared: noGstin } });
      setDetailsSaved(true);
      setTimeout(() => setDetailsSaved(false), 3000);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to save details.');
    }
  };

  const triggerUpload = (type: string) => {
    setPendingUploadType(type);
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !pendingUploadType) return;

    setUploadingType(pendingUploadType);
    setError(null);
    try {
      const token = localStorage.getItem('accessToken');
      const form = new FormData();
      form.append('type', pendingUploadType);
      form.append('file', file);
      const apiBase = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api/biz');
      const response = await fetch(`${apiBase}/kyc/documents`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error?.message || 'Upload failed');
      await load();
    } catch (e: any) {
      setError(e?.message || 'Upload failed.');
    } finally {
      setUploadingType(null);
      setPendingUploadType(null);
    }
  };

  const docFor = (type: string): KycDoc | undefined => status?.documents?.find((d: KycDoc) => d.type === type);

  if (!status) return <div style={{ padding: 40, color: 'var(--text-secondary)' }}>{error || 'Loading...'}</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 700 }}>
      <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={handleFileSelected} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Business Verification (KYC)</h1>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0' }}>Verify your business to unlock the full platform and build customer trust.</p>
        </div>
        <span style={{
          display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 8,
          background: status.verificationStatus === 'VERIFIED' ? 'rgba(16,185,129,0.12)' : status.verificationStatus === 'REJECTED' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)',
          color: status.verificationStatus === 'VERIFIED' ? '#10b981' : status.verificationStatus === 'REJECTED' ? '#ef4444' : '#f59e0b',
        }}>
          <ShieldCheck size={13} /> {status.verificationStatus}
        </span>
      </div>

      {error && <div className="badge badge-error p-3 w-full text-center block">{error}</div>}
      {status.verificationNotes && (
        <div style={{ padding: '10px 14px', background: 'var(--bg-tertiary)', borderRadius: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
          <strong>Note from our team:</strong> {status.verificationNotes}
        </div>
      )}

      <Card>
        <CardHeader title="Business Identity" subtitle="Used to verify your business, matched against your uploaded documents." />
        <CardBody>
          <form onSubmit={saveDetails} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Input label="PAN Number" value={panNumber} onChange={(e) => setPanNumber(e.target.value.toUpperCase())} placeholder="ABCDE1234F" maxLength={10} />
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
                <input type="checkbox" checked={noGstin} onChange={(e) => setNoGstin(e.target.checked)} />
                My business doesn't have a GSTIN
              </label>
              {!noGstin && <Input label="GSTIN" value={gstin} onChange={(e) => setGstin(e.target.value.toUpperCase())} placeholder="07ABCDE1234F1Z5" maxLength={15} />}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Button type="submit" variant="accent">Save Details</Button>
              {detailsSaved && <span style={{ fontSize: 12, color: '#10b981', fontWeight: 500 }}>✓ Saved</span>}
            </div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Documents" subtitle="Upload clear PDF, JPG, or PNG files, under 5MB each." />
        <CardBody>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {DOCUMENT_TYPES.map((dt) => {
              const doc = docFor(dt.id);
              const badge = doc ? STATUS_BADGE[doc.status] : null;
              return (
                <div key={dt.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-tertiary)', borderRadius: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <FileText size={16} color="var(--text-tertiary)" />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{dt.label}</div>
                      {doc && <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{doc.fileName}</div>}
                      {doc?.rejectionReason && <div style={{ fontSize: 11, color: '#ef4444' }}>{doc.rejectionReason}</div>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {badge && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: badge.color }}>
                        <badge.icon size={12} /> {badge.label}
                      </span>
                    )}
                    {doc?.status !== 'APPROVED' && (
                      <Button variant="secondary" size="sm" onClick={() => triggerUpload(dt.id)} disabled={uploadingType === dt.id}>
                        <Upload size={12} style={{ marginRight: 4 }} />
                        {uploadingType === dt.id ? 'Uploading...' : doc ? 'Re-upload' : 'Upload'}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
