import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Table } from '../components/ui/Table';
import { Modal } from '../components/ui/Modal';

const SEGMENT_COLORS: Record<string, 'success' | 'info' | 'warning' | 'error' | 'neutral' | 'purple' | 'primary'> = {
  VIP: 'purple',
  LOYAL: 'success',
  ACTIVE: 'primary',
  NEW: 'info',
  AT_RISK: 'warning',
  CHURNED: 'error',
  INACTIVE: 'neutral',
};

function getAvatarClass(name: string) {
  const classes = ['avatar-1', 'avatar-2', 'avatar-3', 'avatar-4', 'avatar-5', 'avatar-6'];
  return classes[name.charCodeAt(0) % classes.length];
}

export function Customers() {
  const { fetchWithAuth, isLoading } = useApi();
  const [customers, setCustomers] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [segment, setSegment] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '', city: '' });
  const navigate = useNavigate();

  useEffect(() => {
    load();
  }, [search, segment]);

  const load = async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (segment) params.set('segment', segment);

      const [custRes, statsRes] = await Promise.all([
        fetchWithAuth(`/customers?${params}`),
        fetchWithAuth('/customers/stats'),
      ]);
      setCustomers(custRes.data || []);
      setStats(statsRes.data);
      setLoadError(null);
    } catch (e: any) {
      setLoadError(e?.message || 'Could not load customers.');
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchWithAuth('/customers', { method: 'POST', data: form });
      setShowAddModal(false);
      setForm({ name: '', phone: '', email: '', city: '' });
      load();
    } catch {}
  };

  const segments = ['VIP', 'LOYAL', 'ACTIVE', 'NEW', 'AT_RISK', 'CHURNED', 'INACTIVE'];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="page-subtitle">{stats?.totalCustomers || 0} total · {stats?.newThisMonth || 0} new this month · {stats?.atRisk || 0} at risk</p>
        </div>
        <div className="page-actions">
          <Button variant="accent" onClick={() => setShowAddModal(true)}>+ Add Customer</Button>
        </div>
      </div>

      {loadError && (
        <div style={{ background: 'rgba(239, 68, 68, 0.08)', color: '#ef4444', padding: '10px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
          {loadError} <button onClick={load} style={{ background: 'none', border: 'none', color: 'inherit', textDecoration: 'underline', cursor: 'pointer', fontSize: 'inherit' }}>Retry</button>
        </div>
      )}

      {/* Segment quick-filter chips */}
      <div className="flex gap-2 flex-wrap mb-6">
        <button
          className={`badge cursor-pointer ${!segment ? 'badge-primary' : 'badge-neutral'}`}
          onClick={() => setSegment('')}
        >All</button>
        {segments.map(s => (
          <button
            key={s}
            className={`badge cursor-pointer ${segment === s ? `badge-${SEGMENT_COLORS[s]}` : 'badge-neutral'}`}
            onClick={() => setSegment(s === segment ? '' : s)}
          >
            {s.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Search + Table */}
      <Card>
        <CardBody>
          <div className="filter-bar">
            <div className="filter-search">
              <span className="filter-search-icon">🔍</span>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, phone, email..."
              />
            </div>
          </div>

          <Table
            data={customers}
            columns={[
              {
                key: 'name', header: 'Customer',
                render: (row) => (
                  <div className="flex items-center gap-3">
                    <div className={`avatar avatar-sm ${getAvatarClass(row.name)}`}>
                      {row.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-semibold">{row.name}</div>
                      <div className="text-xs text-tertiary">{row.phone}</div>
                    </div>
                  </div>
                ),
              },
              { key: 'city', header: 'City', render: (row) => row.city || '—' },
              {
                key: 'segment', header: 'Segment',
                render: (row) => <Badge variant={SEGMENT_COLORS[row.segment] || 'neutral'}>{row.segment}</Badge>,
              },
              {
                key: 'lifetimeValue', header: 'LTV',
                render: (row) => <span className="font-semibold text-accent">₹{(row.lifetimeValue || 0).toLocaleString('en-IN')}</span>,
              },
              { key: 'totalOrders', header: 'Orders' },
              {
                key: 'churnProbability', header: 'Churn Risk',
                render: (row) => {
                  const risk = row.churnProbability || 0;
                  const variant = risk > 60 ? 'error' : risk > 30 ? 'warning' : 'success';
                  return <Badge variant={variant}>{risk}%</Badge>;
                },
              },
              {
                key: 'actions', header: '',
                render: (row) => (
                  <Button variant="ghost" size="sm" onClick={() => navigate(`/customers/${row.id}`)}>
                    View →
                  </Button>
                ),
              },
            ]}
            emptyMessage="No customers found. Add your first customer!"
          />
        </CardBody>
      </Card>

      {/* Add Customer Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add New Customer"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button variant="accent" isLoading={isLoading} onClick={handleAdd as any}>Add Customer</Button>
          </>
        }
      >
        <form onSubmit={handleAdd} className="flex-col gap-5" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input label="Full Name *" placeholder="Rahul Sharma" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
          <Input label="Phone Number *" placeholder="9876543210" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} required />
          <Input label="Email" placeholder="rahul@example.com" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          <Input label="City" placeholder="Mumbai" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
        </form>
      </Modal>
    </div>
  );
}
