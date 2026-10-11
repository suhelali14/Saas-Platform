import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Calendar, Clock, CreditCard, User, Check, X, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';

export function Bookings() {
  const { fetchWithAuth, isLoading } = useApi();
  const [stats, setStats] = useState({ pending: 0, confirmed: 0, completedToday: 0, revenueToday: 0 });
  const [bookings, setBookings] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');

  useEffect(() => {
    fetchStats();
    fetchBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const fetchStats = async () => {
    try {
      const res = await fetchWithAuth('/biz/bookings/stats');
      if (res) setStats(res);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchBookings = async () => {
    try {
      const qs = statusFilter ? `?status=${statusFilter}` : '';
      const res = await fetchWithAuth(`/biz/bookings${qs}`);
      if (res?.data) setBookings(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await fetchWithAuth(`/biz/bookings/${id}/status`, {
        method: 'PUT',
        data: { status },
      });
      fetchStats();
      fetchBookings();
    } catch (e) {
      console.error(e);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING': return <Badge variant="warning">Action Required</Badge>;
      case 'CONFIRMED': return <Badge variant="info">Confirmed</Badge>;
      case 'IN_PROGRESS': return <Badge variant="primary">In Progress</Badge>;
      case 'COMPLETED': return <Badge variant="success">Completed</Badge>;
      case 'CANCELLED': return <Badge variant="danger">Cancelled</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  const getPaymentModeBadge = (mode: string) => {
    if (mode === 'RAZORPAY') return <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#10b981', fontWeight: 600 }}><CreditCard size={12} /> Paid Online</span>;
    return <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-secondary)' }}><CreditCard size={12} /> Pay at Venue</span>;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontSize: '20px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Consumer Bookings</h1>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>Manage bookings coming directly from the Intently app.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <Card>
          <CardBody style={{ padding: '16px' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>Pending Confirmation</div>
            <div style={{ fontSize: '24px', fontWeight: 700, marginTop: '8px', color: '#f59e0b' }}>{stats.pending}</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody style={{ padding: '16px' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>Upcoming / Confirmed</div>
            <div style={{ fontSize: '24px', fontWeight: 700, marginTop: '8px', color: '#3b82f6' }}>{stats.confirmed}</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody style={{ padding: '16px' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>Completed Today</div>
            <div style={{ fontSize: '24px', fontWeight: 700, marginTop: '8px', color: '#10b981' }}>{stats.completedToday}</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody style={{ padding: '16px' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>Revenue (Online) Today</div>
            <div style={{ fontSize: '24px', fontWeight: 700, marginTop: '8px' }}>₹{(stats.revenueToday / 100).toLocaleString('en-IN')}</div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader 
          title="Booking Schedule" 
          action={
            <select 
              className="input" 
              style={{ width: '150px', padding: '6px 10px', fontSize: '12px' }}
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="">All Bookings</option>
              <option value="PENDING">Action Required</option>
              <option value="CONFIRMED">Upcoming</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          } 
        />
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Consumer</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Service</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Date & Time</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Amount</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Status</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && bookings.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading...</td></tr>
              ) : bookings.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-secondary)' }}>No bookings found.</td></tr>
              ) : (
                bookings.map((b) => (
                  <tr key={b.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <User size={14} color="var(--text-secondary)" />
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{b.user.name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{b.user.phone || 'Guest Consumer'}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{b.offer.description}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>{b.durationMin} mins</div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500, color: 'var(--text-primary)' }}>
                        <Calendar size={13} color="var(--text-secondary)" /> {format(new Date(b.scheduledAt), 'MMM d, yyyy')}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        <Clock size={12} /> {format(new Date(b.scheduledAt), 'h:mm a')}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>₹{(b.amount / 100).toLocaleString('en-IN')}</div>
                      <div style={{ marginTop: '4px' }}>{getPaymentModeBadge(b.paymentMode)}</div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {getStatusBadge(b.status)}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      {b.status === 'PENDING' && (
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button 
                            onClick={() => updateStatus(b.id, 'CANCELLED')}
                            style={{ padding: '6px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}
                            title="Decline"
                          >
                            <X size={14} />
                          </button>
                          <button 
                            onClick={() => updateStatus(b.id, 'CONFIRMED')}
                            style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', background: '#3b82f6', color: 'white', cursor: 'pointer', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            <Check size={14} /> Accept
                          </button>
                        </div>
                      )}
                      {(b.status === 'CONFIRMED' || b.status === 'IN_PROGRESS') && (
                         <button 
                         onClick={() => updateStatus(b.id, 'COMPLETED')}
                         style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #10b981', background: 'rgba(16,185,129,0.1)', color: '#10b981', cursor: 'pointer', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto' }}
                       >
                         <CheckCircle size={14} /> Complete
                       </button>
                      )}
                      {b.status === 'COMPLETED' && <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Done</span>}
                      {b.status === 'CANCELLED' && <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>-</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
