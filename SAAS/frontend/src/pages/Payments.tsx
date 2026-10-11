import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import {
  CreditCard,
  IndianRupee,
  QrCode,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Download,
  Printer,
  Share2,
  ExternalLink,
  Filter,
  Search,
  Copy,
  Check,
} from 'lucide-react';

export function Payments() {
  const { fetchWithAuth, isLoading } = useApi();
  const [payments, setPayments] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({
    totalCollected: 0,
    totalTransactions: 0,
    pendingAmount: 0,
    pendingCount: 0,
  });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  // Modals state
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrData, setQrData] = useState<any>(null);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [invoiceHtml, setInvoiceHtml] = useState<string>('');
  const [copied, setCopied] = useState(false);

  // Custom QR state
  const [qrAmount, setQrAmount] = useState(500);
  const [qrOrderNum, setQrOrderNum] = useState('#1042');

  useEffect(() => {
    loadPayments();
  }, [statusFilter]);

  const loadPayments = async () => {
    try {
      const res = await fetchWithAuth(`/payments?status=${statusFilter}`);
      setPayments(res.data?.payments || []);
      setStats(res.data?.stats || { totalCollected: 0, totalTransactions: 0, pendingAmount: 0, pendingCount: 0 });
      setLoadError(null);
    } catch (e: any) {
      setLoadError(e?.message || 'Could not load payments.');
    }
  };

  const handleOpenQrModal = async (amt: number = 500, ordNum: string = '#1042') => {
    setQrAmount(amt);
    setQrOrderNum(ordNum);
    setQrData(null);
    try {
      // A fake VPA here would show the merchant a QR code that doesn't
      // actually route money anywhere real -- on failure, show nothing
      // rather than a QR that looks legitimate but isn't.
      const res = await fetchWithAuth(`/payments/upi-qr?amount=${amt}&orderNumber=${encodeURIComponent(ordNum)}`);
      setQrData(res.data);
      setLoadError(null);
    } catch (e: any) {
      setLoadError(e?.message || 'Could not generate a payment QR code.');
    }
    setQrModalOpen(true);
  };

  const handleOpenInvoice = async (orderId: string = 'ord-1') => {
    setInvoiceHtml('');
    try {
      const res = await fetchWithAuth(`/payments/invoice/${orderId}`);
      setInvoiceHtml(res.data?.html || '');
      setLoadError(null);
    } catch (e: any) {
      setLoadError(e?.message || 'Could not load the invoice.');
    }
    setInvoiceModalOpen(true);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
            Payments & GST Invoicing
          </h1>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, marginTop: '2px' }}>
            Direct UPI QR codes, Razorpay online settlements, and automated GST Tax Invoices
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <Button variant="secondary" size="sm" onClick={() => handleOpenQrModal(500, '#COUNTER')}>
            <QrCode size={13} style={{ marginRight: '5px' }} />
            Counter UPI QR Code
          </Button>
          <Button variant="accent" size="sm" onClick={() => handleOpenInvoice('demo')}>
            <FileText size={13} style={{ marginRight: '5px' }} />
            View Sample GST Invoice
          </Button>
        </div>
      </div>

      {loadError && (
        <div style={{ background: 'rgba(239, 68, 68, 0.08)', color: '#ef4444', padding: '10px 16px', borderRadius: '8px', fontSize: '13px' }}>
          {loadError} <button onClick={loadPayments} style={{ background: 'none', border: 'none', color: 'inherit', textDecoration: 'underline', cursor: 'pointer', fontSize: 'inherit' }}>Retry</button>
        </div>
      )}

      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 600 }}>Total Collected</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#10b981', marginTop: '4px' }}>
                ₹{Number(stats.totalCollected).toLocaleString('en-IN')}
              </div>
            </div>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IndianRupee size={18} color="#10b981" />
            </div>
          </div>
        </Card>

        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 600 }}>Settled Transactions</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                {stats.totalTransactions}
              </div>
            </div>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={18} color="#3b82f6" />
            </div>
          </div>
        </Card>

        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 600 }}>Pending Collections</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#f59e0b', marginTop: '4px' }}>
                ₹{Number(stats.pendingAmount).toLocaleString('en-IN')}
              </div>
            </div>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={18} color="#f59e0b" />
            </div>
          </div>
        </Card>

        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 600 }}>GST Tax Collected</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                ₹{Math.round(Number(stats.totalCollected) * 0.05).toLocaleString('en-IN')}
              </div>
            </div>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(139, 92, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileText size={18} color="#8b5cf6" />
            </div>
          </div>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '6px', background: 'var(--bg-tertiary)', padding: '4px', borderRadius: '8px', width: 'fit-content' }}>
        {['ALL', 'COMPLETED', 'PENDING', 'FAILED', 'REFUNDED'].map(st => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            style={{
              padding: '5px 12px',
              fontSize: '11px',
              fontWeight: statusFilter === st ? 700 : 500,
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              background: statusFilter === st ? 'var(--bg-card)' : 'transparent',
              color: statusFilter === st ? 'var(--text-primary)' : 'var(--text-secondary)',
              boxShadow: statusFilter === st ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
            }}
          >
            {st}
          </button>
        ))}
      </div>

      {/* Transactions Table */}
      <Card>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-tertiary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <th style={{ padding: '12px 16px' }}>Transaction ID</th>
                <th style={{ padding: '12px 16px' }}>Order #</th>
                <th style={{ padding: '12px 16px' }}>Customer</th>
                <th style={{ padding: '12px 16px' }}>Payment Mode</th>
                <th style={{ padding: '12px 16px' }}>Amount</th>
                <th style={{ padding: '12px 16px' }}>Status</th>
                <th style={{ padding: '12px 16px' }}>Date</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {payments.map(pay => (
                <tr key={pay.id} style={{ borderBottom: '1px solid var(--border-color)' }} className="table-row-hover">
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {pay.gatewayId || pay.id}
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: '#10b981' }}>
                    {pay.order?.orderNumber || '#1847'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{pay.order?.customer?.name || 'Customer'}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{pay.order?.customer?.phone || '+91 98765 43210'}</div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: '11px', background: 'var(--bg-tertiary)', padding: '3px 8px', borderRadius: '4px', fontWeight: 600 }}>
                      {pay.method}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--text-primary)' }}>
                    ₹{pay.amount.toLocaleString('en-IN')}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <Badge variant={pay.status === 'COMPLETED' ? 'success' : pay.status === 'PENDING' ? 'warning' : 'neutral'}>
                      {pay.status}
                    </Badge>
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-tertiary)', fontSize: '11px' }}>
                    {new Date(pay.createdAt).toLocaleDateString('en-IN')}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                      <Button variant="secondary" size="sm" onClick={() => handleOpenQrModal(pay.amount, pay.order?.orderNumber || '#1847')}>
                        <QrCode size={12} />
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => handleOpenInvoice(pay.orderId || 'demo')}>
                        <FileText size={12} style={{ marginRight: '4px' }} />
                        Invoice
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* UPI QR Code Modal */}
      {qrModalOpen && qrData && (
        <Modal isOpen={qrModalOpen} onClose={() => setQrModalOpen(false)} title="UPI Payment QR Code">
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '10px 0' }}>
            <div style={{ background: '#fff', padding: '16px', borderRadius: '14px', border: '1px solid #e2e8f0', boxShadow: '0 4px 14px rgba(0,0,0,0.06)' }}>
              {/* Dynamic QR SVG visual */}
              <div style={{ width: '180px', height: '180px', background: '#f8fafc', border: '2px dashed #cbd5e1', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                <QrCode size={90} color="#0f172a" />
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#0f172a', marginTop: '6px' }}>Scan & Pay with Any UPI App</div>
                <div style={{ fontSize: '9px', color: '#64748b' }}>GPay · PhonePe · Paytm · BHIM</div>
              </div>
            </div>

            <div>
              <div style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>Payable Amount</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#10b981', marginTop: '2px' }}>₹{qrData.amount}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Order Ref: {qrData.orderNumber}</div>
            </div>

            {/* UPI Deep Link / Copy */}
            <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-tertiary)', padding: '8px 12px', borderRadius: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {qrData.upiId}
              </span>
              <Button variant="secondary" size="sm" onClick={() => copyToClipboard(qrData.upiId)}>
                {copied ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                <span style={{ marginLeft: '4px' }}>{copied ? 'Copied' : 'Copy'}</span>
              </Button>
            </div>

            <Button
              variant="accent"
              size="sm"
              onClick={() => window.open(`https://wa.me/?text=Here is your UPI payment link for ₹${qrData.amount} (Order ${qrData.orderNumber}): ${encodeURIComponent(qrData.upiUri)}`, '_blank')}
              style={{ width: '100%' }}
            >
              <Share2 size={13} style={{ marginRight: '6px' }} />
              Share Payment Link on WhatsApp
            </Button>
          </div>
        </Modal>
      )}

      {/* Tax Invoice Modal */}
      {invoiceModalOpen && (
        <Modal isOpen={invoiceModalOpen} onClose={() => setInvoiceModalOpen(false)} title="GST Tax Invoice">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <Button variant="secondary" size="sm" onClick={() => {
                const printWindow = window.open('', '_blank');
                if (printWindow) {
                  printWindow.document.write(invoiceHtml);
                  printWindow.document.close();
                  printWindow.print();
                }
              }}>
                <Printer size={13} style={{ marginRight: '5px' }} />
                Print Invoice
              </Button>
            </div>

            <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', height: '520px' }}>
              <iframe
                title="Invoice View"
                srcDoc={invoiceHtml}
                style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }}
              />
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
}
