import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { apiFetch } from '../lib/api';

interface Message {
  id: string;
  senderType: 'BUSINESS' | 'ADMIN';
  senderName: string;
  content: string;
  createdAt: string;
}

interface TicketDetail {
  id: string;
  subject: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  business: { name: string; email: string | null; phone: string | null };
  messages: Message[];
}

export function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [reply, setReply] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    load();
  }, [id]);

  const load = async () => {
    try {
      const res = await apiFetch<TicketDetail>(`/tickets/${id}`);
      setTicket(res);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Could not load this ticket.');
    }
  };

  const updateStatus = async (status: string) => {
    try {
      await apiFetch(`/tickets/${id}`, { method: 'PATCH', data: { status } });
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to update status.');
    }
  };

  const sendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true);
    try {
      await apiFetch(`/tickets/${id}/messages`, { method: 'POST', data: { content: reply } });
      setReply('');
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to send reply.');
    } finally {
      setSending(false);
    }
  };

  if (!ticket) return <div className="p-8 text-gray-400">{error || 'Loading...'}</div>;

  return (
    <div className="p-8 max-w-2xl">
      <Link to="/tickets" className="flex items-center gap-1 text-sm text-gray-400 hover:text-white mb-4"><ArrowLeft size={14} /> Back to tickets</Link>

      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-bold">{ticket.subject}</h1>
      </div>
      <p className="text-sm text-gray-400 mb-6">{ticket.business.name} · {ticket.category.replace(/_/g, ' ')} · {ticket.priority}</p>

      {error && <div className="mb-4 px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-sm">{error}</div>}

      <div className="flex gap-2 mb-6">
        {['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].map((s) => (
          <button
            key={s}
            onClick={() => updateStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium ${ticket.status === s ? 'bg-white text-black' : 'bg-white/5 text-gray-300'}`}
          >
            {s.replace('_', ' ')}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 mb-6">
        {ticket.messages.map((m) => (
          <div key={m.id} className={`p-3 rounded-lg max-w-[85%] ${m.senderType === 'ADMIN' ? 'bg-emerald-500/10 self-end ml-auto' : 'bg-white/[0.03] border border-white/10'}`}>
            <div className="text-xs text-gray-400 mb-1">{m.senderName} · {new Date(m.createdAt).toLocaleString()}</div>
            <div className="text-sm">{m.content}</div>
          </div>
        ))}
      </div>

      {ticket.status !== 'CLOSED' && (
        <form onSubmit={sendReply} className="flex gap-2">
          <input
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Type a reply..."
            className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm outline-none focus:border-emerald-400"
          />
          <button type="submit" disabled={sending || !reply.trim()} className="px-4 py-2 rounded-lg bg-emerald-500 text-black text-sm font-semibold disabled:opacity-50">
            Send
          </button>
        </form>
      )}
    </div>
  );
}
