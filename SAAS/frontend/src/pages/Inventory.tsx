import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Package, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

export function Inventory() {
  const { fetchWithAuth, isLoading } = useApi();
  const [items, setItems] = useState<any[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [showAdjModal, setShowAdjModal] = useState<any>(null);
  const [adjustment, setAdjustment] = useState({ type: 'STOCK_IN', quantity: '', reason: '' });

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const res = await fetchWithAuth('/inventory');
      setItems(res.data || []);
      setLoadError(null);
    } catch (e: any) {
      setLoadError(e?.message || 'Could not load inventory.');
    }
  };

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchWithAuth(`/inventory/${showAdjModal.product?.id || showAdjModal.id}/adjust`, {
        method: 'POST',
        data: adjustment,
      });
      setShowAdjModal(null);
      setAdjustError(null);
      load();
    } catch (err: any) {
      // A failed adjustment (e.g. insufficient stock) must not be
      // simulated as a local success -- this used to fake the quantity
      // change on the client even when the server rejected it.
      setAdjustError(err?.message || 'Failed to adjust stock.');
    }
  };

  const getStockStatus = (item: any) => {
    if (item.quantity === 0) return { label: 'Out of Stock', variant: 'error' as const, bar: 0 };
    if (item.quantity <= item.lowStockThreshold) return { label: 'Low Stock', variant: 'warning' as const, bar: (item.quantity / item.lowStockThreshold) * 40 };
    return { label: 'In Stock', variant: 'success' as const, bar: Math.min(100, (item.quantity / (item.lowStockThreshold * 5)) * 100) };
  };

  const lowStock = items.filter(i => i.quantity <= i.lowStockThreshold && i.quantity > 0).length;
  const outOfStock = items.filter(i => i.quantity === 0).length;
  const totalSKUs = items.length;

  return (
    <div className="page-enter">
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventory</h1>
          <p className="page-subtitle">{totalSKUs} SKUs · {lowStock} low stock · {outOfStock} out of stock</p>
        </div>
        <Button variant="secondary">Export</Button>
      </div>

      {loadError && (
        <div style={{ background: 'rgba(239, 68, 68, 0.08)', color: '#ef4444', padding: '10px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
          {loadError} <button onClick={load} style={{ background: 'none', border: 'none', color: 'inherit', textDecoration: 'underline', cursor: 'pointer', fontSize: 'inherit' }}>Retry</button>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {[
          { title: 'Total SKUs', value: totalSKUs, icon: Package, color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
          { title: 'In Stock', value: items.filter(i => i.quantity > i.lowStockThreshold).length, icon: CheckCircle2, color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
          { title: 'Low Stock', value: lowStock, icon: AlertTriangle, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
          { title: 'Out of Stock', value: outOfStock, icon: XCircle, color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
        ].map(stat => {
          const Icon = stat.icon;
          return (
            <div key={stat.title} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '18px 20px', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>{stat.title}</span>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: stat.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: stat.color }}>
                  <Icon size={16} />
                </div>
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                {stat.value}
              </div>
            </div>
          );
        })}
      </div>

      {outOfStock > 0 || lowStock > 0 ? (
        <div style={{ marginBottom: '20px', padding: '14px 18px', background: 'rgba(245, 158, 11, 0.06)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <AlertTriangle size={20} color="#f59e0b" />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>Stock Alerts</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {outOfStock > 0 && <span style={{ color: '#ef4444' }}>{outOfStock} out of stock. </span>}
              {lowStock > 0 && <span style={{ color: '#f59e0b' }}>{lowStock} running low.</span>}
            </div>
          </div>
          <Button variant="secondary" size="sm">Restock All</Button>
        </div>
      ) : null}

      {/* Inventory Table */}
      <Card>
        <CardBody>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Stock Level</th>
                  <th>Quantity</th>
                  <th>Threshold</th>
                  <th>Value</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => {
                  const status = getStockStatus(item);
                  return (
                    <tr key={item.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div style={{ width: 36, height: 36, background: 'var(--bg-tertiary)', borderRadius: 'var(--border-radius-xs)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                            {item.product?.images?.[0] ? <img src={item.product.images[0]} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '📦'}
                          </div>
                          <span className="font-medium">{item.product?.name}</span>
                        </div>
                      </td>
                      <td className="text-sm text-tertiary">{item.product?.sku || '—'}</td>
                      <td style={{ minWidth: '120px' }}>
                        <div style={{ background: 'var(--bg-tertiary)', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
                          <div style={{ width: `${status.bar}%`, height: '100%', background: status.variant === 'success' ? 'var(--status-success)' : status.variant === 'warning' ? 'var(--status-warning)' : 'var(--status-error)', borderRadius: '4px', transition: 'width 0.5s ease' }} />
                        </div>
                      </td>
                      <td><span className="font-bold text-primary">{item.quantity}</span></td>
                      <td className="text-sm text-tertiary">{item.lowStockThreshold}</td>
                      <td className="text-sm">₹{((item.quantity || 0) * (item.product?.price || 0)).toLocaleString('en-IN')}</td>
                      <td><Badge variant={status.variant}>{status.label}</Badge></td>
                      <td>
                        <Button variant="secondary" size="sm" onClick={() => { setShowAdjModal(item); setAdjustment({ type: 'STOCK_IN', quantity: '', reason: '' }); }}>
                          Adjust
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      {/* Stock Adjustment Modal */}
      <Modal
        isOpen={!!showAdjModal}
        onClose={() => setShowAdjModal(null)}
        title={`Adjust Stock — ${showAdjModal?.product?.name}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowAdjModal(null)}>Cancel</Button>
            <Button variant="accent" isLoading={isLoading} onClick={handleAdjust as any}>Apply Adjustment</Button>
          </>
        }
      >
        <form onSubmit={handleAdjust} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {adjustError && (
            <div style={{ background: 'rgba(239, 68, 68, 0.08)', color: '#ef4444', padding: '10px 12px', borderRadius: '8px', fontSize: '13px' }}>
              {adjustError}
            </div>
          )}
          <div>
            <div className="text-sm text-secondary mb-1">Current Stock: <strong className="text-primary">{showAdjModal?.quantity}</strong></div>
          </div>
          <div className="input-group">
            <label className="input-label">Adjustment Type</label>
            <select className="input" value={adjustment.type} onChange={e => setAdjustment({ ...adjustment, type: e.target.value })}>
              <option value="STOCK_IN">Stock In (Add)</option>
              <option value="STOCK_OUT">Stock Out (Remove)</option>
              <option value="ADJUSTMENT">Manual Adjustment</option>
              <option value="DAMAGED">Damaged / Write-off</option>
            </select>
          </div>
          <Input label="Quantity" type="number" placeholder="e.g. 50" value={adjustment.quantity} onChange={e => setAdjustment({ ...adjustment, quantity: e.target.value })} required />
          <Input label="Reason (optional)" placeholder="Supplier delivery, damaged goods..." value={adjustment.reason} onChange={e => setAdjustment({ ...adjustment, reason: e.target.value })} />
        </form>
      </Modal>
    </div>
  );
}
