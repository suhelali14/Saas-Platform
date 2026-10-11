import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import {
  ShoppingBag,
  IndianRupee,
  Clock,
  CheckCircle2,
  Filter,
  Plus,
  ArrowUpRight,
  ExternalLink,
  MessageCircle,
  Truck,
  Check,
  X,
  Printer,
} from 'lucide-react';

const STATUS_BADGE_VARIANTS: Record<string, 'neutral' | 'info' | 'warning' | 'primary' | 'success' | 'error'> = {
  PENDING: 'warning',
  CONFIRMED: 'primary',
  PROCESSING: 'info',
  READY: 'info',
  SHIPPED: 'info',
  OUT_FOR_DELIVERY: 'primary',
  DELIVERED: 'success',
  CANCELLED: 'error',
  REFUNDED: 'neutral',
};

const STATUSES = ['PENDING', 'CONFIRMED', 'PROCESSING', 'READY', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

function timeSince(date: string) {
  const diff = (Date.now() - new Date(date).getTime()) / 1000;
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(date).toLocaleDateString('en-IN');
}

export function Orders() {
  const { fetchWithAuth, isLoading } = useApi();
  const [orders, setOrders] = useState<any[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // New order form state -- backed by real customers/products, not free text,
  // since order creation needs a real customerId/productId server-side.
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [newOrderCustomerId, setNewOrderCustomerId] = useState('');
  const [newOrderProductId, setNewOrderProductId] = useState('');
  const [newOrderQty, setNewOrderQty] = useState(1);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    loadOrders();
  }, [statusFilter]);

  const loadOrders = async () => {
    try {
      const params = statusFilter ? `?status=${statusFilter}` : '';
      const ordRes = await fetchWithAuth(`/orders${params}`);
      setOrders(ordRes.data || []);
      setLoadError(null);
    } catch (e: any) {
      setLoadError(e?.message || 'Could not load orders.');
    }
  };

  const updateStatus = async (orderId: string, status: string) => {
    try {
      const res = await fetchWithAuth(`/orders/${orderId}/status`, { method: 'PATCH', data: { status } });
      setOrders(prev => prev.map(o => o.id === orderId ? res.data : o));
      if (selectedOrder?.id === orderId) setSelectedOrder(res.data);
    } catch (e: any) {
      // A failed status update must not be shown as if it succeeded.
      setCreateError(e?.message || 'Failed to update order status.');
    }
  };

  const openCreateModal = async () => {
    setShowCreateModal(true);
    setCreateError(null);
    try {
      const [custRes, prodRes] = await Promise.all([
        fetchWithAuth('/customers?limit=100'),
        fetchWithAuth('/catalog/products?limit=100'),
      ]);
      setCustomers(custRes.data || []);
      setProducts(prodRes.data || []);
    } catch (e: any) {
      setCreateError(e?.message || 'Could not load customers/products.');
    }
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrderCustomerId || !newOrderProductId) {
      setCreateError('Select a customer and a product.');
      return;
    }
    try {
      await fetchWithAuth('/orders', {
        method: 'POST',
        data: { customerId: newOrderCustomerId, items: [{ productId: newOrderProductId, quantity: newOrderQty }] },
      });
      setShowCreateModal(false);
      setNewOrderCustomerId('');
      setNewOrderProductId('');
      setNewOrderQty(1);
      setCreateError(null);
      loadOrders();
    } catch (err: any) {
      setCreateError(err?.message || 'Failed to create order.');
    }
  };

  const selectedProduct = products.find(p => p.id === newOrderProductId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
            Order Management
          </h1>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, marginTop: '2px' }}>
            Live orders from WhatsApp, Storefront & Store POS with real-time dispatch tracking
          </p>
        </div>
        <Button variant="accent" size="sm" onClick={openCreateModal}>
          <Plus size={13} style={{ marginRight: '5px' }} />
          Create Order
        </Button>
      </div>

      {loadError && (
        <div style={{ background: 'rgba(239, 68, 68, 0.08)', color: '#ef4444', padding: '10px 16px', borderRadius: '8px', fontSize: '13px' }}>
          {loadError} <button onClick={loadOrders} style={{ background: 'none', border: 'none', color: 'inherit', textDecoration: 'underline', cursor: 'pointer', fontSize: 'inherit' }}>Retry</button>
        </div>
      )}

      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 600 }}>Today's Revenue</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>₹14,800</div>
            </div>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'var(--accent-primary-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IndianRupee size={18} color="#10b981" />
            </div>
          </div>
        </Card>

        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 600 }}>Total Orders</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>{orders.length}</div>
            </div>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShoppingBag size={18} color="#3b82f6" />
            </div>
          </div>
        </Card>

        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 600 }}>Pending Dispatch</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#f59e0b', marginTop: '4px' }}>
                {orders.filter(o => o.status === 'PENDING' || o.status === 'CONFIRMED').length}
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
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 600 }}>Delivered Today</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#10b981', marginTop: '4px' }}>
                {orders.filter(o => o.status === 'DELIVERED').length}
              </div>
            </div>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={18} color="#10b981" />
            </div>
          </div>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '6px', background: 'var(--bg-tertiary)', padding: '4px', borderRadius: '8px', width: 'fit-content' }}>
        <button
          onClick={() => setStatusFilter('')}
          style={{
            padding: '5px 12px',
            fontSize: '11px',
            fontWeight: !statusFilter ? 700 : 500,
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            background: !statusFilter ? 'var(--bg-card)' : 'transparent',
            color: !statusFilter ? 'var(--text-primary)' : 'var(--text-secondary)',
            boxShadow: !statusFilter ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
          }}
        >
          All ({orders.length})
        </button>
        {STATUSES.map(s => {
          const isSel = statusFilter === s;
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              style={{
                padding: '5px 12px',
                fontSize: '11px',
                fontWeight: isSel ? 700 : 500,
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                background: isSel ? 'var(--bg-card)' : 'transparent',
                color: isSel ? 'var(--text-primary)' : 'var(--text-secondary)',
                boxShadow: isSel ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              {s}
            </button>
          );
        })}
      </div>

      {/* Orders Table */}
      <Card>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-tertiary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <th style={{ padding: '12px 16px' }}>Order #</th>
                <th style={{ padding: '12px 16px' }}>Customer</th>
                <th style={{ padding: '12px 16px' }}>Channel</th>
                <th style={{ padding: '12px 16px' }}>Items Summary</th>
                <th style={{ padding: '12px 16px' }}>Total Amount</th>
                <th style={{ padding: '12px 16px' }}>Status</th>
                <th style={{ padding: '12px 16px' }}>Time</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(order => (
                <tr
                  key={order.id}
                  style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.15s' }}
                  className="table-row-hover"
                >
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {order.orderNumber}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{order.customer.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{order.customer.phone}</div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: '11px', color: order.source === 'WHATSAPP' ? '#10b981' : '#3b82f6', fontWeight: 600 }}>
                      {order.source}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                    {order.items?.map((i: any) => `${i.quantity}x ${i.productName}`).join(', ') || 'Grocery bundle'}
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 800, color: '#10b981' }}>
                    ₹{order.total.toLocaleString('en-IN')}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <Badge variant={STATUS_BADGE_VARIANTS[order.status] || 'neutral'}>
                      {order.status}
                    </Badge>
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-tertiary)', fontSize: '11px' }}>
                    {timeSince(order.createdAt)}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <Button variant="secondary" size="sm" onClick={() => setSelectedOrder(order)}>
                      View & Manage
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Order Details Modal */}
      {selectedOrder && (
        <Modal isOpen={!!selectedOrder} onClose={() => setSelectedOrder(null)} title={`Order ${selectedOrder.orderNumber}`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-tertiary)', padding: '12px', borderRadius: '8px' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Customer</div>
                <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>{selectedOrder.customer.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{selectedOrder.customer.phone}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Total Amount</div>
                <div style={{ fontWeight: 800, fontSize: '18px', color: '#10b981' }}>₹{selectedOrder.total.toLocaleString('en-IN')}</div>
              </div>
            </div>

            {/* Change Status Fast Buttons */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                Update Order Status
              </label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'].map(st => (
                  <button
                    key={st}
                    onClick={() => updateStatus(selectedOrder.id, st)}
                    style={{
                      padding: '5px 12px',
                      fontSize: '11px',
                      fontWeight: 600,
                      borderRadius: '6px',
                      cursor: 'pointer',
                      border: selectedOrder.status === st ? '1px solid #10b981' : '1px solid var(--border-color)',
                      background: selectedOrder.status === st ? 'var(--accent-primary-soft)' : 'var(--bg-card)',
                      color: selectedOrder.status === st ? '#10b981' : 'var(--text-primary)',
                    }}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '14px' }}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => window.open(`https://wa.me/${selectedOrder.customer.phone.replace(/\D/g, '')}?text=Hi ${selectedOrder.customer.name}, your order ${selectedOrder.orderNumber} status is now *${selectedOrder.status}*!`, '_blank')}
                style={{ flex: 1 }}
              >
                <MessageCircle size={13} style={{ marginRight: '4px' }} />
                WhatsApp Customer
              </Button>
              <Button variant="accent" size="sm" onClick={() => setSelectedOrder(null)} style={{ flex: 1 }}>
                Save & Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Create Order Modal */}
      {showCreateModal && (
        <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create New Order">
          <form onSubmit={handleCreateOrder} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {createError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.08)', color: '#ef4444', padding: '10px 12px', borderRadius: '8px', fontSize: '13px' }}>
                {createError}
              </div>
            )}

            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Customer
              </label>
              <select className="input" value={newOrderCustomerId} onChange={e => setNewOrderCustomerId(e.target.value)} required>
                <option value="">Select a customer…</option>
                {customers.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ''}</option>
                ))}
              </select>
              {customers.length === 0 && (
                <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>No customers yet -- add one from the Customers page first.</p>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Product
                </label>
                <select className="input" value={newOrderProductId} onChange={e => setNewOrderProductId(e.target.value)} required>
                  <option value="">Select a product…</option>
                  {products.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name} — ₹{p.price}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Qty
                </label>
                <input
                  type="number"
                  className="input"
                  value={newOrderQty}
                  min={1}
                  onChange={e => setNewOrderQty(Number(e.target.value))}
                />
              </div>
            </div>

            <div style={{ background: 'var(--bg-tertiary)', padding: '10px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: 600 }}>Total Order Amount:</span>
              <span style={{ fontSize: '16px', fontWeight: 800, color: '#10b981' }}>₹{selectedProduct ? selectedProduct.price * newOrderQty : 0}</span>
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '6px' }}>
              <Button type="button" variant="secondary" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="accent">
                Create Order
              </Button>
            </div>
          </form>
        </Modal>
      )}

    </div>
  );
}
