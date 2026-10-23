import { useState, useEffect, useRef } from 'react';
import { Settings as SettingsIcon, Building2, UserCircle, KeyRound, Upload, Plus, X, ExternalLink, Database, FileJson, FileSpreadsheet, FileText, Printer } from 'lucide-react';
import { useToast } from '../components/Toast';
import { SkeletonList, SkeletonTable, SkeletonStats, SkeletonForm, SkeletonPanels } from '../components/Skeleton';
import { apiFetch, ApiError, getApiBaseUrl } from '../lib/api';
import { todayInput } from '../lib/date';
import { useClinicAuth } from '../contexts/ClinicAuthContext';
import { publicSiteUrl } from '../lib/site-mode';
import { Button, Loading, Spinner } from '../components/Button';
import { SegmentedControl } from '../components/SegmentedControl';
import {
  DocumentComposer,
  type Vocabulary, type KindTemplate, type LetterheadField,
} from '../components/DocumentComposer';

interface Timing { day: string; opensAt?: string; closesAt?: string; closed?: boolean }
interface Highlight { title: string; description?: string }
interface Faq { question: string; answer: string }
interface Clinic {
  name: string; address: string | null; phone: string | null; email: string | null;
  registrationNumber: string | null; defaultConsultationFee: string | null;
  about: string | null; timings: Timing[] | null; services: string[] | null; logoPath: string | null;
  tagline: string | null; establishedYear: number | null;
  highlights: Highlight[] | null; faqs: Faq[] | null;
  emergencyPhone: string | null; mapUrl: string | null;
}
interface DocTemplate {
  headerMode: 'full' | 'compact' | 'none';
  topOffsetMm: number;
  accentColor: string;
  watermarkEnabled: boolean;
  watermarkText: string;
  showFooter: boolean;
  footerNote: string;
  showQty: boolean;
  showTints: boolean;
  letterhead: LetterheadField[];
  kinds: Record<string, KindTemplate>;
}
interface Profile {
  id: string; name: string; email: string; role: string;
  qualifications: string | null; specialization: string | null; bio: string | null;
  photoPath: string | null; signatureImagePath: string | null; showOnPublicPage: boolean;
  experienceYears: number | null; languages: string | null;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const ADMIN_ROLES = new Set(['DOCTOR', 'ADMIN']);

export function Settings() {
  const { user } = useClinicAuth();
  const [tab, setTab] = useState<'clinic' | 'profile' | 'security' | 'data' | 'documents'>(ADMIN_ROLES.has(user?.role ?? '') ? 'clinic' : 'profile');
  const canEditClinic = user && ADMIN_ROLES.has(user.role);

  return (
    <div className={`p-4 sm:p-6 md:p-8 ${tab === 'documents' ? 'max-w-6xl' : 'max-w-3xl'}`}>
      <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2 mb-1"><SettingsIcon size={20} className="text-muted-foreground" /> Settings</h1>
      <p className="text-sm text-muted-foreground mb-4">Clinic details, your profile, and your password.</p>

      {/* Which tabs exist depends on the role: reception can change its
          own profile and password but not the clinic's registration
          number, which prints on legal certificates. The tabs are built
          from a filtered list rather than wrapped individually in
          `canEditClinic &&`, so the keyboard order matches what is
          actually on screen. */}
      <SegmentedControl
        label="Settings section"
        className="mb-6"
        value={tab}
        onChange={setTab}
        options={[
          ...(canEditClinic ? [{ value: 'clinic' as const, label: <><Building2 size={13} /> Clinic</> }] : []),
          { value: 'profile' as const, label: <><UserCircle size={13} /> My Profile</> },
          { value: 'security' as const, label: <><KeyRound size={13} /> Password</> },
          ...(canEditClinic ? [{ value: 'documents' as const, label: <><Printer size={13} /> Documents</> }] : []),
          ...(canEditClinic ? [{ value: 'data' as const, label: <><Database size={13} /> Data & Backup</> }] : []),
        ]}
      />

      {tab === 'clinic' && canEditClinic && <ClinicSettings />}
      {tab === 'profile' && <ProfileSettings />}
      {tab === 'security' && <PasswordSettings />}
      {tab === 'documents' && canEditClinic && <DocumentSettings />}
      {tab === 'data' && canEditClinic && <DataSettings />}
    </div>
  );
}

function ClinicSettings() {
  const toast = useToast();
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [newService, setNewService] = useState('');

  useEffect(() => {
    apiFetch<Clinic>('/settings')
        .then((c) => setClinic({ ...c, timings: normalizeTimings(c.timings), services: c.services ?? [], highlights: c.highlights ?? [], faqs: c.faqs ?? [] }))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load clinic settings.'));
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clinic) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch('/settings', {
        method: 'PUT',
        data: {
          name: clinic.name,
          address: clinic.address || undefined,
          phone: clinic.phone || undefined,
          email: clinic.email || '',
          registrationNumber: clinic.registrationNumber || undefined,
          defaultConsultationFee: clinic.defaultConsultationFee ? Number(clinic.defaultConsultationFee) : undefined,
          about: clinic.about || undefined,
          timings: clinic.timings ?? undefined,
          services: clinic.services ?? undefined,
          tagline: clinic.tagline || undefined,
          // Explicit null (not undefined) so clearing the year actually
          // clears it -- undefined would be dropped and the old value kept.
          establishedYear: clinic.establishedYear ? Number(clinic.establishedYear) : null,
          highlights: (clinic.highlights ?? []).filter((h) => h.title.trim()),
          faqs: (clinic.faqs ?? []).filter((f) => f.question.trim() && f.answer.trim()),
          emergencyPhone: clinic.emergencyPhone || undefined,
          mapUrl: clinic.mapUrl || undefined,
        },
      });
      toast.success('Clinic settings saved.');
    } catch (e) {
      const message = e instanceof ApiError ? e.message : 'Failed to save.';
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const uploadLogo = async (file: File) => {
    setError(null);
    try {
      const token = localStorage.getItem('clinicAccessToken');
      const apiBase = getApiBaseUrl();
      const body = new FormData();
      body.append('file', file);
      const res = await fetch(`${apiBase}/settings/logo`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Upload failed');
      const updated = await res.json();
      setClinic((c) => (c ? { ...c, logoPath: updated.logoPath } : c));
    } catch (e: any) {
      setError(e?.message || 'Upload failed.');
    }
  };

  if (!clinic) return error ? <div className="text-muted-foreground/70 text-sm">{error}</div> : <SkeletonForm fields={8} label="Loading clinic settings" />;

  const setField = (patch: Partial<Clinic>) => setClinic({ ...clinic, ...patch });
  const timings = clinic.timings ?? [];

  return (
    <form onSubmit={save} className="flex flex-col gap-5">
      {error && <div className="px-3 py-2 rounded-lg tone-danger text-sm">{error}</div>}

      <Section title="Clinic Details" hint="Appears on every prescription, certificate, and invoice you print.">
        <div className="grid md:grid-cols-2 gap-3">
          <Field label="Clinic name"><input value={clinic.name} onChange={(e) => setField({ name: e.target.value })} required className={inputCls} /></Field>
          <Field label="Phone"><input value={clinic.phone ?? ''} onChange={(e) => setField({ phone: e.target.value })} className={inputCls} /></Field>
          <Field label="Email"><input type="email" value={clinic.email ?? ''} onChange={(e) => setField({ email: e.target.value })} className={inputCls} /></Field>
          <Field label="Registration number"><input value={clinic.registrationNumber ?? ''} onChange={(e) => setField({ registrationNumber: e.target.value })} className={inputCls} /></Field>
          <Field label="Address" span><textarea value={clinic.address ?? ''} onChange={(e) => setField({ address: e.target.value })} rows={2} className={inputCls} /></Field>
          <Field label="Default consultation fee (₹)" hint="Auto-added as the first line item on a new bill.">
            <input type="number" step="0.01" value={clinic.defaultConsultationFee ?? ''} onChange={(e) => setField({ defaultConsultationFee: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Clinic logo">
            <div className="flex items-center gap-2">
              {clinic.logoPath && <img src={brandingUrl(clinic.logoPath)} alt="" className="h-9 w-9 rounded object-cover border border-border/10" />}
              <label className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-foreground/10 text-xs hover:bg-foreground/20 cursor-pointer">
                <Upload size={11} /> {clinic.logoPath ? 'Replace' : 'Upload'}
                <input type="file" accept=".png,.jpg,.jpeg" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo(f); e.target.value = ''; }} />
              </label>
            </div>
          </Field>
        </div>
      </Section>

      <Section title="Public Website" hint="Your clinic's public site at /clinic. Every section below only appears once you fill it in — nothing is invented for you.">
        <div className="grid md:grid-cols-2 gap-3 mb-3">
          <Field label="Tagline" hint="One line under the clinic name, e.g. “Family healthcare in Pune since 2009.”" span>
            <input value={clinic.tagline ?? ''} onChange={(e) => setField({ tagline: e.target.value })} maxLength={200} className={inputCls} />
          </Field>
          <Field label="Established year" hint="Shown as a “serving since” trust signal.">
            <input type="number" min={1800} max={2100} value={clinic.establishedYear ?? ''} onChange={(e) => setField({ establishedYear: e.target.value ? Number(e.target.value) : null })} className={inputCls} />
          </Field>
          <Field label="Emergency phone" hint="Highlighted separately from the main number.">
            <input value={clinic.emergencyPhone ?? ''} onChange={(e) => setField({ emergencyPhone: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Google Maps link" hint="Powers the “Get directions” button." span>
            <input value={clinic.mapUrl ?? ''} onChange={(e) => setField({ mapUrl: e.target.value })} placeholder="https://maps.app.goo.gl/..." className={inputCls} />
          </Field>
        </div>

        <Field label="About the clinic" span>
          <textarea value={clinic.about ?? ''} onChange={(e) => setField({ about: e.target.value })} rows={3} placeholder="A short introduction patients will read." className={inputCls} />
        </Field>

        <div className="mt-3">
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Services offered</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {(clinic.services ?? []).map((s, i) => (
              <span key={i} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-foreground/10 text-xs">
                {s}
                <button type="button" onClick={() => setField({ services: (clinic.services ?? []).filter((_, idx) => idx !== i) })} className="text-muted-foreground/70 hover:text-ink-danger"><X size={10} /></button>
              </span>
            ))}
            {(clinic.services ?? []).length === 0 && <span className="text-xs text-muted-foreground/60">None added yet.</span>}
          </div>
          <div className="flex gap-2">
            <input
              value={newService}
              onChange={(e) => setNewService(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (newService.trim()) { setField({ services: [...(clinic.services ?? []), newService.trim()] }); setNewService(''); }
                }
              }}
              placeholder="e.g. General Consultation"
              className={`${inputCls} flex-1`}
            />
            <button type="button" onClick={() => { if (newService.trim()) { setField({ services: [...(clinic.services ?? []), newService.trim()] }); setNewService(''); } }} className="flex items-center gap-1 px-3 py-2 rounded-lg bg-foreground/10 text-xs hover:bg-foreground/20">
              <Plus size={12} /> Add
            </button>
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Opening hours</label>
          <div className="flex flex-col gap-1.5">
            {timings.map((t, i) => (
              /*
               * The day, the Open switch, and the two times.
               *
               * This was one non-wrapping row and it was the only screen in
               * the portal that overflowed a phone: a 390px viewport scrolled
               * to 420px, because 80px of day label plus the checkbox plus
               * two 108px time inputs do not fit in the ~358px a phone
               * leaves after padding. Measured, not guessed -- the closing
               * time input started at 311px and was 108px wide.
               *
               * So the times wrap onto their own line below `sm` and share
               * it, and the desktop layout is untouched above it.
               */
              <div key={t.day} className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground w-20 shrink-0">{t.day}</span>
                <label className="flex items-center gap-1 text-xs text-muted-foreground/70">
                  <input
                    type="checkbox"
                    checked={!t.closed}
                    onChange={(e) => {
                      const next = [...timings];
                      next[i] = { ...t, closed: !e.target.checked };
                      setField({ timings: next });
                    }}
                  />
                  Open
                </label>
                {!t.closed && (
                  // Grouped so the pair wraps together: a closing time on a
                  // line of its own, away from its "to", reads as a second
                  // opening time.
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <input type="time" value={t.opensAt ?? ''} onChange={(e) => { const next = [...timings]; next[i] = { ...t, opensAt: e.target.value }; setField({ timings: next }); }} className="px-2 py-1 rounded-lg bg-foreground/5 border border-border/10 text-xs outline-none flex-1 min-w-0 sm:flex-none" />
                    <span className="text-xs text-muted-foreground/60 shrink-0">to</span>
                    <input type="time" value={t.closesAt ?? ''} onChange={(e) => { const next = [...timings]; next[i] = { ...t, closesAt: e.target.value }; setField({ timings: next }); }} className="px-2 py-1 rounded-lg bg-foreground/5 border border-border/10 text-xs outline-none flex-1 min-w-0 sm:flex-none" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5">
          <label className="block text-xs font-medium text-muted-foreground mb-0.5">Why patients choose us</label>
          <p className="text-[11px] text-muted-foreground/60 mb-2">Up to 8 genuine strengths — short waiting times, on-site pharmacy, evening hours. Write what's actually true of this clinic.</p>
          <div className="flex flex-col gap-2">
            {(clinic.highlights ?? []).map((h, i) => (
              <div key={i} className="flex gap-2 items-start">
                <div className="flex-1 grid gap-1.5">
                  <input value={h.title} onChange={(e) => setField({ highlights: replaceAt(clinic.highlights ?? [], i, { ...h, title: e.target.value }) })} placeholder="Title" maxLength={100} className={inputCls} />
                  <input value={h.description ?? ''} onChange={(e) => setField({ highlights: replaceAt(clinic.highlights ?? [], i, { ...h, description: e.target.value }) })} placeholder="One line of detail (optional)" maxLength={300} className={inputCls} />
                </div>
                <button type="button" onClick={() => setField({ highlights: (clinic.highlights ?? []).filter((_, idx) => idx !== i) })} className="p-2 text-muted-foreground/70 hover:text-ink-danger" aria-label="Remove highlight"><X size={13} /></button>
              </div>
            ))}
          </div>
          {(clinic.highlights ?? []).length < 8 && (
            <button type="button" onClick={() => setField({ highlights: [...(clinic.highlights ?? []), { title: '', description: '' }] })} className="flex items-center gap-1 px-3 py-1.5 mt-2 rounded-lg bg-foreground/10 text-xs hover:bg-foreground/20">
              <Plus size={12} /> Add point
            </button>
          )}
        </div>

        <div className="mt-5">
          <label className="block text-xs font-medium text-muted-foreground mb-0.5">Frequently asked questions</label>
          <p className="text-[11px] text-muted-foreground/60 mb-2">The questions reception answers on the phone all day — do you take walk-ins, is parking available, which insurance.</p>
          <div className="flex flex-col gap-2">
            {(clinic.faqs ?? []).map((f, i) => (
              <div key={i} className="flex gap-2 items-start">
                <div className="flex-1 grid gap-1.5">
                  <input value={f.question} onChange={(e) => setField({ faqs: replaceAt(clinic.faqs ?? [], i, { ...f, question: e.target.value }) })} placeholder="Question" maxLength={200} className={inputCls} />
                  <textarea value={f.answer} onChange={(e) => setField({ faqs: replaceAt(clinic.faqs ?? [], i, { ...f, answer: e.target.value }) })} placeholder="Answer" rows={2} maxLength={1000} className={inputCls} />
                </div>
                <button type="button" onClick={() => setField({ faqs: (clinic.faqs ?? []).filter((_, idx) => idx !== i) })} className="p-2 text-muted-foreground/70 hover:text-ink-danger" aria-label="Remove question"><X size={13} /></button>
              </div>
            ))}
          </div>
          {(clinic.faqs ?? []).length < 12 && (
            <button type="button" onClick={() => setField({ faqs: [...(clinic.faqs ?? []), { question: '', answer: '' }] })} className="flex items-center gap-1 px-3 py-1.5 mt-2 rounded-lg bg-foreground/10 text-xs hover:bg-foreground/20">
              <Plus size={12} /> Add question
            </button>
          )}
        </div>

        <a href={publicSiteUrl('/')} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-ink-success hover:underline mt-5">
          <ExternalLink size={11} /> Preview public website
        </a>
      </Section>

      <button type="submit" disabled={saving} className="self-start px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">
        {saving ? 'Saving...' : 'Save Clinic Settings'}
      </button>
    </form>
  );
}

function ProfileSettings() {
  const toast = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<Profile>('/profile').then(setProfile).catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load profile.'));
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch('/profile', {
        method: 'PUT',
        data: {
          name: profile.name,
          qualifications: profile.qualifications || undefined,
          specialization: profile.specialization || undefined,
          bio: profile.bio || undefined,
          showOnPublicPage: profile.showOnPublicPage,
          experienceYears: profile.experienceYears ? Number(profile.experienceYears) : null,
          languages: profile.languages || undefined,
        },
      });
      toast.success('Profile saved.');
    } catch (e) {
      const message = e instanceof ApiError ? e.message : 'Failed to save.';
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const upload = async (kind: 'signature' | 'photo', file: File) => {
    setError(null);
    try {
      const token = localStorage.getItem('clinicAccessToken');
      const apiBase = getApiBaseUrl();
      const body = new FormData();
      body.append('file', file);
      const res = await fetch(`${apiBase}/profile/${kind}`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Upload failed');
      const updated = await res.json();
      setProfile((p) => (p ? { ...p, ...updated } : p));
    } catch (e: any) {
      setError(e?.message || 'Upload failed.');
    }
  };

  if (!profile) return error ? <div className="text-muted-foreground/70 text-sm">{error}</div> : <SkeletonForm fields={6} label="Loading your profile" />;
  const isDoctor = profile.role === 'DOCTOR';

  return (
    <form onSubmit={save} className="flex flex-col gap-5">
      {error && <div className="px-3 py-2 rounded-lg tone-danger text-sm">{error}</div>}

      <Section title="My Profile" hint={isDoctor ? 'Prints on the prescriptions and certificates you sign.' : 'Your name as it appears across the portal.'}>
        <div className="grid md:grid-cols-2 gap-3">
          <Field label="Name"><input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} required className={inputCls} /></Field>
          <Field label="Email (sign-in)"><input value={profile.email} disabled className={`${inputCls} opacity-60`} /></Field>
          {isDoctor && (
            <>
              <Field label="Qualifications" hint="e.g. MBBS, MD (Medicine)"><input value={profile.qualifications ?? ''} onChange={(e) => setProfile({ ...profile, qualifications: e.target.value })} className={inputCls} /></Field>
              <Field label="Specialization"><input value={profile.specialization ?? ''} onChange={(e) => setProfile({ ...profile, specialization: e.target.value })} className={inputCls} /></Field>
              {/* Years in practice and languages spoken are two of the strongest
                  trust signals on a doctor's public bio -- a patient deciding
                  who to see looks for both. */}
              <Field label="Years of experience">
                <input type="number" min={0} max={80} value={profile.experienceYears ?? ''} onChange={(e) => setProfile({ ...profile, experienceYears: e.target.value ? Number(e.target.value) : null })} className={inputCls} />
              </Field>
              <Field label="Languages spoken" hint="e.g. English, Hindi, Marathi">
                <input value={profile.languages ?? ''} onChange={(e) => setProfile({ ...profile, languages: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Short bio" hint="Two or three sentences patients will read on the public site." span><textarea value={profile.bio ?? ''} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} rows={3} className={inputCls} /></Field>
            </>
          )}
        </div>
      </Section>

      {isDoctor && (
        <Section title="Signature & Photo" hint="Your signature is stamped onto prescriptions and certificates you generate.">
          <div className="flex flex-wrap gap-6">
            <div>
              <div className="text-xs text-muted-foreground mb-1.5">Signature</div>
              {/* The signature image keeps bg-white deliberately rather than a
                  token: a signature is black ink on a transparent PNG, and on
                  the dark ground it would be invisible. */}
              {profile.signatureImagePath
                ? <img src={brandingUrl(profile.signatureImagePath)} alt="" className="h-12 bg-white rounded px-2 mb-2 object-contain" />
                : <div className="text-xs text-muted-foreground/60 mb-2">Not uploaded — documents print a blank signature line.</div>}
              <label className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-foreground/10 text-xs hover:bg-foreground/20 cursor-pointer w-fit">
                <Upload size={11} /> {profile.signatureImagePath ? 'Replace' : 'Upload'}
                <input type="file" accept=".png,.jpg,.jpeg" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload('signature', f); e.target.value = ''; }} />
              </label>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1.5">Photo (public page)</div>
              {profile.photoPath
                ? <img src={brandingUrl(profile.photoPath)} alt="" className="h-16 w-16 rounded-full object-cover mb-2 border border-border/10" />
                : <div className="text-xs text-muted-foreground/60 mb-2">No photo.</div>}
              <label className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-foreground/10 text-xs hover:bg-foreground/20 cursor-pointer w-fit">
                <Upload size={11} /> {profile.photoPath ? 'Replace' : 'Upload'}
                <input type="file" accept=".png,.jpg,.jpeg" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload('photo', f); e.target.value = ''; }} />
              </label>
            </div>
          </div>
          <label className="flex items-center gap-2 mt-4 text-xs text-muted-foreground">
            <input type="checkbox" checked={profile.showOnPublicPage} onChange={(e) => setProfile({ ...profile, showOnPublicPage: e.target.checked })} />
            Show me on the public clinic page
          </label>
        </Section>
      )}

      <button type="submit" disabled={saving} className="self-start px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">
        {saving ? 'Saving...' : 'Save Profile'}
      </button>
    </form>
  );
}

function PasswordSettings() {
  const toast = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirm) {
      setError('New passwords do not match.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiFetch('/profile/password', { method: 'POST', data: { currentPassword, newPassword } });
      setCurrentPassword('');
      setNewPassword('');
      setConfirm('');
      toast.success('Password changed.');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to change password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      {error && <div className="px-3 py-2 rounded-lg tone-danger text-sm">{error}</div>}
      <Section title="Change Password" hint="You'll stay signed in on this device.">
        <div className="grid md:grid-cols-2 gap-3">
          <Field label="Current password" span><input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required className={inputCls} /></Field>
          <Field label="New password" hint="At least 6 characters."><input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} className={inputCls} /></Field>
          <Field label="Confirm new password"><input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required className={inputCls} /></Field>
        </div>
      </Section>
      <button type="submit" disabled={saving} className="self-start px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">
        {saving ? 'Saving...' : 'Change Password'}
      </button>
    </form>
  );
}

/**
 * Data export. Two separate reasons this exists: the clinic owns its own
 * records and must never be locked into this product, and the DPDP Act
 * gives patients a right to the personal data held about them.
 */
function DataSettings() {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // A plain <a href> can't send the Authorization header these routes
  // require, so the file is fetched and handed to the browser as a blob.
  const download = async (path: string, filename: string, key: string) => {
    setBusy(key);
    setError(null);
    try {
      const token = localStorage.getItem('clinicAccessToken');
      const apiBase = getApiBaseUrl();
      const res = await fetch(`${apiBase}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) throw new Error('Export failed. You may not have permission.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e?.message || 'Export failed.');
    } finally {
      setBusy(null);
    }
  };

  // Local, not UTC: an export taken before 5:30am IST was named with
  // yesterday's date, which is a confusing thing to find on a backup.
  const today = todayInput();
  const tables = [
    { key: 'patients', label: 'Patients' },
    { key: 'appointments', label: 'Appointments' },
    { key: 'invoices', label: 'Invoices' },
    { key: 'expenses', label: 'Expenses' },
    { key: 'audit', label: 'Audit log' },
  ];

  return (
    <div className="flex flex-col gap-5">
      {error && <div className="px-3 py-2 rounded-lg tone-danger text-sm">{error}</div>}

      <Section title="Full Backup" hint="Everything in the system as one JSON file. Take one regularly and keep it somewhere safe.">
        <button
          onClick={() => download('/export/full', `clinic-backup-${today}.json`, 'full')}
          disabled={busy === 'full'}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
        >
          <FileJson size={15} /> {busy === 'full' ? 'Preparing…' : 'Download Full Backup'}
        </button>
        <p className="text-[11px] text-muted-foreground/60 mt-3 leading-relaxed">
          Uploaded files — scan attachments, X-rays and lab reports — are stored on the server's disk and are
          <strong className="text-muted-foreground"> not</strong> inside this JSON. Back up the server's <code className="text-muted-foreground">uploads/</code> folder
          alongside it, or the backup is incomplete.
        </p>
      </Section>

      <Section title="Spreadsheet Exports" hint="Individual tables as CSV — for your accountant, or to open in Excel.">
        <div className="flex flex-wrap gap-2">
          {tables.map((t) => (
            <button
              key={t.key}
              onClick={() => download(`/export/csv/${t.key}`, `${t.key}-${today}.csv`, t.key)}
              disabled={busy === t.key}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-foreground/10 text-xs hover:bg-foreground/20 disabled:opacity-50"
            >
              <FileSpreadsheet size={12} /> {busy === t.key ? 'Preparing…' : t.label}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Your Data, Your Records" hint="Why this page exists.">
        <ul className="text-xs text-muted-foreground leading-relaxed list-disc pl-4 flex flex-col gap-1.5">
          <li>These records belong to the clinic, not to this software. You can take them with you at any time.</li>
          <li>
            A patient can ask for a copy of the data held about them. Use{' '}
            <span className="text-foreground/80">Download Report</span> on their patient page for a readable PDF, or the
            patients CSV above for the raw data.
          </li>
          <li>Every export is itself recorded in the audit log, including who ran it and when.</li>
        </ul>
      </Section>
    </div>
  );
}

/**
 * Printed-document template with a live preview.
 *
 * The preview re-renders automatically as settings change rather than
 * waiting for a button, because the whole point of these controls is
 * visual and describing "compact letterhead" in words is a poor substitute
 * for showing it. Debounced, so dragging the offset slider fires one
 * render at the end rather than one per pixel.
 *
 * It renders through exactly the same code path as a real prescription --
 * a preview drawn by a separate routine would be free to disagree with
 * reality, which is the one thing a preview must never do.
 */
function DocumentSettings() {
  const toast = useToast();
  const [template, setTemplate] = useState<DocTemplate | null>(null);
  const [accents, setAccents] = useState<{ key: string; label: string; ink: string }[]>([]);
  // What the renderer can actually draw. Served by the API rather than
  // duplicated here: a block this frontend offers but the renderer does
  // not know would be a setting that silently does nothing.
  const [vocabulary, setVocabulary] = useState<Vocabulary | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    apiFetch<{
      template: DocTemplate;
      accents: { key: string; label: string; ink: string }[];
      vocabulary: Vocabulary;
    }>('/document-template')
      .then((r) => { setTemplate(r.template); setAccents(r.accents); setVocabulary(r.vocabulary ?? null); })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load the document template.'));
  }, []);

  // Keeps the newest blob URL so it can be revoked when replaced. A blob
  // URL is a live handle to memory; dropping one without revoking leaks it
  // for the lifetime of the tab, and this re-renders on every keystroke.
  const previewUrlRef = useRef<string | null>(null);
  useEffect(() => {
    previewUrlRef.current = previewUrl;
  }, [previewUrl]);
  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  // Debounced live render. The abort controller matters: dragging the
  // slider can outrun the server, and without it a slow earlier response
  // can land after a newer one and show the wrong page.
  useEffect(() => {
    if (!template) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setRendering(true);
      try {
        const token = localStorage.getItem('clinicAccessToken');
        const apiBase = getApiBaseUrl();
        const res = await fetch(`${apiBase}/document-template/preview`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify(template),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error('Could not render the preview.');
        const blob = await res.blob();
        if (controller.signal.aborted) return;
        const next = URL.createObjectURL(blob);
        if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
        setPreviewUrl(next);
        setError(null);
      } catch (e: any) {
        if (e?.name !== 'AbortError') setError(e?.message || 'Could not render the preview.');
      } finally {
        if (!controller.signal.aborted) setRendering(false);
      }
    }, 400);

    return () => { clearTimeout(timer); controller.abort(); };
  }, [template]);

  const set = (patch: Partial<DocTemplate>) => {
    setDirty(true);
    setTemplate((t) => (t ? { ...t, ...patch } : t));
  };

  const save = async () => {
    if (!template) return;
    setError(null);
    try {
      await apiFetch('/document-template', { method: 'PUT', data: template });
      setDirty(false);
      toast.success('Template saved. New documents use it.');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save.');
      throw e;
    }
  };

  if (!template) return <Loading label={error || 'Loading…'} />;

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] gap-6 items-start">
      {/* ── Controls ──────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-5 min-w-0">
        {error && <div className="px-3 py-2 rounded-lg tone-danger text-sm">{error}</div>}

        <p className="text-xs text-muted-foreground/70 leading-relaxed">
          Applies to every document you print — prescriptions, certificates, invoices and patient reports.
          The preview updates as you change things.
        </p>

        {vocabulary && (
          <Section
            title="What each document contains"
            hint="Reorder, rename or hide any section; add your own. The preview updates as you go."
          >
            <DocumentComposer
              letterhead={template.letterhead ?? []}
              kinds={template.kinds ?? {}}
              vocabulary={vocabulary}
              onChange={(patch) => set(patch)}
            />
          </Section>
        )}

        <Section title="Letterhead" hint="How the top of each page is printed.">
          <div className="flex flex-col gap-2">
            {([
              ['full', 'Full letterhead', 'Logo, clinic name, address, phone and registration number.'],
              ['compact', 'Compact', 'Smaller logo and clinic name only — leaves more room for content.'],
              ['none', 'Pre-printed stationery', 'Prints nothing at the top. Use this if you already have letterhead paper — otherwise the software prints over it.'],
            ] as const).map(([key, label, hint]) => (
              <label key={key} className={`flex gap-3 p-3 rounded-lg border cursor-pointer ${template.headerMode === key ? 'border-ink-success bg-ink-success/5' : 'border-border/10 bg-foreground/[0.02]'}`}>
                <input type="radio" name="headerMode" checked={template.headerMode === key} onChange={() => set({ headerMode: key })} className="mt-0.5 accent-ink-success" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{label}</span>
                  <span className="block text-[11px] text-muted-foreground/70 leading-relaxed">{hint}</span>
                </span>
              </label>
            ))}
          </div>

          {template.headerMode === 'none' && (
            <div className="mt-3">
              <label className="block text-xs text-muted-foreground mb-1">
                Blank space at the top: <span className="text-foreground font-medium">{template.topOffsetMm} mm</span>
              </label>
              <input
                type="range" min={0} max={120} step={1}
                value={template.topOffsetMm}
                onChange={(e) => set({ topOffsetMm: Number(e.target.value) })}
                className="w-full accent-ink-success"
              />
              <p className="text-[11px] text-muted-foreground/60 mt-1">
                Measure your printed letterhead from the top of the page to where your content should begin.
              </p>
            </div>
          )}
        </Section>

        <Section title="Accent colour" hint="Headings, the letterhead rule and table headers. Each option is contrast-checked so it stays readable on a photocopy.">
          <div className="flex flex-wrap gap-2">
            {accents.map((a) => (
              <button
                key={a.key}
                type="button"
                onClick={() => set({ accentColor: a.key })}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${template.accentColor === a.key ? 'border-ink-success bg-ink-success/10' : 'border-border/10 bg-foreground/[0.02]'}`}
              >
                <span className="h-4 w-4 rounded-full border border-border/20" style={{ background: a.ink }} />
                {a.label}
              </button>
            ))}
          </div>
        </Section>

        <Section title="Watermark" hint="Printed faintly behind the page — useful for marking duplicates or drafts.">
          <label className="flex items-center gap-2 text-sm text-foreground/80 mb-3">
            <input type="checkbox" checked={template.watermarkEnabled} onChange={(e) => set({ watermarkEnabled: e.target.checked })} className="accent-ink-success" />
            Print a watermark
          </label>
          {template.watermarkEnabled && (
            <input value={template.watermarkText} onChange={(e) => set({ watermarkText: e.target.value })} maxLength={40} placeholder="e.g. Duplicate Copy" className={inputCls} />
          )}
        </Section>

        <Section title="Details" hint="">
          <div className="flex flex-col gap-2.5">
            <Toggle label="Shaded table headers and row banding" hint="Turn off for a plainer, more ink-frugal document." checked={template.showTints} onChange={(v) => set({ showTints: v })} />
            <Toggle label="Page footer" hint="Clinic name, generated date and page numbers." checked={template.showFooter} onChange={(v) => set({ showFooter: v })} />
            <Toggle label="Quantity column on prescriptions" hint="A computed estimate. Turn off if your pharmacy dispenses by strip." checked={template.showQty} onChange={(v) => set({ showQty: v })} />
          </div>
          <div className="mt-3">
            <label className="block text-xs text-muted-foreground mb-1">Footer note (optional)</label>
            <input value={template.footerNote} onChange={(e) => set({ footerNote: e.target.value })} maxLength={200} placeholder="e.g. Not valid for medico-legal purposes" className={inputCls} />
          </div>
        </Section>
      </div>

      {/* ── Live preview ──────────────────────────────────────────────── */}
      <div className="lg:sticky lg:top-6 flex flex-col gap-3 min-w-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <FileText size={13} />
            Live preview
            {rendering && <Spinner size={11} className="text-ink-success" />}
            {dirty && !rendering && <span className="text-ink-warning">· unsaved</span>}
          </div>
          <div className="flex items-center gap-2">
            {previewUrl && (
              <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-foreground/10 text-xs hover:bg-foreground/20">
                <ExternalLink size={11} /> Full size
              </a>
            )}
            <Button variant="primary" size="sm" onClick={save} busyLabel="Saving…" disabled={!dirty}>
              {dirty ? 'Save Template' : 'Saved'}
            </Button>
          </div>
        </div>

        {/* Sits on a grey ground with a drop shadow so it reads as a sheet
            of paper rather than a panel of the app -- this is the one place
            in the portal showing something that will be physically printed,
            and the distinction is worth making. */}
        <div className="rounded-xl border border-border/10 bg-[#2a2e37] p-4 relative">
          {rendering && (
            <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
              <span className="px-2.5 py-1.5 rounded-lg bg-black/70 flex items-center gap-2 text-[11px] text-foreground">
                <Spinner size={11} /> Updating
              </span>
            </div>
          )}
          {previewUrl ? (
            <iframe
              src={`${previewUrl}#toolbar=0&navpanes=0&view=FitH`}
              title="Document preview"
              className="w-full h-[660px] border-0 rounded-sm bg-white shadow-2xl"
              style={{ aspectRatio: '210 / 297' }}
            />
          ) : (
            <div className="h-[660px] rounded-sm bg-white flex items-center justify-center text-slate-500 text-sm shadow-overlay">
              Rendering…
            </div>
          )}
        </div>

        <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
          A sample prescription with fictional patient details, rendered by the same code that prints your
          real documents.
        </p>
      </div>
    </div>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex gap-2.5 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 accent-ink-success" />
      <span className="min-w-0">
        <span className="block text-sm text-foreground">{label}</span>
        {hint && <span className="block text-[11px] text-muted-foreground/70 leading-relaxed">{hint}</span>}
      </span>
    </label>
  );
}

const inputCls = 'w-full px-3 py-2 rounded-lg bg-foreground/5 border border-border/10 text-sm outline-none focus:border-primary';

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="p-4 rounded-xl border border-border/10 bg-foreground/[0.02]">
      <h2 className="text-sm font-semibold">{title}</h2>
      {hint && <p className="text-xs text-muted-foreground/70 mb-3">{hint}</p>}
      {children}
    </div>
  );
}

function Field({ label, hint, span, children }: { label: string; hint?: string; span?: boolean; children: React.ReactNode }) {
  return (
    <div className={span ? 'md:col-span-2' : ''}>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground/60 mt-1">{hint}</p>}
    </div>
  );
}

export function brandingUrl(storagePath: string): string {
  const apiBase = getApiBaseUrl();
  return `${apiBase}/public/${storagePath}`;
}

/** Immutable single-item replace for the highlight/FAQ repeaters. Mutating
 * the array in place wouldn't change its identity, so React wouldn't
 * re-render and typing into a row would look frozen. */
function replaceAt<T>(list: T[], index: number, value: T): T[] {
  return list.map((item, i) => (i === index ? value : item));
}

/** Always show all seven days in a stable order, merging in whatever was saved. */
function normalizeTimings(saved: Timing[] | null): Timing[] {
  const byDay = new Map((saved ?? []).map((t) => [t.day, t]));
  return DAYS.map((day) => byDay.get(day) ?? { day, opensAt: '09:00', closesAt: '18:00', closed: day === 'Sunday' });
}
