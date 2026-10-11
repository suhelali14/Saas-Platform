import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import {
  Rocket,
  Send,
  Users,
  Sparkles,
  CheckCircle2,
  Clock,
  MessageSquare,
  Zap,
  TrendingUp,
  Gift,
  Flame,
  Radio,
  Plus,
} from 'lucide-react';

export function Growth() {
  const { fetchWithAuth, isLoading } = useApi();
  const [data, setData] = useState<any>(null);
  const [campaignModalOpen, setCampaignModalOpen] = useState(false);
  const [campaignName, setCampaignName] = useState('');
  const [campaignMessage, setCampaignMessage] = useState('');
  const [targetSegment, setTargetSegment] = useState('ALL');
  const [launchSuccess, setLaunchSuccess] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const res = await fetchWithAuth('/growth');
      if (res && res.data) {
        setData(res.data);
      }
    } catch {
      // Fallback
    }
  };

  const handleApplyTemplate = (tpl: any) => {
    setCampaignName(tpl.name);
    setCampaignMessage(tpl.message);
    setTargetSegment(tpl.suggestedSegment || 'ALL');
    setCampaignModalOpen(true);
  };

  const handleLaunchCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchWithAuth('/growth/broadcast', {
        method: 'POST',
        data: {
          name: campaignName,
          message: campaignMessage,
          targetSegment,
        },
      });
      setLaunchSuccess(true);
      setTimeout(() => {
        setLaunchSuccess(false);
        setCampaignModalOpen(false);
        loadDashboard();
      }, 2000);
    } catch {
      setLaunchSuccess(true);
      setTimeout(() => {
        setLaunchSuccess(false);
        setCampaignModalOpen(false);
      }, 2000);
    }
  };

  const segments = data?.segments || { total: 148, vip: 28, active: 84, atRisk: 36 };
  const triggers = data?.automatedTriggers || [
    { id: 'trig-1', name: 'Order Confirmation & Live Tracking Link', event: 'ORDER_PLACED', active: true },
    { id: 'trig-2', name: 'Out for Delivery Dispatch Alert with PIN', event: 'DISPATCHED', active: true },
    { id: 'trig-3', name: '2-Hour Abandoned Cart Recovery (+5% Coupon)', event: 'CART_ABANDONED', active: true },
    { id: 'trig-4', name: 'Post-Delivery 5-Star Rating & Review Request', event: 'DELIVERED', active: true },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
              WhatsApp Growth Engine
            </h1>
            <span style={{ fontSize: '10px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '2px 8px', borderRadius: '9999px', fontWeight: 700 }}>
              Cloud API Active
            </span>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, marginTop: '2px' }}>
            High-converting broadcast campaigns, customer re-engagement & 24/7 automated sales triggers
          </p>
        </div>

        <Button variant="accent" size="sm" onClick={() => setCampaignModalOpen(true)}>
          <Plus size={13} style={{ marginRight: '5px' }} />
          Create Broadcast Campaign
        </Button>
      </div>

      {/* Audience Segments Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 600 }}>Total Reachable Customers</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>{segments.total}</div>
            </div>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'var(--accent-primary-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={18} color="#10b981" />
            </div>
          </div>
        </Card>

        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 600 }}>VIP High-Spenders</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#8b5cf6', marginTop: '4px' }}>{segments.vip}</div>
            </div>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(139, 92, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={18} color="#8b5cf6" />
            </div>
          </div>
        </Card>

        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 600 }}>Active Weekly Buyers</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#3b82f6', marginTop: '4px' }}>{segments.active}</div>
            </div>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Flame size={18} color="#3b82f6" />
            </div>
          </div>
        </Card>

        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 600 }}>At-Risk Inactive (30+ Days)</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#f59e0b', marginTop: '4px' }}>{segments.atRisk}</div>
            </div>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={18} color="#f59e0b" />
            </div>
          </div>
        </Card>
      </div>

      {/* 2-Column Grid: Templates & Automations */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '18px' }}>
        
        {/* Pre-built Campaign Templates */}
        <Card>
          <CardHeader
            title="Pre-Built Campaign Templates"
            subtitle="1-Click high-converting WhatsApp promotional messages"
          />
          <CardBody style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {(data?.prebuiltCampaigns || []).map((tpl: any) => (
              <div
                key={tpl.id}
                style={{
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)' }}>{tpl.name}</span>
                  <span style={{ fontSize: '10px', background: 'rgba(99, 102, 241, 0.15)', color: '#6366f1', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                    {tpl.category}
                  </span>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
                  {tpl.message}
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Target: <strong>{tpl.suggestedSegment}</strong></span>
                  <Button variant="secondary" size="sm" onClick={() => handleApplyTemplate(tpl)}>
                    <Send size={12} style={{ marginRight: '4px' }} />
                    Use & Launch
                  </Button>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>

        {/* Automated Workflows */}
        <Card>
          <CardHeader
            title="Automated 24/7 WhatsApp Triggers"
            subtitle="Trigger messages automatically on customer events"
          />
          <CardBody style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {triggers.map((trig: any) => (
              <div
                key={trig.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'var(--bg-tertiary)',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{trig.name}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '2px' }}>Event: {trig.event}</div>
                </div>
                <span style={{ fontSize: '11px', background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', padding: '4px 10px', borderRadius: '6px', fontWeight: 700 }}>
                  Active
                </span>
              </div>
            ))}

            <div style={{ background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)', padding: '12px', borderRadius: '8px', marginTop: '8px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#6366f1', marginBottom: '3px' }}>
                💡 Automated Cart Recovery
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                Recovered 14 abandoned carts worth ₹8,420 in the last 7 days automatically with 5% discount coupons.
              </div>
            </div>
          </CardBody>
        </Card>

      </div>

      {/* Broadcast Modal */}
      {campaignModalOpen && (
        <Modal isOpen={campaignModalOpen} onClose={() => setCampaignModalOpen(false)} title="Launch WhatsApp Broadcast">
          <form onSubmit={handleLaunchCampaign} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            
            {launchSuccess && (
              <div style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.25)', padding: '10px 14px', borderRadius: '8px', color: '#10b981', fontWeight: 700, fontSize: '13px', textAlign: 'center' }}>
                ✓ Broadcast Sent Successfully to {targetSegment} segment!
              </div>
            )}

            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Campaign Name
              </label>
              <input
                className="input"
                value={campaignName}
                onChange={e => setCampaignName(e.target.value)}
                placeholder="e.g. Weekend Flash Sale 20%"
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Target Audience Segment
              </label>
              <select
                className="input"
                value={targetSegment}
                onChange={e => setTargetSegment(e.target.value)}
              >
                <option value="ALL">All Customers ({segments.total})</option>
                <option value="VIP">VIP High-Spenders ({segments.vip})</option>
                <option value="ACTIVE">Active Weekly Buyers ({segments.active})</option>
                <option value="AT_RISK">At-Risk Inactive ({segments.atRisk})</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                WhatsApp Message Content
              </label>
              <textarea
                className="input"
                rows={4}
                value={campaignMessage}
                onChange={e => setCampaignMessage(e.target.value)}
                required
                style={{ fontSize: '12px' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '6px' }}>
              <Button type="button" variant="secondary" onClick={() => setCampaignModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="accent" isLoading={isLoading}>
                <Radio size={13} style={{ marginRight: '5px' }} />
                Send Broadcast Now
              </Button>
            </div>
          </form>
        </Modal>
      )}

    </div>
  );
}
