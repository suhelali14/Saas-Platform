import { useState, useEffect, useRef } from 'react';
import { useApi } from '../hooks/useApi';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import {
  MessageSquare,
  Send,
  Bot,
  Sparkles,
  RefreshCw,
  UserCheck,
  Search,
  CheckCheck,
  CreditCard,
  Package,
  User,
  Radio,
} from 'lucide-react';

interface MessageItem {
  id: string;
  senderType: 'CUSTOMER' | 'USER' | 'AI_AGENT' | 'SYSTEM';
  direction: 'INBOUND' | 'OUTBOUND';
  content: string;
  type?: string;
  createdAt: string;
  aiResponse?: boolean;
  aiInterpretation?: {
    intent?: string;
    confidence?: number;
    handoffToHuman?: boolean;
  };
}

interface ConversationItem {
  id: string;
  customer: {
    id: string;
    name: string;
    phone: string;
    segment: string;
    avatar?: string;
  };
  channelType: 'WHATSAPP' | 'WEBSITE' | 'SMS' | 'INSTAGRAM';
  status: 'OPEN' | 'WAITING' | 'RESOLVED' | 'CLOSED';
  isAiHandled: boolean;
  lastMessageAt: string;
  unreadCount: number;
  messages?: MessageItem[];
}

function timeAgo(dateString: string) {
  const diff = (Date.now() - new Date(dateString).getTime()) / 1000;
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(dateString).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

export function Conversations() {
  const { fetchWithAuth } = useApi();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeConvId, setActiveConvId] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');
  const [inputText, setInputText] = useState<string>('');
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadConversations();
  }, [statusFilter, search]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversations, activeConvId]);

  const loadConversations = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (search) params.set('search', search);

      const res = await fetchWithAuth(`/conversations?${params}`);
      setConversations(res.data || []);
      if (!activeConvId || !(res.data || []).find((c: any) => c.id === activeConvId)) {
        setActiveConvId(res.data?.[0]?.id ?? '');
      }
      setLoadError(null);
    } catch (e: any) {
      setLoadError(e?.message || 'Could not load conversations.');
    }
  };

  const activeConv = conversations.find(c => c.id === activeConvId);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeConv) return;

    const updatedText = inputText;
    setInputText('');

    try {
      const res = await fetchWithAuth(`/conversations/${activeConv.id}/messages`, {
        method: 'POST',
        data: { content: updatedText },
      });
      // Append the real saved message (with its real id/timestamp) rather
      // than an optimistic client-only one that stays even if the send
      // actually failed.
      setConversations(prev => prev.map(c =>
        c.id === activeConv.id ? { ...c, lastMessageAt: new Date().toISOString(), messages: [...(c.messages || []), res.data] } : c
      ));
      setActionError(null);
    } catch (err: any) {
      setInputText(updatedText);
      setActionError(err?.message || 'Failed to send message.');
    }
  };

  const handleAiDraftReply = async () => {
    if (!activeConv) return;
    setIsAiGenerating(true);
    try {
      const history = (activeConv.messages || []).map(m => ({
        role: (m.direction === 'INBOUND' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.content,
      }));

      const lastCustomerMsg = [...(activeConv.messages || [])]
        .reverse()
        .find(m => m.direction === 'INBOUND')?.content || 'Hello';

      const res = await fetchWithAuth('/ai/chat', {
        method: 'POST',
        data: {
          message: lastCustomerMsg,
          customerId: activeConv.customer.id,
          conversationId: activeConv.id,
          history,
        },
      });

      if (res && res.data?.reply) {
        setInputText(res.data.reply);
        setActionError(null);
      }
    } catch (e: any) {
      // A failed AI draft must not be replaced with a fabricated reply --
      // leave the input empty and surface the real error instead.
      setActionError(e?.message || 'Failed to generate an AI draft.');
    } finally {
      setIsAiGenerating(false);
    }
  };

  // Local-only UI state -- no biz-conversations endpoint persists
  // isAiHandled directly (same as SAAS's original design; not something
  // this session's port removed). Reverts on reload, which is a real
  // feature gap, not data fabrication -- it never claims to be saved.
  const toggleAiMode = () => {
    if (!activeConv) return;
    const nextMode = !activeConv.isAiHandled;
    setConversations(prev => prev.map(c => c.id === activeConv.id ? { ...c, isAiHandled: nextMode } : c));
  };

  const updateStatus = async (status: 'OPEN' | 'WAITING' | 'RESOLVED') => {
    if (!activeConv) return;
    try {
      await fetchWithAuth(`/conversations/${activeConv.id}/status`, {
        method: 'PATCH',
        data: { status },
      });
      setConversations(prev => prev.map(c => c.id === activeConv.id ? { ...c, status } : c));
      setActionError(null);
    } catch (e: any) {
      setActionError(e?.message || 'Failed to update conversation status.');
    }
  };

  return (
    <div style={{ height: 'calc(100vh - 110px)', display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {(loadError || actionError) && (
        <div style={{ background: 'rgba(239, 68, 68, 0.08)', color: '#ef4444', padding: '10px 16px', borderRadius: '8px', fontSize: '13px' }}>
          {loadError || actionError} {loadError && <button onClick={loadConversations} style={{ background: 'none', border: 'none', color: 'inherit', textDecoration: 'underline', cursor: 'pointer', fontSize: 'inherit' }}>Retry</button>}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
            Universal Inbox
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, marginTop: '2px' }}>
            Multi-channel conversations managed by AI agents + human team
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <Button variant="secondary" size="sm" onClick={loadConversations}>
            <RefreshCw size={13} style={{ marginRight: '6px' }} />
            Refresh
          </Button>
          <Button variant="accent" size="sm" onClick={() => setInputText('Namaste! Welcome to our store. How can I help you today?')}>
            <Radio size={13} style={{ marginRight: '6px' }} />
            Broadcast
          </Button>
        </div>
      </div>

      {/* Main 3-Column Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr 280px', gap: '16px', flex: 1, minHeight: 0 }}>
        
        {/* LEFT COLUMN: Conversation List */}
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '14px', borderBottom: '1px solid var(--border-color)' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '6px 10px',
                marginBottom: '10px',
              }}
            >
              <Search size={14} color="var(--text-tertiary)" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search chats..."
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontSize: '12px',
                  color: 'var(--text-primary)',
                  width: '100%',
                }}
              />
            </div>

            {/* Filter tabs */}
            <div style={{ display: 'flex', gap: '3px', background: 'var(--bg-tertiary)', padding: '3px', borderRadius: '8px' }}>
              {(['ALL', 'OPEN', 'WAITING', 'RESOLVED'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  style={{
                    flex: 1,
                    padding: '5px 0',
                    fontSize: '11px',
                    fontWeight: 600,
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    background: statusFilter === s ? 'var(--bg-card)' : 'transparent',
                    color: statusFilter === s ? 'var(--text-primary)' : 'var(--text-secondary)',
                    boxShadow: statusFilter === s ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Conversation list stream */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
            {conversations.map(conv => {
              const isActive = conv.id === activeConv?.id;
              const lastMsg = conv.messages?.[conv.messages.length - 1]?.content || 'No messages yet';
              return (
                <div
                  key={conv.id}
                  onClick={() => setActiveConvId(conv.id)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    marginBottom: '4px',
                    cursor: 'pointer',
                    background: isActive ? 'var(--accent-primary-soft)' : 'transparent',
                    border: isActive ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid transparent',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #10b981, #6366f1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: '13px',
                      }}
                    >
                      {conv.customer.name.charAt(0)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }} className="truncate">
                          {conv.customer.name}
                        </span>
                        <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
                          {timeAgo(conv.lastMessageAt)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                        <span style={{ fontSize: '10px', color: conv.channelType === 'WHATSAPP' ? '#10b981' : '#3b82f6', fontWeight: 600 }}>
                          {conv.channelType === 'WHATSAPP' ? 'WhatsApp' : 'Website'}
                        </span>
                        {conv.isAiHandled && (
                          <span style={{ fontSize: '9px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>
                            AI
                          </span>
                        )}
                        {conv.status === 'WAITING' && (
                          <span style={{ fontSize: '9px', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>
                            Human
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', paddingLeft: '42px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {lastMsg}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* CENTER COLUMN: Active Chat Feed */}
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Chat Header */}
          <div
            style={{
              padding: '12px 18px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--bg-tertiary)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #10b981, #6366f1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '13px',
                }}
              >
                {activeConv?.customer.name.charAt(0) || 'U'}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>{activeConv?.customer.name}</span>
                  <Badge variant={activeConv?.customer.segment === 'VIP' ? 'purple' : 'primary'}>
                    {activeConv?.customer.segment}
                  </Badge>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{activeConv?.customer.phone}</div>
              </div>
            </div>

            {/* AI Toggle & Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Button
                variant={activeConv?.isAiHandled ? 'accent' : 'secondary'}
                size="sm"
                onClick={toggleAiMode}
              >
                <Bot size={13} style={{ marginRight: '5px' }} />
                {activeConv?.isAiHandled ? 'AI Autopilot ON' : 'Manual Mode'}
              </Button>
              {activeConv?.status !== 'RESOLVED' ? (
                <Button variant="ghost" size="sm" onClick={() => updateStatus('RESOLVED')}>
                  <CheckCheck size={13} style={{ marginRight: '4px' }} />
                  Resolve
                </Button>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => updateStatus('OPEN')}>
                  Reopen
                </Button>
              )}
            </div>
          </div>

          {/* Messages Stream */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {(activeConv?.messages || []).map((msg) => {
              const isCustomer = msg.direction === 'INBOUND';
              const isAi = msg.senderType === 'AI_AGENT';
              return (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isCustomer ? 'flex-start' : 'flex-end',
                    maxWidth: '75%',
                    alignSelf: isCustomer ? 'flex-start' : 'flex-end',
                  }}
                >
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: isCustomer ? '4px 14px 14px 14px' : '14px 4px 14px 14px',
                      background: isCustomer
                        ? 'var(--bg-tertiary)'
                        : isAi
                        ? 'var(--accent-primary-soft)'
                        : 'var(--accent-primary)',
                      border: isAi ? '1px solid rgba(16, 185, 129, 0.25)' : 'none',
                      color: isCustomer || isAi ? 'var(--text-primary)' : '#fff',
                      fontSize: '13px',
                      lineHeight: '1.5',
                    }}
                  >
                    {isAi && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px', fontSize: '10px', color: '#10b981', fontWeight: 700 }}>
                        <Bot size={11} />
                        <span>BusinessOS AI Agent</span>
                        {msg.aiInterpretation?.intent && (
                          <span style={{ opacity: 0.8 }}>· {msg.aiInterpretation.intent}</span>
                        )}
                      </div>
                    )}
                    <div>{msg.content}</div>
                  </div>
                  <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '3px' }}>
                    {timeAgo(msg.createdAt)}
                  </span>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* AI Suggestion Bar */}
          <div style={{ padding: '8px 14px', background: 'var(--bg-tertiary)', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>Copilot:</span>
              <button
                onClick={handleAiDraftReply}
                disabled={isAiGenerating}
                style={{
                  fontSize: '11px',
                  background: 'var(--accent-primary-soft)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  color: '#10b981',
                  padding: '3px 10px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Sparkles size={11} />
                <span>{isAiGenerating ? 'Drafting...' : 'Generate AI Draft Reply'}</span>
              </button>
            </div>
            <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>WhatsApp Cloud Connected</span>
          </div>

          {/* Chat Input */}
          <form onSubmit={handleSendMessage} style={{ padding: '10px 14px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '8px', background: 'var(--bg-card)' }}>
            <input
              type="text"
              className="input"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder={`Message ${activeConv?.customer.name || 'Customer'}...`}
              style={{ flex: 1 }}
            />
            <Button type="submit" variant="accent" size="sm">
              <Send size={13} style={{ marginRight: '4px' }} />
              Send
            </Button>
          </form>
        </div>

        {/* RIGHT COLUMN: Customer 360 Drawer */}
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            boxShadow: 'var(--shadow-sm)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            height: '100%',
            overflowY: 'auto',
          }}
        >
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
              Customer 360
            </div>
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #10b981, #6366f1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '16px',
                  margin: '0 auto 8px',
                }}
              >
                {activeConv?.customer.name.charAt(0) || 'U'}
              </div>
              <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>{activeConv?.customer.name}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{activeConv?.customer.phone}</div>
              <div style={{ marginTop: '6px' }}>
                <Badge variant="purple">{activeConv?.customer.segment} Customer</Badge>
              </div>
            </div>
          </div>

          {/* Quick Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div style={{ background: 'var(--bg-tertiary)', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>Orders</div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>31</div>
            </div>
            <div style={{ background: 'var(--bg-tertiary)', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>LTV</div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: '#10b981', marginTop: '2px' }}>₹18,420</div>
            </div>
          </div>

          {/* AI Recommendation */}
          <div style={{ background: 'var(--accent-primary-soft)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '10px', borderRadius: '8px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#10b981', marginBottom: '3px' }}>🎯 AI Recommendation</div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              High re-order frequency for staple groceries. Recommended promo: 10% off Dairy bundles.
            </div>
          </div>

          {/* Quick Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: 'auto' }}>
            <Button variant="secondary" size="sm" onClick={() => setInputText('Your order #1848 has been packed and will arrive by 5 PM! 🚚')}>
              <Package size={12} style={{ marginRight: '4px' }} />
              Send Order Update
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setInputText('Here is your UPI payment link for ₹560: upi://pay?pa=store@upi&am=560 💳')}>
              <CreditCard size={12} style={{ marginRight: '4px' }} />
              Send Payment Link
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}
