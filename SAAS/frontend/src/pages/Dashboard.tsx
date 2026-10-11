import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useBusiness } from '../contexts/BusinessContext';
import {
  TrendingUp,
  TrendingDown,
  Users,
  CreditCard,
  Package,
  ArrowRight,
  Search,
  Flame,
  Target
} from 'lucide-react';
import { useApi } from '../hooks/useApi';


export function Dashboard() {
  const { user } = useAuth();
  const { dna } = useBusiness();
  const { fetchWithAuth } = useApi();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [demand, setDemand] = useState<any>(null);
  const [overview, setOverview] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [demandRes, overviewRes] = await Promise.all([
        fetchWithAuth('/intently/demand').catch(() => null),
        fetchWithAuth('/dashboard/overview'),
      ]);
      if (demandRes?.data) setDemand(demandRes.data);
      if (overviewRes?.data) setOverview(overviewRes.data);
      setLoadError(null);
    } catch (e: any) {
      // Real failure -- show an error state, never fabricated revenue/order
      // numbers (this page used to render permanently hardcoded demo
      // metrics regardless of whether the API call even succeeded).
      setLoadError(e?.message || 'Could not load dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div style={{ padding: '40px', color: 'var(--text-secondary)' }}>Loading...</div>;

  if (loadError) {
    return (
      <div style={{ padding: '40px', color: '#ef4444' }}>
        <p>Could not load dashboard: {loadError}</p>
        <button onClick={loadData} style={{ marginTop: '12px', padding: '8px 16px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', cursor: 'pointer' }}>
          Retry
        </button>
      </div>
    );
  }

  const money = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

  const metrics = overview
    ? [
        { title: "Today's Revenue", value: money(overview.revenue.today.amount), change: `${overview.revenue.today.change >= 0 ? '+' : ''}${overview.revenue.today.change}%`, isUp: overview.revenue.today.change >= 0, icon: CreditCard },
        { title: 'Total Customers', value: String(overview.customers.total), change: `+${overview.customers.newThisMonth} this month`, isUp: true, icon: Users },
        { title: "Today's Orders", value: String(overview.orders.today), change: `${overview.orders.week} this week`, isUp: true, icon: Package },
        { title: 'Low Stock Items', value: String(overview.inventory.lowStockCount), change: overview.inventory.lowStockCount > 0 ? 'Needs attention' : 'All stocked', isUp: overview.inventory.lowStockCount === 0, icon: Package },
      ]
    : [];

  const recentOrders = overview?.recentOrders ?? [];

  return (
    <div className="page-enter" style={{ padding: '32px 40px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>

      {/* ─── Header ────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
            Welcome back, {user?.name?.split(' ')[0] || 'User'}
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
            Here's what's happening with {dna?.name || 'your business'} today.
          </p>
        </div>
      </div>

      {/* ─── Intently Demand Intelligence ──────────────────────────────────── */}
      {demand && (
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Flame size={18} color="#f59e0b" />
            Live Demand Intelligence
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
            <div style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.1) 0%, rgba(139,92,246,0.1) 100%)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '8px', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <span style={{ fontSize: '13px', color: '#6366f1', fontWeight: 600 }}>Searches Today</span>
                <Target size={16} color="#6366f1" />
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                <span style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                  {demand.recentIntentsToday}
                </span>
              </div>
            </div>

            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>Unserved Weekly Searches</span>
                <Search size={16} color="var(--text-tertiary)" />
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                <span style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                  {demand.unmatchedOpportunity}
                </span>
                <span style={{ fontSize: '12px', fontWeight: 500, color: '#f59e0b' }}>High Opportunity</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Top Metrics ───────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        {metrics.map((m, i) => (
          <div key={i} style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '20px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>{m.title}</span>
              <m.icon size={16} color="var(--text-tertiary)" />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
              <span style={{ fontSize: '28px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{m.value}</span>
              <span style={{
                fontSize: '12px',
                fontWeight: 500,
                color: m.isUp ? '#10b981' : '#ef4444',
                display: 'flex',
                alignItems: 'center',
                background: m.isUp ? '#ecfdf5' : '#fef2f2',
                padding: '2px 6px',
                borderRadius: '4px'
              }}>
                {m.isUp ? <TrendingUp size={12} style={{ marginRight: '4px' }} /> : <TrendingDown size={12} style={{ marginRight: '4px' }} />}
                {m.change}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* ─── Recent Orders ─────────────────────────────────────────────────── */}
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Recent Orders</h2>
          <a href="/orders" style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', fontSize: '13px', fontWeight: 500, textDecoration: 'none' }}>
            View All <ArrowRight size={14} style={{ marginLeft: '4px' }} />
          </a>
        </div>
        {recentOrders.length === 0 ? (
          <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '13px' }}>
            No orders yet.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '12px 20px', fontWeight: 500 }}>Order</th>
                <th style={{ padding: '12px 20px', fontWeight: 500 }}>Customer</th>
                <th style={{ padding: '12px 20px', fontWeight: 500 }}>Amount</th>
                <th style={{ padding: '12px 20px', fontWeight: 500 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((order: any) => (
                <tr key={order.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '16px 20px', fontWeight: 500, color: 'var(--text-primary)' }}>{order.orderNumber}</td>
                  <td style={{ padding: '16px 20px', color: 'var(--text-primary)' }}>{order.customer?.name ?? 'Walk-in'}</td>
                  <td style={{ padding: '16px 20px', color: 'var(--text-primary)' }}>{money(order.total)}</td>
                  <td style={{ padding: '16px 20px' }}>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 500,
                      background: order.status === 'DELIVERED' ? '#ecfdf5' : order.status === 'CANCELLED' ? '#fef2f2' : '#eff6ff',
                      color: order.status === 'DELIVERED' ? '#10b981' : order.status === 'CANCELLED' ? '#ef4444' : '#3b82f6'
                    }}>
                      {order.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
