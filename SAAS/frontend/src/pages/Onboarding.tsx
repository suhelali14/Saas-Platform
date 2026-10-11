import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useBusiness } from '../contexts/BusinessContext';
import { useApi } from '../hooks/useApi';
import { Button } from '../components/ui/Button';
import { Input, Textarea } from '../components/ui/Input';

// Smart onboarding (docs/plans smart-onboarding). Every step here saves to
// the backend before advancing (PATCH /onboarding/draft) so a business that
// closes the tab resumes where they left off, not at step 1. There is
// deliberately no "generate my website" step -- the backend infers the
// business's genre from what's collected here and builds the storefront +
// catalog automatically when step 7 confirms (POST /onboarding/complete).

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const DAY_LABELS: Record<string, string> = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };

type WorkingHours = Record<string, { open: string; close: string } | null>;

const PRESET_EVERY_DAY: WorkingHours = Object.fromEntries(DAYS.map((d) => [d, { open: '09:00', close: '21:00' }]));
const PRESET_MON_SAT: WorkingHours = Object.fromEntries(DAYS.map((d) => [d, d === 'sun' ? null : { open: '10:00', close: '20:00' }]));

const FULFILLMENT_OPTIONS: Record<string, { id: string; label: string }[]> = {
  FOOD_AND_DINING: [
    { id: 'DINE_IN', label: 'Dine-in' },
    { id: 'PICKUP', label: 'Pickup' },
    { id: 'DELIVERY', label: 'Delivery' },
  ],
  RETAIL_AND_SHOPPING: [
    { id: 'PICKUP', label: 'In-store pickup' },
    { id: 'DELIVERY', label: 'Delivery' },
  ],
  HEALTH_AND_BEAUTY: [{ id: 'APPOINTMENT_ONLY', label: 'By appointment' }],
  HOME_AND_PROFESSIONAL_SERVICES: [{ id: 'APPOINTMENT_ONLY', label: 'By appointment' }],
  EDUCATION_AND_COACHING: [{ id: 'APPOINTMENT_ONLY', label: 'By appointment / class schedule' }],
  OTHER: [
    { id: 'PICKUP', label: 'Pickup' },
    { id: 'DELIVERY', label: 'Delivery' },
    { id: 'APPOINTMENT_ONLY', label: 'By appointment' },
  ],
};

interface OfferedItem {
  name: string;
  price: string;
  description?: string;
}

export function Onboarding() {
  const { business, updateBusiness, refreshAuth } = useAuth();
  const { refreshDNA } = useBusiness();
  const { fetchWithAuth } = useApi();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categoryBuckets, setCategoryBuckets] = useState<Record<string, { label: string; types: string[] }>>({});

  // Step 1
  const [bucket, setBucket] = useState('');
  // Step 2
  const [name, setName] = useState(business?.name || '');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  // Step 3
  const [offeredItems, setOfferedItems] = useState<OfferedItem[]>([{ name: '', price: '' }]);
  // Step 4
  const [hoursPreset, setHoursPreset] = useState<'EVERY_DAY' | 'MON_SAT' | 'CUSTOM'>('EVERY_DAY');
  const [customHours, setCustomHours] = useState<WorkingHours>(PRESET_EVERY_DAY);
  const [fulfillment, setFulfillment] = useState<string[]>([]);
  const [teamSize, setTeamSize] = useState<'SOLO' | 'SMALL' | 'MEDIUM' | 'LARGE'>('SOLO');
  const [paymentMethods, setPaymentMethods] = useState<string[]>(['cash']);
  // Step 5
  const [whatsapp, setWhatsapp] = useState('');
  const [instagram, setInstagram] = useState('');
  // Step 6
  const [razorpayKeyId, setRazorpayKeyId] = useState('');
  const [razorpayKeySecret, setRazorpayKeySecret] = useState('');
  // Step 7
  const [classification, setClassification] = useState<any>(null);
  const [classifying, setClassifying] = useState(false);
  const [businessTypeOverride, setBusinessTypeOverride] = useState('');
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetchWithAuth('/onboarding/draft');
        const d = res.data?.data ?? {};
        setCategoryBuckets(res.data?.categoryBuckets ?? {});
        if (d.bucket) setBucket(d.bucket);
        if (d.name) setName(d.name);
        if (d.description) setDescription(d.description);
        if (d.address) setAddress(d.address);
        if (d.phone) setPhone(d.phone);
        if (d.offeredItems?.length) setOfferedItems(d.offeredItems.map((i: any) => ({ ...i, price: String(i.price) })));
        if (d.workingHours && Object.keys(d.workingHours).length) {
          setHoursPreset('CUSTOM');
          setCustomHours(d.workingHours);
        }
        if (d.fulfillment) setFulfillment(d.fulfillment);
        if (d.teamSize) setTeamSize(d.teamSize);
        if (d.paymentMethods) setPaymentMethods(d.paymentMethods);
        if (d.whatsapp) setWhatsapp(d.whatsapp);
        if (d.instagram) setInstagram(d.instagram);
        if (res.data?.step) setStep(res.data.step);
      } catch (e) {
        // Real failure loading the draft -- start fresh at step 1 rather
        // than blocking the whole page.
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const saveStep = async (stepNum: number, data: Record<string, unknown>) => {
    setSaving(true);
    setError(null);
    try {
      await fetchWithAuth('/onboarding/draft', { method: 'PATCH', data: { step: stepNum, data } });
      setStep(stepNum + 1);
    } catch (e: any) {
      setError(e?.message || 'Could not save this step. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const resolvedWorkingHours: WorkingHours =
    hoursPreset === 'EVERY_DAY' ? PRESET_EVERY_DAY : hoursPreset === 'MON_SAT' ? PRESET_MON_SAT : customHours;

  const loadClassification = async () => {
    setClassifying(true);
    setError(null);
    try {
      const res = await fetchWithAuth('/onboarding/classify', { method: 'POST' });
      setClassification(res.data);
      setBusinessTypeOverride(res.data.businessType);
    } catch (e: any) {
      setError(e?.message || 'Could not analyze your business yet.');
    } finally {
      setClassifying(false);
    }
  };

  const goToReview = async () => {
    await saveStep(6, { razorpayKeyId: razorpayKeyId || undefined, razorpayKeySecret: razorpayKeySecret || undefined });
    await loadClassification();
  };

  const handleComplete = async () => {
    setCompleting(true);
    setError(null);
    try {
      const res = await fetchWithAuth('/onboarding/complete', {
        method: 'POST',
        data: businessTypeOverride && businessTypeOverride !== classification?.businessType ? { businessTypeOverride } : {},
      });
      updateBusiness({ onboardingCompleted: true, type: res.data.businessType });
      await refreshDNA();
      await refreshAuth();
      navigate('/', { replace: true });
    } catch (e: any) {
      setError(e?.message || 'Failed to complete onboarding. Please try again.');
    } finally {
      setCompleting(false);
    }
  };

  const updateItem = (idx: number, patch: Partial<OfferedItem>) => {
    setOfferedItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  if (loading) {
    return (
      <div className="onboarding-container">
        <div className="onboarding-card"><p className="onboarding-subtitle">Loading...</p></div>
      </div>
    );
  }

  const fulfillmentOptions = FULFILLMENT_OPTIONS[bucket] ?? FULFILLMENT_OPTIONS.OTHER;

  return (
    <div className="onboarding-container">
      <div className="onboarding-card">
        <div className="onboarding-progress">
          {[1, 2, 3, 4, 5, 6, 7].map((s) => (
            <div key={s} className={`onboarding-step ${s < step ? 'completed' : s === step ? 'active' : ''}`} />
          ))}
        </div>

        {error && (
          <div className="badge badge-error p-3 w-full text-center block mb-3">{error}</div>
        )}

        {/* Step 1: Category bucket */}
        {step === 1 && (
          <div className="animate-fade-in">
            <h1 className="onboarding-title">What kind of business do you run?</h1>
            <p className="onboarding-subtitle">We'll narrow down your exact type from what you tell us next.</p>
            <div className="business-type-grid">
              {Object.entries(categoryBuckets).map(([key, b]) => (
                <div key={key} className={`business-type-card ${bucket === key ? 'selected' : ''}`} onClick={() => setBucket(key)}>
                  <div className="business-type-name">{b.label}</div>
                </div>
              ))}
            </div>
            <div className="onboarding-actions" style={{ justifyContent: 'flex-end' }}>
              <Button variant="accent" disabled={!bucket || saving} onClick={() => saveStep(1, { bucket })}>Continue →</Button>
            </div>
          </div>
        )}

        {/* Step 2: About your business */}
        {step === 2 && (
          <div className="animate-fade-in">
            <h1 className="onboarding-title">Tell us about your business</h1>
            <p className="onboarding-subtitle">This is the richest signal we use to configure everything else -- be specific.</p>
            <Input label="Business name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Glow Beauty Lounge" />
            <Textarea label="Describe your business in your own words" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. A premium unisex salon offering haircuts, styling, spa treatments..." rows={4} />
            <Input label="Address (optional)" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Shop #12, Market Complex" />
            <Input label="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" />
            <div className="onboarding-actions">
              <Button variant="ghost" onClick={() => setStep(1)}>← Back</Button>
              <Button variant="accent" disabled={!name || !description || saving} onClick={() => saveStep(2, { name, description, address, phone })}>Continue →</Button>
            </div>
          </div>
        )}

        {/* Step 3: What you offer -- becomes real catalog items */}
        {step === 3 && (
          <div className="animate-fade-in">
            <h1 className="onboarding-title">What do you offer?</h1>
            <p className="onboarding-subtitle">Add your top items -- these become your first real catalog entries, not placeholders.</p>
            {offeredItems.map((item, idx) => (
              <div key={idx} className="flex gap-2 mb-3 items-start">
                <Input placeholder="Item name" value={item.name} onChange={(e) => updateItem(idx, { name: e.target.value })} style={{ flex: 2 }} />
                <Input placeholder="Price (₹)" type="number" value={item.price} onChange={(e) => updateItem(idx, { price: e.target.value })} style={{ flex: 1 }} />
                <Button variant="ghost" onClick={() => setOfferedItems((prev) => prev.filter((_, i) => i !== idx))}>✕</Button>
              </div>
            ))}
            <Button variant="secondary" onClick={() => setOfferedItems((prev) => [...prev, { name: '', price: '' }])}>+ Add another item</Button>
            <div className="onboarding-actions">
              <Button variant="ghost" onClick={() => setStep(2)}>← Back</Button>
              <Button
                variant="accent"
                disabled={saving}
                onClick={() => {
                  const items = offeredItems.filter((i) => i.name && i.price).map((i) => ({ name: i.name, price: Number(i.price), description: i.description }));
                  saveStep(3, { offeredItems: items });
                }}
              >
                Continue →
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: How you operate */}
        {step === 4 && (
          <div className="animate-fade-in">
            <h1 className="onboarding-title">How do you operate?</h1>
            <p className="onboarding-subtitle">Working hours, fulfillment style, team size, and payments you already accept.</p>

            <label className="input-label">Working hours</label>
            <div className="flex gap-2 mb-3 flex-wrap">
              <Button variant={hoursPreset === 'EVERY_DAY' ? 'accent' : 'secondary'} onClick={() => setHoursPreset('EVERY_DAY')}>9am-9pm every day</Button>
              <Button variant={hoursPreset === 'MON_SAT' ? 'accent' : 'secondary'} onClick={() => setHoursPreset('MON_SAT')}>Mon-Sat 10am-8pm</Button>
              <Button variant={hoursPreset === 'CUSTOM' ? 'accent' : 'secondary'} onClick={() => setHoursPreset('CUSTOM')}>Custom</Button>
            </div>
            {hoursPreset === 'CUSTOM' && (
              <div className="mb-4">
                {DAYS.map((d) => (
                  <div key={d} className="flex items-center gap-2 mb-2">
                    <span style={{ width: 40 }}>{DAY_LABELS[d]}</span>
                    <input type="checkbox" checked={customHours[d] !== null} onChange={(e) => setCustomHours((prev) => ({ ...prev, [d]: e.target.checked ? { open: '09:00', close: '21:00' } : null }))} />
                    {customHours[d] && (
                      <>
                        <input className="input" type="time" value={customHours[d]!.open} onChange={(e) => setCustomHours((prev) => ({ ...prev, [d]: { ...prev[d]!, open: e.target.value } }))} style={{ width: 110 }} />
                        <span>to</span>
                        <input className="input" type="time" value={customHours[d]!.close} onChange={(e) => setCustomHours((prev) => ({ ...prev, [d]: { ...prev[d]!, close: e.target.value } }))} style={{ width: 110 }} />
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            <label className="input-label">Fulfillment</label>
            <div className="flex gap-2 mb-4 flex-wrap">
              {fulfillmentOptions.map((opt) => (
                <Button
                  key={opt.id}
                  variant={fulfillment.includes(opt.id) ? 'accent' : 'secondary'}
                  onClick={() => setFulfillment((prev) => (prev.includes(opt.id) ? prev.filter((f) => f !== opt.id) : [...prev, opt.id]))}
                >
                  {opt.label}
                </Button>
              ))}
            </div>

            <label className="input-label">Team size</label>
            <div className="flex gap-2 mb-4 flex-wrap">
              {(['SOLO', 'SMALL', 'MEDIUM', 'LARGE'] as const).map((t) => (
                <Button key={t} variant={teamSize === t ? 'accent' : 'secondary'} onClick={() => setTeamSize(t)}>
                  {t === 'SOLO' ? 'Just me' : t === 'SMALL' ? '2-5' : t === 'MEDIUM' ? '6-20' : '20+'}
                </Button>
              ))}
            </div>

            <label className="input-label">Payments you accept today</label>
            <div className="flex gap-2 mb-4 flex-wrap">
              {['cash', 'upi', 'card'].map((m) => (
                <Button key={m} variant={paymentMethods.includes(m) ? 'accent' : 'secondary'} onClick={() => setPaymentMethods((prev) => (prev.includes(m) ? prev.filter((p) => p !== m) : [...prev, m]))}>
                  {m.toUpperCase()}
                </Button>
              ))}
            </div>

            <div className="onboarding-actions">
              <Button variant="ghost" onClick={() => setStep(3)}>← Back</Button>
              <Button variant="accent" disabled={saving} onClick={() => saveStep(4, { workingHours: resolvedWorkingHours, fulfillment, teamSize, paymentMethods })}>Continue →</Button>
            </div>
          </div>
        )}

        {/* Step 5: Channels (optional) */}
        {step === 5 && (
          <div className="animate-fade-in">
            <h1 className="onboarding-title">Connect your channels</h1>
            <p className="onboarding-subtitle">Optional -- you can skip this and add it later from Settings.</p>
            <Input label="WhatsApp number" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+91 98765 43210" />
            <Input label="Instagram handle" value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@yourbusiness" />
            <div className="onboarding-actions">
              <Button variant="ghost" onClick={() => setStep(4)}>← Back</Button>
              <Button variant="accent" disabled={saving} onClick={() => saveStep(5, { whatsapp: whatsapp || undefined, instagram: instagram || undefined })}>Continue →</Button>
            </div>
          </div>
        )}

        {/* Step 6: Payments (optional, non-blocking) */}
        {step === 6 && (
          <div className="animate-fade-in">
            <h1 className="onboarding-title">Set up online payments</h1>
            <p className="onboarding-subtitle">Optional -- connect Razorpay now, or skip and accept cash/UPI at first, add this anytime from Settings.</p>
            <Input label="Razorpay Key ID" value={razorpayKeyId} onChange={(e) => setRazorpayKeyId(e.target.value)} placeholder="rzp_live_..." />
            <Input label="Razorpay Key Secret" type="password" value={razorpayKeySecret} onChange={(e) => setRazorpayKeySecret(e.target.value)} placeholder="••••••••" />
            <div className="onboarding-actions">
              <Button variant="ghost" onClick={() => setStep(5)}>← Back</Button>
              <Button variant="accent" disabled={saving || classifying} onClick={goToReview}>
                {razorpayKeyId ? 'Continue →' : 'Skip for now →'}
              </Button>
            </div>
          </div>
        )}

        {/* Step 7: Review -- the only step that writes real catalog/website/business data */}
        {step === 7 && (
          <div className="animate-fade-in">
            <h1 className="onboarding-title">Review & launch</h1>
            <p className="onboarding-subtitle">We'll set up your catalog, storefront, and operating profile from everything above.</p>

            {classifying && <p className="onboarding-subtitle">Analyzing your business...</p>}

            {classification && (
              <div className="card text-left bg-tertiary mb-4">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-success">✓</span>
                  <span>We think you run a <strong>{(categoryBuckets[bucket]?.types ?? []).includes(businessTypeOverride) ? businessTypeOverride : classification.businessType}</strong> business</span>
                </div>
                <div className="text-sm text-secondary mb-3">{classification.reasoning}</div>
                {(categoryBuckets[bucket]?.types?.length ?? 0) > 1 && (
                  <div className="mb-3">
                    <label className="input-label">Not quite right? Choose the exact type:</label>
                    <select className="input" value={businessTypeOverride} onChange={(e) => setBusinessTypeOverride(e.target.value)}>
                      {categoryBuckets[bucket]?.types.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-success">✓</span>
                  <span>Recommended plan: <strong>{classification.planRecommendation}</strong> (based on your team size and catalog)</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-success">✓</span>
                  <span>{offeredItems.filter((i) => i.name && i.price).length} catalog items ready to be created</span>
                </div>
              </div>
            )}

            <div className="onboarding-actions">
              <Button variant="ghost" onClick={() => setStep(6)}>← Back</Button>
              <Button variant="accent" size="lg" disabled={completing || classifying || !classification} isLoading={completing} onClick={handleComplete}>
                Confirm & Launch My Dashboard 🚀
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
