import { useState, useEffect, useCallback, useRef } from 'react';
import {
  LayoutTemplate, Eye, EyeOff, ChevronUp, ChevronDown, ExternalLink, Palette,
  Image as ImageIcon, Upload, Trash2, Plus, X, FileText, Star, AlertTriangle, Check, Sparkles,
} from 'lucide-react';
import { useToast } from '../components/Toast';
import { apiFetch, ApiError } from '../lib/api';
import { brandingUrl } from './Settings';
import { publicSiteUrl } from '../lib/site-mode';
import { Button, Loading, Spinner } from '../components/Button';
import { DeviceFrame } from '../components/DeviceFrame';
import { SegmentedControl } from '../components/SegmentedControl';

/**
 * The clinic admin's control over their own public website: which sections
 * appear and in what order, the colour theme, the hero image, a health
 * blog, a photo gallery, and patient feedback.
 */

type SectionKey = 'about' | 'services' | 'highlights' | 'doctors' | 'gallery' | 'blog' | 'feedback' | 'queue' | 'faq' | 'contact';
interface Section { key: SectionKey; enabled: boolean }

const SECTION_LABELS: Record<SectionKey, { label: string; hint: string }> = {
  about: { label: 'About the clinic', hint: 'Your introduction. Edited in Settings → Public Website.' },
  services: { label: 'Services', hint: 'What you treat.' },
  highlights: { label: 'Why patients choose us', hint: 'Your strongest points.' },
  doctors: { label: 'Doctors', hint: 'Profiles of doctors who opted in.' },
  gallery: { label: 'Photo gallery', hint: 'Photos of the clinic, managed below.' },
  blog: { label: 'Health articles', hint: 'Your published articles.' },
  feedback: { label: 'Patient feedback', hint: 'Only feedback you explicitly publish.' },
  queue: { label: 'Live queue promo', hint: 'Invites patients to check the waiting time.' },
  faq: { label: 'FAQ', hint: 'Common questions. Edited in Settings.' },
  contact: { label: 'Contact & map', hint: 'Address, phone, directions.' },
};

const ALL_KEYS = Object.keys(SECTION_LABELS) as SectionKey[];

const THEMES: { key: string; label: string; swatch: string }[] = [
  { key: 'teal', label: 'Teal', swatch: '#0d9488' },
  { key: 'blue', label: 'Blue', swatch: '#2563eb' },
  { key: 'green', label: 'Green', swatch: '#16a34a' },
  { key: 'indigo', label: 'Indigo', swatch: '#4f46e5' },
  { key: 'rose', label: 'Rose', swatch: '#e11d48' },
  { key: 'slate', label: 'Slate', swatch: '#475569' },
];

export function Website() {
  const [tab, setTab] = useState<'layout' | 'languages' | 'blog' | 'gallery' | 'feedback'>('layout');

  // Layout and Gallery are side-by-side editors and want the window;
  // the others are forms, where a long measure hurts readability.
  const wide = tab === 'layout' || tab === 'gallery';

  return (
    <div className={`p-4 sm:p-6 md:p-8 ${wide ? 'max-w-[1600px]' : 'max-w-4xl'}`}>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-1">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <LayoutTemplate size={20} className="text-emerald-400" /> Website
        </h1>
        <a href={publicSiteUrl('/')} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground/10 text-xs hover:bg-foreground/20">
          <ExternalLink size={12} /> View live site
        </a>
      </div>
      <p className="text-sm text-muted-foreground mb-5">Control what patients see on your public page.</p>

      <SegmentedControl
        label="Website section"
        className="mb-6"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'layout', label: 'Layout & Theme' },
          { value: 'languages', label: 'Languages' },
          { value: 'blog', label: 'Health Articles' },
          { value: 'gallery', label: 'Photo Gallery' },
          { value: 'feedback', label: 'Patient Feedback' },
        ]}
      />

      {tab === 'layout' && <LayoutBuilder />}
      {tab === 'languages' && <LanguageManager />}
      {tab === 'blog' && <BlogManager />}
      {tab === 'gallery' && <GalleryManager />}
      {tab === 'feedback' && <FeedbackManager />}
    </div>
  );
}

/* ── Languages ─────────────────────────────────────────────────────────── */

interface LocaleInfo { code: string; englishName: string; nativeName: string }
interface TranslationStatus {
  provider: string | null; autoTranslateAvailable: boolean;
  supportedLocales: LocaleInfo[]; defaultLocale: string; enabledLocales: string[];
  unavailableReason?: string | null; autoTranslatableNamespaces?: string[]; maxItemsPerRun?: number;
  progress: { locale: string; total: number; reviewed: number }[];
}
interface TransItem {
  namespace: string; entityId: string; field: string;
  sourceText: string; translatedText: string; isReviewed: boolean; isStale: boolean;
}

/**
 * Regional languages for the public site.
 *
 * The clinic writes everything in English once. Each enabled language gets
 * a stored translated copy -- drafted by the machine translator if one is
 * configured, or typed in by hand, which works with no API key at all.
 *
 * Translation runs ONCE, here, on demand. A patient loading the page in
 * Marathi costs nothing and waits for no API: the page reads stored rows.
 */
function LanguageManager() {
  const [status, setStatus] = useState<TranslationStatus | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setStatus(await apiFetch<TranslationStatus>('/translations/status')); }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Could not load language settings.'); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const saveLocales = async (enabledLocales: string[], defaultLocale?: string) => {
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/translations/locales', { method: 'PUT', data: { enabledLocales, ...(defaultLocale ? { defaultLocale } : {}) } });
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save.');
    } finally { setBusy(false); }
  };

  if (!status) return <div className="text-muted-foreground/70 text-sm">{error || 'Loading…'}</div>;
  if (editing) return <TranslationEditor locale={editing} status={status} onBack={() => { setEditing(null); load(); }} />;

  const enabled = status.enabledLocales;
  const toggle = (code: string) =>
    saveLocales(enabled.includes(code) ? enabled.filter((c) => c !== code) : [...enabled, code]);

  return (
    <div className="flex flex-col gap-5">
      {error && <div className="px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-sm">{error}</div>}

      <Panel title="How this works" hint="">
        <ul className="text-xs text-muted-foreground leading-relaxed list-disc pl-4 flex flex-col gap-1.5">
          <li>You write everything in <strong className="text-foreground/80">English</strong>, once, as you already do.</li>
          <li>Turn on the languages your patients speak, then translate. Translation runs <strong className="text-foreground/80">once</strong> and is saved — patients never wait for it, and it costs nothing to serve.</li>
          <li>
            {status.autoTranslateAvailable
              ? <>Automatic translation is available on this deployment via <span className="text-foreground/80">{status.provider}</span>. Treat its output as a <strong className="text-foreground/80">first draft</strong> and check it before relying on it.</>
              : <>Automatic translation isn't set up here, so translations are typed in by hand below — which works perfectly well, and is the most accurate option anyway.</>}
          </li>
          <li>Buttons and labels (&ldquo;Book an Appointment&rdquo;, &ldquo;Opening Hours&rdquo;) are <strong className="text-foreground/80">already translated</strong> in all 12 languages — no work and no cost for those.</li>
          <li>Prescriptions, diagnoses and certificates are <strong className="text-foreground/80">never</strong> translated. Those stay exactly as the doctor wrote them.</li>
        </ul>
      </Panel>

      <Panel title="Default language" hint="What a first-time visitor sees. They can switch at any time, and their choice is remembered.">
        <div className="flex flex-wrap gap-2">
          {[{ code: 'en', englishName: 'English', nativeName: 'English' }, ...status.supportedLocales.filter((l) => enabled.includes(l.code))].map((l) => (
            <Button
              key={l.code}
              variant="ghost"
              size="sm"
              onClick={() => saveLocales(enabled, l.code)}
              busy={busy}
              className={`border ${
                status.defaultLocale === l.code ? 'border-emerald-400 bg-emerald-500/10' : 'border-border/10 bg-foreground/[0.02]'
              }`}
            >
              {l.nativeName}
              {status.defaultLocale === l.code && <Check size={12} className="text-emerald-400" />}
            </Button>
          ))}
        </div>
      </Panel>

      <Panel title="Languages" hint="Turn on the languages spoken around your clinic.">
        <div className="grid sm:grid-cols-2 gap-2">
          {status.supportedLocales.map((l) => {
            const on = enabled.includes(l.code);
            const prog = status.progress.find((p) => p.locale === l.code);
            return (
              <div key={l.code} className={`flex items-center gap-3 p-3 rounded-lg border ${on ? 'border-border/10 bg-foreground/[0.02]' : 'border-border/5 opacity-70'}`}>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{l.nativeName}</div>
                  <div className="text-[11px] text-muted-foreground/70">
                    {l.englishName}
                    {prog && prog.total > 0 && <> · {prog.reviewed}/{prog.total} checked</>}
                  </div>
                </div>
                {on && (
                  <button onClick={() => setEditing(l.code)} className="px-2.5 py-1.5 rounded-lg bg-foreground/10 text-xs hover:bg-foreground/20 shrink-0">
                    Translate
                  </button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggle(l.code)}
                  busy={busy}
                  className={`shrink-0 ${on ? 'bg-emerald-500/15 text-emerald-400' : 'bg-foreground/10 text-muted-foreground'}`}
                >
                  {on ? 'On' : 'Off'}
                </Button>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

const keyOf = (i: { namespace: string; entityId: string; field: string }) => `${i.namespace}:${i.entityId}:${i.field}`;

function TranslationEditor({ locale, status, onBack }: { locale: string; status: TranslationStatus; onBack: () => void }) {
  const [items, setItems] = useState<TransItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const info = status.supportedLocales.find((l) => l.code === locale);
  const allowed = status.autoTranslatableNamespaces ?? [];

  const load = useCallback(async () => {
    try { setItems((await apiFetch<{ items: TransItem[] }>(`/translations/${locale}`)).items); }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Could not load.'); }
  }, [locale]);
  useEffect(() => { load(); }, [load]);

  /** `only` translates exactly the ticked rows; omitting it does everything
   * missing or stale. Both go through the same endpoint. */
  const generate = async (only?: TransItem[]) => {
    setGenerating(true);
    setError(null);
    setNotice(null);
    try {
      const data = only
        ? { only: only.map((i) => ({ namespace: i.namespace, entityId: i.entityId, field: i.field })) }
        : {};
      const res = await apiFetch<{ message: string }>(`/translations/${locale}/generate`, { method: 'POST', data });
      setNotice(res.message);
      setSelected(new Set());
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Translation failed.');
    } finally { setGenerating(false); }
  };

  const toggleSelect = (item: TransItem) => {
    const k = keyOf(item);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  };

  // Only rows this deployment is permitted to auto-translate can be ticked.
  const selectable = items.filter((i) => allowed.includes(i.namespace));
  const selectedItems = selectable.filter((i) => selected.has(keyOf(i)));

  const save = async (item: TransItem, translatedText: string) => {
    try {
      await apiFetch(`/translations/${locale}/item`, {
        method: 'PUT',
        data: { namespace: item.namespace, entityId: item.entityId, field: item.field, sourceText: item.sourceText, translatedText, isReviewed: true },
      });
      setItems((prev) => prev.map((i) =>
        i.namespace === item.namespace && i.entityId === item.entityId && i.field === item.field
          ? { ...i, translatedText, isReviewed: true, isStale: false } : i));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save.');
    }
  };

  const needsReview = items.filter((i) => i.translatedText && !i.isReviewed).length;
  const missing = items.filter((i) => !i.translatedText).length;
  const stale = items.filter((i) => i.isStale).length;

  return (
    <div className="flex flex-col gap-4">
      <button onClick={onBack} className="self-start flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <X size={12} /> Back to languages
      </button>

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">{info?.nativeName} <span className="text-sm text-muted-foreground/70 font-normal">({info?.englishName})</span></h2>
          <p className="text-xs text-muted-foreground/70 mt-0.5">
            {items.length} item{items.length === 1 ? '' : 's'} · {missing} not translated · {needsReview} awaiting your check
            {stale > 0 && <span className="text-amber-400"> · {stale} out of date</span>}
          </p>
        </div>
        {status.autoTranslateAvailable && (
          <div className="flex items-center gap-2 flex-wrap">
            {selectedItems.length > 0 && (
              <Button variant="primary" icon={<Sparkles size={14} />} onClick={() => generate(selectedItems)}
                busy={generating} busyLabel="Translating…">
                {`Translate ${selectedItems.length} selected`}
              </Button>
            )}
            <Button variant={selectedItems.length > 0 ? 'secondary' : 'primary'} icon={<Sparkles size={14} />}
              onClick={() => generate()} busy={generating} busyLabel="Translating…">
              Translate all missing
            </Button>
          </div>
        )}
      </div>

      {error && <div className="px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-sm">{error}</div>}
      {notice && <div className="px-3 py-2 rounded-lg bg-emerald-500/10 text-emerald-400 text-sm">{notice}</div>}

      {!status.autoTranslateAvailable && (
        <div className="px-3 py-2.5 rounded-lg bg-foreground/5 border border-border/10 text-xs text-muted-foreground leading-relaxed">
          {status.unavailableReason ?? "Automatic translation isn't available on this deployment."}
          {' '}Type the translations in below — that works either way, and is the most accurate option.
        </div>
      )}

      {/* Says plainly what this deployment will and won't auto-translate,
          so an admin isn't left wondering why blog posts have no tickbox. */}
      {status.autoTranslateAvailable && allowed.length < 2 && (
        <div className="px-3 py-2.5 rounded-lg bg-foreground/5 border border-border/10 text-xs text-muted-foreground leading-relaxed">
          This deployment only auto-translates{' '}
          <span className="text-foreground/80">{allowed.includes('clinic') ? 'site copy' : allowed.join(', ')}</span>
          {allowed.includes('clinic') && !allowed.includes('post') && <> — blog articles are excluded, as they are the expensive part</>}.
          Anything else can still be typed in by hand.
        </div>
      )}

      {status.autoTranslateAvailable && selectable.length > 0 && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <button onClick={() => setSelected(new Set(selectable.map(keyOf)))} className="hover:text-foreground underline">Select all</button>
          <button onClick={() => setSelected(new Set(selectable.filter((i) => !i.translatedText || i.isStale).map(keyOf)))} className="hover:text-foreground underline">
            Select untranslated &amp; out of date
          </button>
          {selected.size > 0 && <button onClick={() => setSelected(new Set())} className="hover:text-foreground underline">Clear</button>}
          <span className="text-muted-foreground/60">Up to {status.maxItemsPerRun ?? 200} per run.</span>
        </div>
      )}

      <div className="px-3 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200/90 leading-relaxed">
        Machine translation is a <strong className="text-amber-300">first draft</strong>, not a finished one. Anything
        marked &ldquo;needs check&rdquo; has not been read by a person yet. Please read each one — you speak the language,
        the model only predicts it.
      </div>

      <div className="flex flex-col gap-2">
        {items.map((item, i) => (
          <TranslationRow
            key={`${item.namespace}-${item.entityId}-${item.field}-${i}`}
            item={item}
            onSave={save}
            selectable={status.autoTranslateAvailable && allowed.includes(item.namespace)}
            selected={selected.has(keyOf(item))}
            onToggleSelect={() => toggleSelect(item)}
          />
        ))}
      </div>
    </div>
  );
}

function TranslationRow({ item, onSave, selectable, selected, onToggleSelect }: {
  item: TransItem; onSave: (item: TransItem, text: string) => void;
  selectable: boolean; selected: boolean; onToggleSelect: () => void;
}) {
  const [value, setValue] = useState(item.translatedText);
  const [dirty, setDirty] = useState(false);
  useEffect(() => { setValue(item.translatedText); setDirty(false); }, [item.translatedText]);

  const long = item.sourceText.length > 120;

  return (
    <div className={`p-3 rounded-xl border bg-foreground/[0.02] ${selected ? 'border-emerald-400/50' : 'border-border/10'}`}>
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        {selectable && (
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            aria-label={`Select ${item.field} for translation`}
            className="accent-emerald-500"
          />
        )}
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground/60">{item.namespace} · {item.field}</span>
        {!item.translatedText && <Badge tone="gray">not translated</Badge>}
        {item.translatedText && !item.isReviewed && <Badge tone="amber">needs check</Badge>}
        {item.isReviewed && !item.isStale && <Badge tone="emerald">checked</Badge>}
        {item.isStale && <Badge tone="amber">English changed — retranslate</Badge>}
      </div>

      <p className="text-xs text-muted-foreground/70 mb-2 whitespace-pre-line">{item.sourceText}</p>

      <div className="flex gap-2 items-start">
        {long ? (
          <textarea value={value} onChange={(e) => { setValue(e.target.value); setDirty(true); }} rows={4}
            placeholder="Translation" className={fieldCls} />
        ) : (
          <input value={value} onChange={(e) => { setValue(e.target.value); setDirty(true); }}
            placeholder="Translation" className={fieldCls} />
        )}
        <button
          onClick={() => { onSave(item, value); setDirty(false); }}
          disabled={!dirty && item.isReviewed}
          className="px-3 py-2 rounded-lg bg-foreground/10 text-xs hover:bg-foreground/20 disabled:opacity-40 shrink-0"
        >
          {item.isReviewed && !dirty ? 'Saved' : dirty ? 'Save' : 'Approve'}
        </button>
      </div>
    </div>
  );
}

function Badge({ tone, children }: { tone: 'gray' | 'amber' | 'emerald'; children: React.ReactNode }) {
  const tones = {
    gray: 'bg-foreground/10 text-muted-foreground',
    amber: 'bg-amber-500/15 text-amber-400',
    emerald: 'bg-emerald-500/15 text-emerald-400',
  };
  return <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${tones[tone]}`}>{children}</span>;
}

/* ── Layout & theme ────────────────────────────────────────────────────── */

function LayoutBuilder() {
  const toast = useToast();
  const [sections, setSections] = useState<Section[]>([]);
  const [theme, setTheme] = useState('teal');
  const [heroImagePath, setHeroImagePath] = useState<string | null>(null);
  const [mapEmbedUrl, setMapEmbedUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<any>('/settings')
      .then((c) => {
        setSections(normalizeSections(c.publicSections));
        setTheme(c.publicTheme || 'teal');
        setHeroImagePath(c.heroImagePath ?? null);
        setMapEmbedUrl(c.mapEmbedUrl ?? '');
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load site settings.'));
  }, []);

  const move = (index: number, delta: number) => {
    const next = [...sections];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    const a = next[index]!;
    const b = next[target]!;
    next[index] = b;
    next[target] = a;
    setSections(next);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await apiFetch('/site', { method: 'PUT', data: { publicSections: sections, publicTheme: theme, mapEmbedUrl: mapEmbedUrl || undefined } });
      toast.success('Website layout saved.');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  const uploadHero = async (file: File) => {
    setError(null);
    try {
      const updated = await uploadFile('/site/hero', file);
      setHeroImagePath(updated.heroImagePath);
    } catch (e: any) {
      setError(e?.message || 'Upload failed.');
    }
  };

  return (
    <div className="grid lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] gap-6 items-start">
      <div className="flex flex-col gap-5 min-w-0">
      {error && <div className="px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-sm">{error}</div>}

      <Panel title="Page sections" hint="Turn sections off, or reorder them. A section with no content stays hidden even when it is on.">
        <div className="flex flex-col gap-1.5">
          {sections.map((s, i) => (
            <div
              key={s.key}
              className={`group flex items-center gap-2 pl-1 pr-2 py-1.5 rounded-lg border transition-colors ${
                s.enabled ? 'border-border/10 bg-foreground/[0.02] hover:bg-foreground/[0.04]' : 'border-border/5 bg-transparent'
              }`}
            >
              {/* Reorder targets are 20x16 rather than a 13px glyph: these
                  are clicked repeatedly while arranging a page. */}
              <div className="flex flex-col shrink-0">
                <button
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="h-4 w-5 flex items-center justify-center rounded text-muted-foreground/60 hover:text-foreground hover:bg-foreground/10 disabled:opacity-20 disabled:hover:bg-transparent"
                  aria-label={`Move ${SECTION_LABELS[s.key].label} up`}
                >
                  <ChevronUp size={13} />
                </button>
                <button
                  onClick={() => move(i, 1)}
                  disabled={i === sections.length - 1}
                  className="h-4 w-5 flex items-center justify-center rounded text-muted-foreground/60 hover:text-foreground hover:bg-foreground/10 disabled:opacity-20 disabled:hover:bg-transparent"
                  aria-label={`Move ${SECTION_LABELS[s.key].label} down`}
                >
                  <ChevronDown size={13} />
                </button>
              </div>

              <div className="flex-1 min-w-0">
                <div className={`text-[13px] font-medium truncate ${s.enabled ? '' : 'text-muted-foreground/70'}`}>
                  {SECTION_LABELS[s.key].label}
                </div>
                {/* The hint only appears on hover: it is reference detail,
                    not something to read ten times down a list. */}
                <div className="text-[11px] text-muted-foreground/60 truncate hidden group-hover:block">
                  {SECTION_LABELS[s.key].hint}
                </div>
              </div>

              {/* Shown is the norm, so it stays quiet; Hidden is the
                  exception and is the one that should catch the eye. */}
              <button
                onClick={() => setSections(sections.map((x, idx) => (idx === i ? { ...x, enabled: !x.enabled } : x)))}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] shrink-0 transition-colors ${
                  s.enabled
                    ? 'text-muted-foreground/70 hover:text-foreground hover:bg-foreground/10'
                    : 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25'
                }`}
                aria-label={`${s.enabled ? 'Hide' : 'Show'} ${SECTION_LABELS[s.key].label}`}
              >
                {s.enabled ? <><Eye size={11} /> Shown</> : <><EyeOff size={11} /> Hidden</>}
              </button>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Colour theme" hint="A small set of tested palettes. Each one is contrast-checked so text stays readable — that matters more on a page patients rely on than an exact brand colour.">
        <div className="flex flex-wrap gap-2">
          {THEMES.map((t) => (
            <button
              key={t.key}
              onClick={() => setTheme(t.key)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${theme === t.key ? 'border-emerald-400 bg-emerald-500/10' : 'border-border/10 bg-foreground/[0.02]'}`}
            >
              <span className="h-4 w-4 rounded-full" style={{ background: t.swatch }} />
              {t.label}
              {theme === t.key && <Check size={12} className="text-emerald-400" />}
            </button>
          ))}
        </div>
      </Panel>

      <Panel title="Hero image" hint="A wide photo behind the top of your page. A real photo of your clinic works far better than a stock image.">
        <div className="flex items-center gap-3 flex-wrap">
          {heroImagePath && <img src={brandingUrl(heroImagePath)} alt="" className="h-20 w-36 rounded-lg object-cover border border-border/10" />}
          <label className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-foreground/10 text-xs hover:bg-foreground/20 cursor-pointer">
            <Upload size={12} /> {heroImagePath ? 'Replace image' : 'Upload image'}
            <input type="file" accept=".png,.jpg,.jpeg" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadHero(f); e.target.value = ''; }} />
          </label>
        </div>
      </Panel>

      <Panel title="Map embed" hint="Paste the embed link from Google Maps (Share → Embed a map → copy the src URL). Leave blank to just show a 'Get directions' link instead.">
        <input
          value={mapEmbedUrl}
          onChange={(e) => setMapEmbedUrl(e.target.value)}
          placeholder="https://www.google.com/maps/embed?pb=..."
          className="w-full px-3 py-2 rounded-lg bg-foreground/5 border border-border/10 text-sm outline-none focus:border-emerald-400"
        />
      </Panel>

      <Button variant="primary" onClick={save} busy={saving} busyLabel="Saving…" className="self-start">
        Save Website Layout
      </Button>
      </div>

      <SitePreview sections={sections} theme={theme} heroImagePath={heroImagePath} />
    </div>
  );
}

/**
 * The real public page in an iframe, fed the builder's unsaved config.
 *
 * Deliberately the actual site rather than a mock-up: a separate rendering
 * would be free to disagree with what patients see, which is the one thing
 * a preview must never do.
 */
/** The viewport width the desktop preview renders at before scaling. A
 * real desktop breakpoint, so the preview shows the desktop layout rather
 * than whatever the column happens to be wide enough for. */
const DESKTOP_VIEWPORT = 1280;
const PHONE_VIEWPORT = 390; // iPhone 14, the handset most patients use.
const PREVIEW_HEIGHT = 720;

function SitePreview({ sections, theme, heroImagePath }: {
  sections: Section[]; theme: string; heroImagePath: string | null;
}) {
  const frame = useRef<HTMLIFrameElement | null>(null);
  const shell = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);
  const [width, setWidth] = useState<'desktop' | 'phone'>('desktop');
  const [shellWidth, setShellWidth] = useState(0);

  // The scale has to come from the container's real width. A hardcoded
  // factor is wrong at every window size except the one it was picked for
  // -- the previous 0.5 clipped 150px off the right of the site whenever
  // the column was narrower than 640px.
  useEffect(() => {
    const el = shell.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setShellWidth(entry.contentRect.width);
    });
    observer.observe(el);
    setShellWidth(el.clientWidth);
    return () => observer.disconnect();
  }, []);

  const viewport = width === 'phone' ? PHONE_VIEWPORT : DESKTOP_VIEWPORT;
  // The device chrome costs horizontal room (a phone bezel, a browser
  // border), so the scale is computed against what is left after it --
  // otherwise the frame overflows its column at narrow widths.
  const CHROME = width === 'phone' ? 20 : 2;
  // Never scale up past 1:1: a 1280px preview blown up on a wide monitor is
  // blurry and misrepresents the real thing.
  const scale = shellWidth > 0 ? Math.min(1, (shellWidth - CHROME) / viewport) : 1;

  // The frame announces itself when mounted; until then a posted config
  // would land before any listener existed and be lost.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if ((event.data as { type?: string })?.type === 'clinic-preview-ready') setReady(true);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    if (!ready) return;
    frame.current?.contentWindow?.postMessage(
      {
        type: 'clinic-preview',
        config: { publicSections: sections, publicTheme: theme, heroImagePath },
      },
      window.location.origin,
    );
  }, [ready, sections, theme, heroImagePath]);

  return (
    <div className="lg:sticky lg:top-6 flex flex-col gap-3 min-w-0">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Eye size={13} /> Live preview
          {!ready && <Spinner size={11} className="text-emerald-400" />}
        </div>
        <div className="flex items-center gap-1">
          <SegmentedControl
            label="Preview width"
            value={width}
            onChange={setWidth}
            options={[
              { value: 'desktop', label: 'Desktop' },
              { value: 'phone', label: 'Phone' },
            ]}
          />
          <a href={publicSiteUrl('/')} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-foreground/10 text-[11px] hover:bg-foreground/20">
            <ExternalLink size={11} /> Open
          </a>
        </div>
      </div>

      {/*
        The frame renders at a real device viewport and is scaled to fit,
        rather than squeezed into the column. A 500px-wide iframe labelled
        "Desktop" shows the tablet layout and quietly tells you a lie about
        your own site.

        `shell` is measured so the scale can be derived from the real
        column width; the device chrome carries the white ground, which is
        what stops a 390px phone preview sitting in a full-width white void.
      */}
      <div ref={shell} className="flex justify-center">
        <DeviceFrame
          device={width}
          width={viewport * scale}
          height={PREVIEW_HEIGHT * scale}
          url={typeof window !== 'undefined' ? window.location.origin.replace(/^https?:\/\//, '') + '/clinic' : undefined}
        >
          <iframe
            ref={frame}
            src={publicSiteUrl('/')}
            title="Website preview"
            className="border-0 origin-top-left"
            style={{ width: viewport, height: PREVIEW_HEIGHT, transform: `scale(${scale})` }}
          />
        </DeviceFrame>
      </div>

      <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
        {width === 'desktop' ? `${DESKTOP_VIEWPORT}px desktop` : `${PHONE_VIEWPORT}px phone`}
        {scale < 1 && `, shown at ${Math.round(scale * 100)}%`}. Section order and theme update as you
        change them; text and photos come from what is saved.
      </p>
    </div>
  );
}

/* ── Blog ──────────────────────────────────────────────────────────────── */

interface Post {
  id: string; title: string; slug: string; excerpt: string | null; content: string;
  coverImagePath: string | null; tags: string | null; published: boolean;
  publishedAt: string | null; author: { name: string }; updatedAt: string;
}

function BlogManager() {
  const toast = useToast();
  const [posts, setPosts] = useState<Post[]>([]);
  const [editing, setEditing] = useState<Post | 'new' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch<{ posts: Post[] }>('/posts');
      setPosts(res.posts);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load articles.');
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const remove = async (id: string) => {
    try { await apiFetch(`/posts/${id}`, { method: 'DELETE' }); toast.success('Article deleted.'); load(); }
    catch (e) { const m = e instanceof ApiError ? e.message : 'Could not delete.'; setError(m); toast.error(m); }
  };

  const togglePublish = async (p: Post) => {
    try { await apiFetch(`/posts/${p.id}`, { method: 'PUT', data: { published: !p.published } }); toast.success(p.published ? 'Article unpublished.' : 'Article published.'); load(); }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Could not update.'); }
  };

  if (editing) {
    return <PostEditor post={editing === 'new' ? null : editing} onDone={() => { setEditing(null); load(); }} />;
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <div className="px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-sm">{error}</div>}

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground/70 max-w-lg">
          Factual health information is the one kind of content Indian medical ethics rules clearly permit a
          practice to publish. Write about conditions you treat, seasonal advice, or what to expect at a visit.
        </p>
        <button onClick={() => setEditing('new')} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold shrink-0">
          <Plus size={14} /> New Article
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {posts.map((p) => (
          <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl border border-border/10 bg-foreground/[0.02]">
            {p.coverImagePath
              ? <img src={brandingUrl(p.coverImagePath)} alt="" className="h-12 w-16 rounded object-cover shrink-0" />
              : <span className="h-12 w-16 rounded bg-foreground/5 flex items-center justify-center shrink-0"><FileText size={16} className="text-muted-foreground/60" /></span>}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{p.title}</div>
              <div className="text-[11px] text-muted-foreground/70">
                {p.published ? `Published ${p.publishedAt ? new Date(p.publishedAt).toLocaleDateString() : ''}` : 'Draft'} · {p.author.name}
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => togglePublish(p)}
              className={`shrink-0 ${p.published ? 'bg-emerald-500/15 text-emerald-400' : 'bg-foreground/10 text-muted-foreground'}`}
            >
              {p.published ? 'Published' : 'Draft'}
            </Button>
            <button onClick={() => setEditing(p)} className="px-2.5 py-1.5 rounded-lg bg-foreground/10 text-xs hover:bg-foreground/20 shrink-0">Edit</button>
            <Button variant="ghost" size="sm" onClick={() => remove(p.id)} aria-label="Delete article" className="shrink-0"><Trash2 size={13} /></Button>
          </div>
        ))}
        {posts.length === 0 && <p className="text-sm text-muted-foreground/60 py-8 text-center">No articles yet.</p>}
      </div>
    </div>
  );
}

function PostEditor({ post, onDone }: { post: Post | null; onDone: () => void }) {
  const [title, setTitle] = useState(post?.title ?? '');
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? '');
  const [content, setContent] = useState(post?.content ?? '');
  const [tags, setTags] = useState(post?.tags ?? '');
  const [published, setPublished] = useState(post?.published ?? false);
  const [coverImagePath, setCoverImagePath] = useState(post?.coverImagePath ?? null);
  const [postId, setPostId] = useState(post?.id ?? null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const data = { title, excerpt: excerpt || undefined, content, tags: tags || undefined, published };
      if (postId) await apiFetch(`/posts/${postId}`, { method: 'PUT', data });
      else await apiFetch('/posts', { method: 'POST', data });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the article.');
    } finally {
      setSaving(false);
    }
  };

  // A cover needs a post to attach to, so an unsaved draft is saved first.
  const uploadCover = async (file: File) => {
    setError(null);
    try {
      let id = postId;
      if (!id) {
        const created = await apiFetch<Post>('/posts', { method: 'POST', data: { title: title || 'Untitled', content: content || ' ', published: false } });
        id = created.id;
        setPostId(created.id);
      }
      const updated = await uploadFile(`/posts/${id}/cover`, file);
      setCoverImagePath(updated.coverImagePath);
    } catch (err: any) {
      setError(err?.message || 'Upload failed.');
    }
  };

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      {error && <div className="px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-sm">{error}</div>}

      <button type="button" onClick={onDone} className="self-start flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <X size={12} /> Back to articles
      </button>

      <div>
        <label className="block text-xs text-muted-foreground mb-1">Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} className={fieldCls} />
      </div>
      <div>
        <label className="block text-xs text-muted-foreground mb-1">Short summary</label>
        <input value={excerpt} onChange={(e) => setExcerpt(e.target.value)} maxLength={500} placeholder="One or two lines shown on the article card." className={fieldCls} />
      </div>
      <div>
        <label className="block text-xs text-muted-foreground mb-1">Article</label>
        <textarea value={content} onChange={(e) => setContent(e.target.value)} required rows={14} className={fieldCls} />
        <p className="text-[11px] text-muted-foreground/60 mt-1">Leave a blank line between paragraphs.</p>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Tags</label>
          <input value={tags} onChange={(e) => setTags(e.target.value)} maxLength={200} placeholder="Diabetes, Seasonal" className={fieldCls} />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Cover image</label>
          <div className="flex items-center gap-2">
            {coverImagePath && <img src={brandingUrl(coverImagePath)} alt="" className="h-9 w-14 rounded object-cover" />}
            <label className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-foreground/10 text-xs hover:bg-foreground/20 cursor-pointer">
              <Upload size={11} /> {coverImagePath ? 'Replace' : 'Upload'}
              <input type="file" accept=".png,.jpg,.jpeg" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadCover(f); e.target.value = ''; }} />
            </label>
          </div>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-foreground/80">
        <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
        Publish this article on the website
      </label>

      <button type="submit" disabled={saving} className="self-start px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">
        {saving ? 'Saving…' : postId ? 'Save Article' : 'Create Article'}
      </button>
    </form>
  );
}

/* ── Gallery ───────────────────────────────────────────────────────────── */

interface Photo { id: string; caption: string | null; storagePath: string }

function GalleryManager() {
  const toast = useToast();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [caption, setCaption] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    try { setPhotos((await apiFetch<{ photos: Photo[] }>('/gallery')).photos); }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Could not load photos.'); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const upload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const token = localStorage.getItem('clinicAccessToken');
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:4100/api/clinic';
      const body = new FormData();
      // Caption must be appended BEFORE the file: @fastify/multipart streams
      // fields in order, and a field after the file isn't parsed by the time
      // the handler reads it.
      if (caption) body.append('caption', caption);
      body.append('file', file);
      const res = await fetch(`${apiBase}/gallery`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Upload failed');
      setCaption('');
      load();
    } catch (e: any) {
      setError(e?.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const remove = async (id: string) => {
    try { await apiFetch(`/gallery/${id}`, { method: 'DELETE' }); toast.success('Photo deleted.'); load(); }
    catch (e) { const m = e instanceof ApiError ? e.message : 'Could not delete.'; setError(m); toast.error(m); }
  };

  return (
    <div className="flex flex-col gap-4">
      {error && <div className="px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-sm">{error}</div>}

      <Panel title="Add a photo" hint="Photos of your waiting room, consulting room or equipment. Never include a photo with a patient in it — you would need their written consent, and it is not worth the risk.">
        <div className="flex flex-wrap items-center gap-2">
          <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Caption (optional)" maxLength={200} className={`${fieldCls} flex-1 min-w-[200px]`} />
          <label className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-foreground/10 text-xs hover:bg-foreground/20 cursor-pointer whitespace-nowrap">
            <Upload size={12} /> {uploading ? 'Uploading…' : 'Choose photo'}
            <input type="file" accept=".png,.jpg,.jpeg" className="hidden" disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
          </label>
        </div>
      </Panel>

      <div className="grid sm:grid-cols-3 gap-3">
        {photos.map((p) => (
          <div key={p.id} className="relative rounded-xl overflow-hidden border border-border/10 group">
            <img src={brandingUrl(p.storagePath)} alt={p.caption ?? ''} className="w-full h-32 object-cover" />
            {p.caption && <div className="px-2 py-1.5 text-[11px] text-muted-foreground truncate">{p.caption}</div>}
            <Button variant="ghost" size="sm" onClick={() => remove(p.id)} className="absolute top-1.5 right-1.5 bg-black/70 text-foreground opacity-0 group-hover:opacity-100" aria-label="Delete photo">
              <Trash2 size={12} />
            </Button>
          </div>
        ))}
        {photos.length === 0 && <p className="sm:col-span-3 text-sm text-muted-foreground/60 py-8 text-center">No photos yet.</p>}
      </div>
    </div>
  );
}

/* ── Feedback ──────────────────────────────────────────────────────────── */

interface FeedbackItem {
  id: string; patientName: string | null; rating: number; comment: string | null;
  isPublished: boolean; submittedAt: string;
}

function FeedbackManager() {
  const toast = useToast();
  const [data, setData] = useState<{ feedback: FeedbackItem[]; count: number; average: number | null; distribution: { stars: number; count: number }[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setData(await apiFetch('/feedback')); }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Could not load feedback.'); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggle = async (f: FeedbackItem) => {
    try { await apiFetch(`/feedback/${f.id}`, { method: 'PATCH', data: { isPublished: !f.isPublished } }); toast.success(f.isPublished ? 'Feedback made private.' : 'Feedback published.'); load(); }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Could not update.'); }
  };
  const remove = async (id: string) => {
    try { await apiFetch(`/feedback/${id}`, { method: 'DELETE' }); toast.success('Feedback deleted.'); load(); }
    catch (e) { const m = e instanceof ApiError ? e.message : 'Could not delete.'; setError(m); toast.error(m); }
  };

  const max = Math.max(1, ...(data?.distribution ?? []).map((d) => d.count));

  return (
    <div className="flex flex-col gap-4">
      {error && <div className="px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-sm">{error}</div>}

      {/* This is the single most important thing on this screen. It is
          stated before the publish toggles, not after. */}
      <div className="flex gap-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
        <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-200/90 leading-relaxed">
          <strong className="text-amber-300">Before you publish any of this.</strong> India's Code of Medical Ethics
          (Clause 6.1.1) and the NMC's guidance prohibit a registered practitioner from requesting or sharing patient
          testimonials, recommendations or reviews. A patient posting on Google themselves is their business —
          republishing it on your own site is generally treated as soliciting, and it is your registration at risk.
          <br /><br />
          Feedback is kept private by default, which is both safer and more useful: it tells you where service is
          slipping. Publishing is your call, but make it deliberately.
        </div>
      </div>

      {data && data.count > 0 && (
        <Panel title="What patients are saying" hint="Private to the clinic unless you publish an item.">
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <div className="text-3xl font-bold">{data.average?.toFixed(1)}</div>
              <div className="text-xs text-muted-foreground/70">{data.count} response{data.count === 1 ? '' : 's'}</div>
            </div>
            <div className="flex-1 min-w-[180px] flex flex-col gap-1">
              {data.distribution.map((d) => (
                <div key={d.stars} className="flex items-center gap-2 text-[11px]">
                  <span className="text-muted-foreground/70 w-3">{d.stars}</span>
                  <Star size={10} className="text-amber-400 shrink-0" />
                  <div className="flex-1 h-1.5 rounded-full bg-foreground/5 overflow-hidden">
                    <div className="h-full bg-amber-400 rounded-full" style={{ width: `${(d.count / max) * 100}%` }} />
                  </div>
                  <span className="text-muted-foreground/70 w-4 text-right">{d.count}</span>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      )}

      <div className="flex flex-col gap-2">
        {(data?.feedback ?? []).map((f) => (
          <div key={f.id} className="p-3 rounded-xl border border-border/10 bg-foreground/[0.02]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} size={11} className={n <= f.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-700'} />
                    ))}
                  </span>
                  <span className="text-xs text-muted-foreground">{f.patientName || 'Anonymous'}</span>
                  <span className="text-[11px] text-muted-foreground/60">{new Date(f.submittedAt).toLocaleDateString()}</span>
                </div>
                {f.comment && <p className="text-sm text-foreground/80 mt-1.5">{f.comment}</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="ghost" size="sm" onClick={() => toggle(f)}
                  className={f.isPublished ? 'bg-amber-500/15 text-amber-400' : 'bg-foreground/10 text-muted-foreground'}>
                  {f.isPublished ? 'Public' : 'Private'}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => remove(f.id)} aria-label="Delete feedback"><Trash2 size={13} /></Button>
              </div>
            </div>
          </div>
        ))}
        {data && data.feedback.length === 0 && (
          <p className="text-sm text-muted-foreground/60 py-8 text-center">
            No feedback yet. Patients can leave it from your public page once the feedback section is switched on.
          </p>
        )}
      </div>
    </div>
  );
}

/* ── Shared ────────────────────────────────────────────────────────────── */

const fieldCls = 'w-full px-3 py-2 rounded-lg bg-foreground/5 border border-border/10 text-sm outline-none focus:border-emerald-400';

function Panel({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="p-4 rounded-xl border border-border/10 bg-foreground/[0.02]">
      <h2 className="text-sm font-semibold flex items-center gap-1.5">
        {title === 'Colour theme' && <Palette size={13} className="text-emerald-400" />}
        {title === 'Hero image' && <ImageIcon size={13} className="text-emerald-400" />}
        {title}
      </h2>
      {hint && <p className="text-xs text-muted-foreground/70 mb-3 mt-0.5 leading-relaxed">{hint}</p>}
      {children}
    </div>
  );
}

async function uploadFile(path: string, file: File): Promise<any> {
  const token = localStorage.getItem('clinicAccessToken');
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:4100/api/clinic';
  const body = new FormData();
  body.append('file', file);
  const res = await fetch(`${apiBase}${path}`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Upload failed');
  return res.json();
}

/** Always returns every known section in a stable order, merging whatever
 * was saved. A section added in a future release then appears for a clinic
 * that saved its layout before that release existed, rather than silently
 * never rendering. */
function normalizeSections(saved: Section[] | null | undefined): Section[] {
  const savedList = Array.isArray(saved) ? saved : [];
  const known = savedList.filter((s) => ALL_KEYS.includes(s.key));
  const missing = ALL_KEYS.filter((k) => !known.some((s) => s.key === k)).map((key) => ({ key, enabled: true }));
  return [...known, ...missing];
}
