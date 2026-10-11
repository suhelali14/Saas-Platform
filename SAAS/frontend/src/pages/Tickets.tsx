import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { LifeBuoy, ArrowLeft, Plus } from 'lucide-react';

interface TicketRow {
  id: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  updatedAt: string;
}

interface Message {
  id: string;
  senderType: 'BUSINESS' | 'ADMIN';
  senderName: string;
  content: string;
  createdAt: string;
}

interface TicketDetail extends TicketRow {
  description: string;
  messages: Message[];
}

const CATEGORIES = [
  { id: 'KYC_VERIFICATION', label: 'KYC / Verification' },
  { id: 'PAYMENT_ISSUE', label: 'Payment Issue' },
  { id: 'TECHNICAL', label: 'Technical' },
  { id: 'ACCOUNT', label: 'Account' },
  { id: 'OTHER', label: 'Other' },
];

const STATUS_COLORS: Record<string, string> = {
  OPEN: '#f59e0b',
  IN_PROGRESS: '#3b82f6',
  RESOLVED: '#10b981',
  CLOSED: '#6b7280',
};

export function Tickets() {
  const { fetchWithAuth } = useApi();
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [selected, setSelected] = useState<TicketDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [reply, setReply] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [newCategory, setNewCategory] = useState('OTHER');
  const [newDescription, setNewDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      const res = await fetchWithAuth('/tickets');
      setTickets(res.data);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Could not load tickets.');
    }
  };

  const openTicket = async (id: string) => {
    try {
      const res = await fetchWithAuth(`/tickets/${id}`);
      setSelected(res.data);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Could not load this ticket.');
    }
  };

  const createTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubject.trim() || !newDescription.trim()) return;
    setSubmitting(true);
    try {
      await fetchWithAuth('/tickets', { method: 'POST', data: { subject: newSubject, category: newCategory, description: newDescription } });
      setNewSubject('');
      setNewDescription('');
      setNewCategory('OTHER');
      setShowNew(false);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to create ticket.');
    } finally {
      setSubmitting(false);
    }
  };

  const sendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reply.trim() || !selected) return;
    try {
      await fetchWithAuth(`/tickets/${selected.id}/messages`, { method: 'POST', data: { content: reply } });
      setReply('');
      await openTicket(selected.id);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to send reply.');
    }
  };

  if (selected) {
    return (
      <div style={{ maxWidth: 700 }}>
        <button onClick={() => setSelected(null)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', marginBottom: 12, padding: 0 }}>
          <ArrowLeft size={14} /> Back to tickets
        </button>
        <h1 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px' }}>{selected.subject}</h1>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 16px' }}>
          <span style={{ color: STATUS_COLORS[selected.status], fontWeight: 600 }}>{selected.status.replace('_', ' ')}</span>
          {' · '}{selected.category.replace(/_/g, ' ')}
        </p>

        {error && <div className="badge badge-error p-3 w-full text-center block" style={{ marginBottom: 12 }}>{error}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          <div style={{ padding: '10px 14px', background: 'var(--bg-tertiary)', borderRadius: 8, fontSize: 13, color: 'var(--text-primary)' }}>{selected.description}</div>
          {selected.messages.map((m) => (
            <div key={m.id} style={{
              padding: '10px 14px', borderRadius: 8, fontSize: 13, maxWidth: '85%',
              alignSelf: m.senderType === 'BUSINESS' ? 'flex-end' : 'flex-start',
              background: m.senderType === 'BUSINESS' ? 'var(--accent-color, #6366f1)' : 'var(--bg-tertiary)',
              color: m.senderType === 'BUSINESS' ? '#fff' : 'var(--text-primary)',
            }}>
              <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 4 }}>{m.senderName} · {new Date(m.createdAt).toLocaleString()}</div>
              {m.content}
            </div>
          ))}
        </div>

        {selected.status !== 'CLOSED' && (
          <form onSubmit={sendReply} style={{ display: 'flex', gap: 8 }}>
            <input
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Type a reply..."
              style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 13 }}
            />
            <Button type="submit" variant="accent" disabled={!reply.trim()}>Send</Button>
          </form>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 800 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Support Tickets</h1>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0' }}>Questions, issues, or KYC follow-ups -- our team replies here.</p>
        </div>
        <Button variant="accent" onClick={() => setShowNew((v) => !v)}>
          <Plus size={14} style={{ marginRight: 4 }} /> New Ticket
        </Button>
      </div>

      {error && <div className="badge badge-error p-3 w-full text-center block">{error}</div>}

      {showNew && (
        <Card>
          <CardHeader title="New Ticket" />
          <CardBody>
            <form onSubmit={createTicket} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Input label="Subject" value={newSubject} onChange={(e) => setNewSubject(e.target.value)} required />
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Category</label>
                <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 13 }}>
                  {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Description</label>
                <textarea value={newDescription} onChange={(e) => setNewDescription(e.target.value)} rows={4} required
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 13, resize: 'vertical' }} />
              </div>
              <Button type="submit" variant="accent" disabled={submitting}>{submitting ? 'Submitting...' : 'Submit Ticket'}</Button>
            </form>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardBody>
          {tickets.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-tertiary)' }}>
              <LifeBuoy size={28} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
              <div style={{ fontSize: 13 }}>No tickets yet.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {tickets.map((t) => (
                <button key={t.id} onClick={() => openTicket(t.id)} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', textAlign: 'left',
                  padding: '12px 14px', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer',
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{t.subject}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{t.category.replace(/_/g, ' ')} · {new Date(t.updatedAt).toLocaleDateString()}</div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: STATUS_COLORS[t.status] }}>{t.status.replace('_', ' ')}</span>
                </button>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
