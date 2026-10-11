import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import {
  Store,
  Clock,
  Truck,
  MessageSquare,
  Shield,
  CreditCard,
  Check,
  Save,
  Key,
  MapPin,
  Phone,
  Mail,
  Zap,
  Sparkles,
  Radio,
  TrendingUp,
  Users,
  Target,
  Globe,
  ToggleLeft,
  ToggleRight,
  ExternalLink,
} from 'lucide-react';


export function Settings() {
  const { fetchWithAuth, isLoading } = useApi();
  const { business, refreshAuth } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'profile' | 'delivery' | 'whatsapp' | 'plan' | 'ai' | 'requests' | 'intently' | 'payments'>('profile');

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [intentlyDemand, setIntentlyDemand] = useState<any>(null);
  const [intentlySettings, setIntentlySettings] = useState({
    intentlyEnabled: false,
    intentlyRadius: 5,
    intentlyCategories: [] as string[],
    intentlyPlan: 'free',
    autoAcceptUnder: 500,
    responseTargetMin: 15,
  });
  const [genreRequests, setGenreRequests] = useState<any[]>([]);

  const [razorpayForm, setRazorpayForm] = useState({
    razorpayKeyId: '',
    razorpayKeySecret: '',
  });
  const [razorpaySaved, setRazorpaySaved] = useState(false);
  const [razorpayError, setRazorpayError] = useState<string | null>(null);


  const [form, setForm] = useState({
    name: business?.name || 'My Business',
    type: business?.type || 'RETAIL_GROCERY',
    phone: business?.phone || '+91 98765 43210',
    email: business?.email || 'owner@businessos.app',
    address: business?.address || 'Shop #12, Market Complex',
    city: business?.city || 'Mumbai',
    deliveryRadius: 5,
    minOrderValue: 199,
    freeDeliveryThreshold: 499,
    aiProvider: 'openai',
    aiApiKey: '',
  });

  useEffect(() => {
    if (business) {
      setForm(prev => ({
        ...prev,
        name: business.name || prev.name,
        type: business.type || prev.type,
        phone: business.phone || prev.phone,
        address: business.address || prev.address,
        city: business.city || prev.city,
        aiProvider: business.aiProvider || prev.aiProvider,
        aiApiKey: business.aiApiKey || prev.aiApiKey,
      }));
      setRazorpayForm({
        razorpayKeyId: business.razorpayKeyId || '',
        razorpayKeySecret: '', // don't prefill secret, it's write-only from UI perspective
      });

    }
  }, [business]);

  const fetchRequests = async () => {
    try {
      const res = await fetchWithAuth('/website/genre-requests');
      if (res?.data) setGenreRequests(res.data);
    } catch (e) {}
  };

  useEffect(() => {
    if (activeTab === 'requests') {
      fetchRequests();
    }
    if (activeTab === 'intently') {
      fetchIntentlyData();
    }
  }, [activeTab]);

  const fetchIntentlyData = async () => {
    try {
      const [settingsRes, demandRes] = await Promise.all([
        fetchWithAuth('/intently/settings'),
        fetchWithAuth('/intently/demand'),
      ]);
      if (settingsRes?.data) setIntentlySettings(settingsRes.data);
      if (demandRes?.data) setIntentlyDemand(demandRes.data);
    } catch {
      // Real failure -- leave intentlyDemand null so the section stays
      // hidden (it's rendered behind `{intentlyDemand && (...)}`) instead
      // of showing fabricated demand numbers.
      setSaveError('Could not load Intently demand data.');
    }
  };

  const handleSaveIntently = async () => {
    try {
      await fetchWithAuth('/intently/settings', {
        method: 'PUT',
        data: intentlySettings,
      });
      setSavedSuccess(true);
      setSaveError(null);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (e: any) {
      setSaveError(e?.message || 'Failed to save Intently settings.');
    }
  };


  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      await fetchWithAuth(`/website/genre-requests/${id}`, {
        method: 'PATCH',
        data: { status }
      });
      fetchRequests();
    } catch (e) {}
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchWithAuth('/business/profile', {
        method: 'PUT',
        data: form,
      });
      await refreshAuth();
      setSavedSuccess(true);
      setSaveError(null);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (e: any) {
      setSaveError(e?.message || 'Failed to save business profile.');
    }
  };

  const handleSaveRazorpay = async () => {
    setRazorpayError(null);
    try {
      await fetchWithAuth('/business/profile', {
        method: 'PUT',
        data: razorpayForm,
      });
      setRazorpaySaved(true);
      // Mask the secret after save
      setRazorpayForm(prev => ({ ...prev, razorpayKeySecret: '' }));
      setTimeout(() => setRazorpaySaved(false), 3000);
    } catch (e: any) {
      setRazorpayError(e?.message || 'Failed to save payment settings.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
            Store Settings & Operations
          </h1>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, marginTop: '2px' }}>
            Store profile, delivery radius policies, WhatsApp credentials & subscription plan
          </p>
        </div>

        {savedSuccess && (
          <span style={{ fontSize: '12px', background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', padding: '6px 12px', borderRadius: '8px', fontWeight: 600 }}>
            ✓ Settings Saved Successfully
          </span>
        )}
        {saveError && (
          <span style={{ fontSize: '12px', background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', padding: '6px 12px', borderRadius: '8px', fontWeight: 600 }}>
            {saveError}
          </span>
        )}
      </div>

      {/* Settings Navigation Tabs */}
      <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-tertiary)', padding: '4px', borderRadius: '10px', width: 'fit-content' }}>
        <button
          onClick={() => setActiveTab('profile')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '7px 14px',
            fontSize: '12px',
            fontWeight: activeTab === 'profile' ? 700 : 500,
            borderRadius: '7px',
            border: 'none',
            cursor: 'pointer',
            background: activeTab === 'profile' ? 'var(--bg-card)' : 'transparent',
            color: activeTab === 'profile' ? 'var(--text-primary)' : 'var(--text-secondary)',
            boxShadow: activeTab === 'profile' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
          }}
        >
          <Store size={13} />
          <span>Store Profile</span>
        </button>

        <button
          onClick={() => setActiveTab('delivery')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '7px 14px',
            fontSize: '12px',
            fontWeight: activeTab === 'delivery' ? 700 : 500,
            borderRadius: '7px',
            border: 'none',
            cursor: 'pointer',
            background: activeTab === 'delivery' ? 'var(--bg-card)' : 'transparent',
            color: activeTab === 'delivery' ? 'var(--text-primary)' : 'var(--text-secondary)',
            boxShadow: activeTab === 'delivery' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
          }}
        >
          <Truck size={13} />
          <span>Delivery Rules</span>
        </button>

        <button
          onClick={() => setActiveTab('whatsapp')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '7px 14px',
            fontSize: '12px',
            fontWeight: activeTab === 'whatsapp' ? 700 : 500,
            borderRadius: '7px',
            border: 'none',
            cursor: 'pointer',
            background: activeTab === 'whatsapp' ? 'var(--bg-card)' : 'transparent',
            color: activeTab === 'whatsapp' ? 'var(--text-primary)' : 'var(--text-secondary)',
            boxShadow: activeTab === 'whatsapp' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
          }}
        >
          <MessageSquare size={13} />
          <span>WhatsApp API</span>
        </button>

        <button
          onClick={() => setActiveTab('plan')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '7px 14px',
            fontSize: '12px',
            fontWeight: activeTab === 'plan' ? 700 : 500,
            borderRadius: '7px',
            border: 'none',
            cursor: 'pointer',
            background: activeTab === 'plan' ? 'var(--bg-card)' : 'transparent',
            color: activeTab === 'plan' ? 'var(--text-primary)' : 'var(--text-secondary)',
            boxShadow: activeTab === 'plan' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
          }}
        >
          <Zap size={13} />
          <span>Plan & Billing</span>
        </button>

        <button
          onClick={() => setActiveTab('ai')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '7px 14px',
            fontSize: '12px',
            fontWeight: activeTab === 'ai' ? 700 : 500,
            borderRadius: '7px',
            border: 'none',
            cursor: 'pointer',
            background: activeTab === 'ai' ? 'var(--bg-card)' : 'transparent',
            color: activeTab === 'ai' ? 'var(--text-primary)' : 'var(--text-secondary)',
            boxShadow: activeTab === 'ai' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
          }}
        >
          <Key size={13} />
          <span>AI Config (BYOK)</span>
        </button>

        <button
          onClick={() => setActiveTab('requests')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '7px 14px',
            fontSize: '12px',
            fontWeight: activeTab === 'requests' ? 700 : 500,
            borderRadius: '7px',
            border: 'none',
            cursor: 'pointer',
            background: activeTab === 'requests' ? 'var(--bg-card)' : 'transparent',
            color: activeTab === 'requests' ? 'var(--text-primary)' : 'var(--text-secondary)',
            boxShadow: activeTab === 'requests' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
          }}
        >
          <Sparkles size={13} />
          <span>Custom Requests</span>
        </button>

        {/* Intently Marketplace tab — highlighted with accent */}
        <button
          onClick={() => setActiveTab('intently')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '7px 14px',
            fontSize: '12px',
            fontWeight: activeTab === 'intently' ? 700 : 500,
            borderRadius: '7px',
            border: 'none',
            cursor: 'pointer',
            background: activeTab === 'intently'
              ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)'
              : 'transparent',
            color: activeTab === 'intently' ? '#fff' : 'var(--text-secondary)',
            boxShadow: activeTab === 'intently' ? '0 2px 8px rgba(99,102,241,0.3)' : 'none',
          }}
        >
          <Radio size={13} />
          <span>Intently Marketplace</span>
          {!intentlySettings.intentlyEnabled && (
            <span style={{ fontSize: '9px', background: 'rgba(99,102,241,0.15)', color: '#6366f1', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>NEW</span>
          )}
        </button>

        {/* Payments (Razorpay) tab */}
        <button
          onClick={() => setActiveTab('payments')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '7px 14px',
            fontSize: '12px',
            fontWeight: activeTab === 'payments' ? 700 : 500,
            borderRadius: '7px',
            border: 'none',
            cursor: 'pointer',
            background: activeTab === 'payments' ? 'var(--bg-card)' : 'transparent',
            color: activeTab === 'payments' ? 'var(--text-primary)' : 'var(--text-secondary)',
            boxShadow: activeTab === 'payments' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
          }}
        >
          <CreditCard size={13} />
          <span>Online Payments</span>
        </button>
      </div>

      {/* TAB 1: STORE PROFILE */}
      {activeTab === 'profile' && (
        <Card style={{ maxWidth: '650px' }}>
          <CardHeader title="Store Identity & Contact" subtitle="Displayed on public website, receipts, and invoices" />
          <CardBody>
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Business Legal Name
                </label>
                <input
                  className="input"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Store Phone Number
                  </label>
                  <input
                    className="input"
                    value={form.phone}
                    onChange={e => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Official Email
                  </label>
                  <input
                    className="input"
                    value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Store Address & Landmark
                </label>
                <input
                  className="input"
                  value={form.address}
                  onChange={e => setForm({ ...form, address: e.target.value })}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  City & State
                </label>
                <input
                  className="input"
                  value={form.city}
                  onChange={e => setForm({ ...form, city: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                <Button type="submit" variant="accent" isLoading={isLoading}>
                  <Save size={13} style={{ marginRight: '5px' }} />
                  Save Changes
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      {/* TAB 2: DELIVERY RULES */}
      {activeTab === 'delivery' && (
        <Card style={{ maxWidth: '650px' }}>
          <CardHeader title="Delivery Policies & Minimums" subtitle="Control online order checkout eligibility" />
          <CardBody>
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Maximum Doorstep Delivery Radius (in Kilometers)
                </label>
                <input
                  type="number"
                  className="input"
                  value={form.deliveryRadius}
                  onChange={e => setForm({ ...form, deliveryRadius: Number(e.target.value) })}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Minimum Order Value for Checkout (₹)
                </label>
                <input
                  type="number"
                  className="input"
                  value={form.minOrderValue}
                  onChange={e => setForm({ ...form, minOrderValue: Number(e.target.value) })}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Free Delivery Threshold (₹)
                </label>
                <input
                  type="number"
                  className="input"
                  value={form.freeDeliveryThreshold}
                  onChange={e => setForm({ ...form, freeDeliveryThreshold: Number(e.target.value) })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                <Button type="submit" variant="accent" isLoading={isLoading}>
                  <Save size={13} style={{ marginRight: '5px' }} />
                  Save Delivery Rules
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      {/* TAB 3: WHATSAPP API */}
      {activeTab === 'whatsapp' && (
        <Card style={{ maxWidth: '650px' }}>
          <CardHeader title="Meta WhatsApp Cloud API" subtitle="Connect your official WhatsApp Business Account" />
          <CardBody style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', padding: '12px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Shield size={20} color="#f59e0b" />
              <div style={{ fontSize: '12px', color: 'var(--text-primary)' }}>
                <strong>Not connected yet.</strong> WhatsApp Cloud API integration is coming soon -- raise a support ticket if you'd like early access.
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* TAB 4: PLAN & BILLING */}
      {activeTab === 'plan' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', maxWidth: '900px' }}>

          {[
            { id: 'STARTER', label: 'STARTER', price: '₹999', desc: 'Ideal for small single-store local businesses', features: ['500 WhatsApp Messages/mo', 'AI Website Storefront', 'Basic Order POS'] },
            { id: 'GROWTH', label: 'GROWTH', price: '₹2,499', desc: 'For ambitious growing retailers & multi-service studios', features: ['Unlimited WhatsApp AI Autopilot', 'Custom Domain Storefront', 'Razorpay UPI Settlement', 'Automated Marketing Broadcasts'], popular: true },
            { id: 'BUSINESS', label: 'BUSINESS', price: '₹4,999', desc: 'Multi-branch chains with custom enterprise workflows', features: ['Multi-outlet Staff Permissions', 'Dedicated Account Manager', 'Custom ERP & Accounting Sync'] },
          ].map((tier) => {
            const isCurrent = (business?.plan || 'STARTER') === tier.id;
            return (
              <Card key={tier.id} style={tier.popular ? { border: '2px solid #10b981', position: 'relative' } : undefined}>
                {tier.popular && (
                  <span style={{ position: 'absolute', top: '-10px', right: '16px', background: '#10b981', color: '#000', padding: '2px 8px', borderRadius: '9999px', fontSize: '10px', fontWeight: 800 }}>
                    MOST POPULAR
                  </span>
                )}
                <div style={{ padding: '4px 0' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: tier.popular ? '#10b981' : 'var(--text-tertiary)' }}>{tier.label}</span>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', margin: '6px 0' }}>
                    {tier.price}<span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>/mo</span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>{tier.desc}</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '16px 0', fontSize: '12px' }}>
                    {tier.features.map((f) => <div key={f}>✓ {f}</div>)}
                  </div>
                  {isCurrent ? (
                    <Button variant="accent" size="sm" style={{ width: '100%' }} disabled>Current Active Plan</Button>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      style={{ width: '100%' }}
                      onClick={() => navigate('/tickets')}
                      title="Plan changes are handled by our team -- raise a ticket to switch."
                    >
                      Contact Us to Switch
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}

        </div>
      )}

      {/* TAB 5: AI CONFIG (BYOK) */}
      {activeTab === 'ai' && (
        <Card style={{ maxWidth: '650px' }}>
          <CardHeader title="AI Provider (BYOK)" subtitle="Bring Your Own Key for Website Builder & CRM AI" />
          <CardBody>
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ padding: '12px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '8px' }}>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>
                  By default, the platform uses our internal API keys for generations. You can override this and use your own API keys for unlimited scalable AI usage.
                </p>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Select AI Provider
                </label>
                <select
                  className="input"
                  value={form.aiProvider}
                  onChange={e => setForm({ ...form, aiProvider: e.target.value })}
                >
                  <option value="openai">OpenAI (GPT-4o)</option>
                  <option value="gemini">Google Gemini (Gemini 1.5 Pro)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  API Key (Secret)
                </label>
                <input
                  type="password"
                  className="input"
                  placeholder="sk-..."
                  value={form.aiApiKey}
                  onChange={e => setForm({ ...form, aiApiKey: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                <Button type="submit" variant="accent" isLoading={isLoading}>
                  <Save size={13} style={{ marginRight: '5px' }} />
                  Save AI Config
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      {/* TAB 6: CUSTOM SOLUTION REQUESTS (ADMIN) */}
      {activeTab === 'requests' && (
        <Card style={{ maxWidth: '800px' }}>
          <CardHeader title="Genre Product Requests" subtitle="Manage incoming custom solution requests from users" />
          <CardBody>
            {genreRequests.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                No requests found.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {genreRequests.map((req) => (
                  <div key={req.id} style={{ padding: '16px', background: 'var(--bg-tertiary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div>
                        <h4 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '14px' }}>{req.genre}</h4>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{req.business?.name} ({req.business?.email})</span>
                      </div>
                      <Badge variant={req.status === 'PENDING' ? 'outline' : req.status === 'COMPLETED' ? 'default' : 'secondary'}>
                        {req.status}
                      </Badge>
                    </div>
                    <p style={{ margin: '8px 0', fontSize: '13px', color: 'var(--text-primary)', background: 'var(--bg-primary)', padding: '10px', borderRadius: '6px' }}>
                      {req.requirements}
                    </p>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                      {req.status === 'PENDING' && (
                        <Button size="sm" variant="secondary" onClick={() => handleUpdateStatus(req.id, 'IN_PROGRESS')}>
                          Mark In Progress
                        </Button>
                      )}
                      {(req.status === 'PENDING' || req.status === 'IN_PROGRESS') && (
                        <Button size="sm" variant="accent" onClick={() => handleUpdateStatus(req.id, 'COMPLETED')}>
                          Mark Completed
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* TAB 7: INTENTLY MARKETPLACE */}
      {activeTab === 'intently' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Demand Intelligence Preview */}
          {intentlyDemand && (
            <div style={{
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              borderRadius: '12px',
              padding: '20px 24px',
              color: '#fff',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>🔥 Live Demand in Your Area</h3>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12px', opacity: 0.85 }}>People are searching for exactly what you offer right now</p>
                </div>
                <Badge variant="outline" style={{ borderColor: 'rgba(255,255,255,0.4)', color: '#fff', fontSize: '11px' }}>Last 7 days</Badge>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: '8px', padding: '12px' }}>
                  <div style={{ fontSize: '22px', fontWeight: 800 }}>{intentlyDemand.recentIntentsToday}</div>
                  <div style={{ fontSize: '11px', opacity: 0.85, marginTop: '2px' }}>Searches today</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: '8px', padding: '12px' }}>
                  <div style={{ fontSize: '22px', fontWeight: 800 }}>{intentlyDemand.weeklyTotal}</div>
                  <div style={{ fontSize: '11px', opacity: 0.85, marginTop: '2px' }}>This week total</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: '8px', padding: '12px' }}>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: '#fde68a' }}>{intentlyDemand.unmatchedOpportunity}</div>
                  <div style={{ fontSize: '11px', opacity: 0.85, marginTop: '2px' }}>Unserved searches</div>
                </div>
              </div>
              {!intentlySettings.intentlyEnabled && (
                <div style={{ marginTop: '16px', background: 'rgba(255,255,255,0.12)', borderRadius: '8px', padding: '10px 14px', fontSize: '12px' }}>
                  ⚡ Enable your listing below to start capturing these {intentlyDemand.unmatchedOpportunity} unserved searches
                </div>
              )}
            </div>
          )}

          {/* Main Settings Card */}
          <Card>
            <CardHeader
              title="Intently Marketplace Settings"
              subtitle="Control how your business appears on the Intently consumer marketplace"
            />
            <CardBody>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                {/* Master Toggle */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '16px',
                  background: intentlySettings.intentlyEnabled ? 'rgba(16,185,129,0.06)' : 'var(--bg-tertiary)',
                  borderRadius: '10px',
                  border: `1px solid ${intentlySettings.intentlyEnabled ? 'rgba(16,185,129,0.25)' : 'var(--border-color)'}`,
                }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Enable Intently Marketplace Listing</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {intentlySettings.intentlyEnabled
                        ? '✅ Your business is live on Intently — consumers can find and book you'
                        : 'Join the marketplace to reach consumers actively searching for your services'}
                    </div>
                  </div>
                  <button
                    onClick={() => setIntentlySettings(s => ({ ...s, intentlyEnabled: !s.intentlyEnabled }))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    {intentlySettings.intentlyEnabled
                      ? <ToggleRight size={36} color="#10b981" />
                      : <ToggleLeft size={36} color="var(--text-tertiary)" />}
                  </button>
                </div>

                {intentlySettings.intentlyEnabled && (
                  <>
                    {/* Profile URL */}
                    <div style={{ padding: '12px 16px', background: 'var(--bg-tertiary)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '2px' }}>Your Intently Profile URL</div>
                        <div style={{ fontSize: '13px', color: '#6366f1', fontFamily: 'monospace' }}>intently.app/s/{business?.city?.toLowerCase()}-{business?.name?.toLowerCase().replace(/\s+/g, '-')}</div>
                      </div>
                      <button style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        <ExternalLink size={12} /> View
                      </button>
                    </div>

                    {/* Service Radius */}
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Service Radius (km)</label>
                      <input
                        type="range"
                        min={1} max={30} step={1}
                        value={intentlySettings.intentlyRadius}
                        onChange={e => setIntentlySettings(s => ({ ...s, intentlyRadius: Number(e.target.value) }))}
                        style={{ width: '100%', accentColor: '#6366f1' }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                        <span>1 km</span>
                        <span style={{ fontWeight: 700, color: '#6366f1' }}>{intentlySettings.intentlyRadius} km</span>
                        <span>30 km</span>
                      </div>
                    </div>

                    {/* Response Time Target */}
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                        Response Time Target <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(affects your search ranking)</span>
                      </label>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {[5, 15, 30, 60].map(mins => (
                          <button
                            key={mins}
                            onClick={() => setIntentlySettings(s => ({ ...s, responseTargetMin: mins }))}
                            style={{
                              padding: '6px 16px',
                              borderRadius: '6px',
                              border: `1px solid ${intentlySettings.responseTargetMin === mins ? '#6366f1' : 'var(--border-color)'}`,
                              background: intentlySettings.responseTargetMin === mins ? '#6366f1' : 'transparent',
                              color: intentlySettings.responseTargetMin === mins ? '#fff' : 'var(--text-secondary)',
                              fontSize: '13px',
                              fontWeight: 500,
                              cursor: 'pointer',
                            }}
                          >
                            {mins} min
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Auto-accept threshold */}
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Auto-accept orders under (₹)</label>
                      <input
                        type="number"
                        value={intentlySettings.autoAcceptUnder ?? ''}
                        placeholder="e.g. 500"
                        onChange={e => setIntentlySettings(s => ({ ...s, autoAcceptUnder: Number(e.target.value) }))}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '13px' }}
                      />
                      <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>Orders above this amount require your manual confirmation</div>
                    </div>
                  </>
                )}

                {/* Subscription Plan */}
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '10px' }}>Intently Plan</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                    {[
                      { id: 'free', label: 'Free', price: '₹0/mo', features: ['Basic listing', 'Up to 10 matches/day', 'Standard ranking'] },
                      { id: 'growth', label: 'Growth', price: '₹999/mo', features: ['Unlimited matches', 'Priority ranking', 'CRM leads feed', 'Analytics dashboard'] },
                      { id: 'intelligence', label: 'Intelligence', price: '₹2,999/mo', features: ['Everything in Growth', 'Demand intelligence', 'Unfulfilled demand alerts', 'Category insights API'] },
                    ].map(plan => (
                      <button
                        key={plan.id}
                        onClick={() => setIntentlySettings(s => ({ ...s, intentlyPlan: plan.id }))}
                        style={{
                          padding: '14px',
                          borderRadius: '10px',
                          border: `2px solid ${intentlySettings.intentlyPlan === plan.id ? '#6366f1' : 'var(--border-color)'}`,
                          background: intentlySettings.intentlyPlan === plan.id ? 'rgba(99,102,241,0.06)' : 'var(--bg-tertiary)',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <div style={{ fontSize: '13px', fontWeight: 700, color: intentlySettings.intentlyPlan === plan.id ? '#6366f1' : 'var(--text-primary)' }}>{plan.label}</div>
                        <div style={{ fontSize: '12px', color: '#6366f1', fontWeight: 600, margin: '2px 0 8px' }}>{plan.price}</div>
                        {plan.features.map(f => (
                          <div key={f} style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '3px' }}>✓ {f}</div>
                        ))}
                      </button>
                    ))}
                  </div>
                </div>

                <Button onClick={handleSaveIntently} variant="accent" style={{ alignSelf: 'flex-start', background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', border: 'none' }}>
                  Save Intently Settings
                </Button>

              </div>
            </CardBody>
          </Card>

          {/* Category Demand Breakdown */}
          {intentlyDemand?.demandByCategory?.length > 0 && (
            <Card>
              <CardHeader title="Demand by Category" subtitle="How many consumers searched each category this week" />
              <CardBody>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {intentlyDemand.demandByCategory.map((cat: any) => (
                    <div key={cat.category} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', textTransform: 'capitalize' }}>{cat.category}</span>
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{cat.total} total · <span style={{ color: '#f59e0b' }}>{cat.unmatched} unserved</span></span>
                        </div>
                        <div style={{ height: '6px', background: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${(cat.matched / cat.total) * 100}%`, background: 'linear-gradient(90deg, #6366f1, #8b5cf6)', borderRadius: '3px' }} />
                        </div>
                      </div>
                      <Badge variant={cat.unmatched > 20 ? 'warning' : 'success'}>
                        {Math.round((cat.matched / cat.total) * 100)}% served
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          )}

        </div>
      )}

      {/* TAB: PAYMENTS */}
      {activeTab === 'payments' && (
        <Card style={{ maxWidth: '650px' }}>
          <CardHeader 
            title="Online Payment Setup" 
            subtitle="Enable consumers to pay online when booking your services via Intently." 
          />
          <CardBody>
            <div style={{ padding: '16px', background: 'rgba(99,102,241,0.05)', borderRadius: '8px', marginBottom: '24px', border: '1px solid rgba(99,102,241,0.1)' }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#6366f1', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CreditCard size={15} /> Directly to your account
              </h4>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                We use your own Razorpay API keys to process payments. This means <b>money goes directly to your bank account</b> with no platform hold times or escrow delays. 
                <br /><br />
                You can get your keys from the <a href="https://dashboard.razorpay.com/app/keys" target="_blank" rel="noreferrer" style={{ color: '#6366f1', textDecoration: 'underline' }}>Razorpay Dashboard</a>.
              </p>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleSaveRazorpay(); }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Razorpay Key ID
                </label>
                <input
                  className="input"
                  placeholder="rzp_live_..."
                  value={razorpayForm.razorpayKeyId}
                  onChange={e => setRazorpayForm({ ...razorpayForm, razorpayKeyId: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Razorpay Key Secret
                </label>
                <input
                  type="password"
                  className="input"
                  placeholder="••••••••••••••••"
                  value={razorpayForm.razorpayKeySecret}
                  onChange={e => setRazorpayForm({ ...razorpayForm, razorpayKeySecret: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '13px' }}
                />
                <p style={{ margin: '6px 0 0 0', fontSize: '11px', color: 'var(--text-secondary)' }}>
                  This secret is stored securely and never returned to the frontend. Leave blank unless updating.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
                <Button type="submit" variant="primary" style={{ padding: '8px 24px' }}>
                  <Save size={14} style={{ marginRight: '6px' }} />
                  Save Payment Settings
                </Button>
                {razorpaySaved && <span style={{ fontSize: '12px', color: '#10b981', fontWeight: 500 }}>✓ Saved successfully</span>}
                {razorpayError && <span style={{ fontSize: '12px', color: '#ef4444', fontWeight: 500 }}>{razorpayError}</span>}
              </div>
            </form>
          </CardBody>
        </Card>
      )}

    </div>
  );
}
