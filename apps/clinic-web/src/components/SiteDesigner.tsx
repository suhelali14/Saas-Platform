import { useEffect, useState } from 'react';
import { AlertTriangle, Check } from 'lucide-react';
import { apiFetch, ApiError } from '../lib/api';
import { cn } from '@/lib/utils';
import { Input, Label, Textarea } from './ui';
import { SegmentedControl } from './SegmentedControl';
import type { SiteDesign, SectionConfig } from '../lib/site-design';

/**
 * Chooses how the public page looks.
 *
 * The vocabulary comes from the API, which is what makes this safe to be
 * this free: every option offered here is a layout the page actually
 * draws, so nothing a clinic picks can produce a page that does not
 * work. That is checked in CI rather than trusted.
 *
 * ── Each option says what it is for ──────────────────────────────────
 *
 * Not what it is called. "Split hero" means nothing to a doctor; "text
 * beside your photo, needs a hero image" means they can choose. The
 * hints come from the API alongside the keys for the same reason the
 * keys do — they describe the layout, so they belong with it.
 *
 * And an option that cannot work yet says so instead of failing
 * quietly. A clinic with no hero image uploaded picking "photo behind
 * text" would otherwise choose a layout, save, and see no change.
 */

type Vocabulary = {
  sectionVariants: Record<string, { key: string; label: string; hint: string }[]>;
  fonts: { key: string; label: string; hint: string; heading: string; body: string }[];
  densities: { key: string; label: string; hint: string }[];
  corners: { key: string; label: string; hint: string }[];
  ctaActions: { key: string; label: string; hint: string; defaultLabel: string }[];
};

type Available = { heroImage: boolean; phone: boolean; mapUrl: boolean; tagline: boolean };

const SECTION_LABELS: Record<string, string> = {
  about: 'About', services: 'Services', highlights: 'Why choose us',
  doctors: 'Doctors', gallery: 'Photos', blog: 'Articles',
  feedback: 'Patient feedback', queue: 'Live queue', faq: 'Questions', contact: 'Contact',
};

/** A row of choices where each explains itself. */
function Choice<T extends string>({
  label, hint, value, onChange, options,
}: {
  label: string;
  hint?: string;
  value: T;
  onChange: (v: T) => void;
  options: { key: string; label: string; hint: string; disabled?: string }[];
}) {
  return (
    <div>
      <Label>{label}</Label>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {options.map((o) => {
          const selected = o.key === value;
          return (
            <button
              key={o.key}
              type="button"
              disabled={Boolean(o.disabled)}
              onClick={() => onChange(o.key as T)}
              aria-pressed={selected}
              className={cn(
                'rounded-lg border p-2.5 text-left transition-colors',
                selected
                  ? 'border-primary bg-primary/10'
                  : 'border-border/10 bg-foreground/[0.02] hover:bg-foreground/5',
                o.disabled && 'cursor-not-allowed opacity-50',
              )}
            >
              <span className="flex items-center gap-1.5 text-xs font-medium">
                {o.label}
                {selected && <Check size={11} className="text-primary" aria-hidden="true" />}
              </span>
              {/* What it is for, not what it is called. */}
              <span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground">
                {o.disabled ?? o.hint}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function SiteDesigner({ onSaved }: { onSaved?: () => void }) {
  const [design, setDesign] = useState<SiteDesign | null>(null);
  const [sections, setSections] = useState<SectionConfig[]>([]);
  const [vocabulary, setVocabulary] = useState<Vocabulary | null>(null);
  const [available, setAvailable] = useState<Available | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<{
      design: SiteDesign; sections: SectionConfig[];
      vocabulary: Vocabulary; available: Available;
    }>('/site-design')
      .then((r) => {
        setDesign(r.design);
        setSections(r.sections);
        setVocabulary(r.vocabulary);
        setAvailable(r.available);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load the design options.'));
  }, []);

  if (error) return <p className="text-sm text-ink-danger">{error}</p>;
  if (!design || !vocabulary || !available) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const set = (patch: Partial<SiteDesign>) => {
    setDesign((d) => (d ? { ...d, ...patch } : d));
    setDirty(true);
  };

  const setSection = (key: string, patch: Partial<SectionConfig>) => {
    setSections((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      await apiFetch('/site', { method: 'PUT', data: { publicDesign: design, publicSections: sections } });
      setDirty(false);
      onSaved?.();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  const cta = vocabulary.ctaActions.find((a) => a.key === design.cta.action);

  return (
    <div className="space-y-6">
      {/* ── Typeface ───────────────────────────────────────────────── */}
      <Choice
        label="Typeface"
        hint="Two faces that work together, chosen rather than mixed: a display face in body text is hard to read, and the patients most affected are the oldest."
        value={design.font}
        onChange={(font) => set({ font })}
        options={vocabulary.fonts}
      />

      {/* ── The hero ───────────────────────────────────────────────── */}
      <Choice
        label="Top of the page"
        hint="The first thing a stranger sees."
        value={design.heroVariant}
        onChange={(heroVariant) => set({ heroVariant })}
        options={(vocabulary.sectionVariants.hero ?? []).map((v) => ({
          ...v,
          // Said here rather than discovered after saving.
          disabled: (v.key === 'split' || v.key === 'banner') && !available.heroImage
            ? 'Needs a hero image — upload one above first.'
            : undefined,
        }))}
      />

      <div className="space-y-1.5">
        <Label htmlFor="heroHeadline">Your one line</Label>
        <Textarea
          id="heroHeadline"
          value={design.heroHeadline ?? ''}
          onChange={(e) => set({ heroHeadline: e.target.value })}
          placeholder={available.tagline ? 'Leave blank to use your tagline' : 'Trusted family care in Kothrud, open seven days'}
          maxLength={160}
          className="min-h-[52px] text-xs"
        />
        <p className="text-[11px] text-muted-foreground">
          Plain language, one sentence, what you actually do and where. This is the line that
          decides whether someone keeps reading — it is not a mission statement.
        </p>
      </div>

      {/* ── The main button ────────────────────────────────────────── */}
      <Choice
        label="The main button"
        hint="One prominent action works better than several competing ones. Pick the one your patients actually use."
        value={design.cta.action}
        onChange={(action) => set({ cta: { ...design.cta, action } })}
        options={vocabulary.ctaActions.map((a) => ({
          ...a,
          disabled: (a.key === 'call' || a.key === 'whatsapp') && !available.phone
            ? 'Needs a phone number in Settings.'
            : a.key === 'directions' && !available.mapUrl
              ? 'Needs a map link in Settings.'
              : undefined,
        }))}
      />

      {design.cta.action !== 'none' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ctaLabel">What the button says</Label>
            <Input
              id="ctaLabel"
              value={design.cta.label ?? ''}
              onChange={(e) => set({ cta: { ...design.cta, label: e.target.value } })}
              placeholder={cta?.defaultLabel ?? ''}
              className="h-8 text-xs"
            />
          </div>
          {design.cta.action === 'whatsapp' && (
            <div className="space-y-1.5">
              <Label htmlFor="ctaMessage">Message it opens with</Label>
              <Input
                id="ctaMessage"
                value={design.cta.message ?? ''}
                onChange={(e) => set({ cta: { ...design.cta, message: e.target.value } })}
                placeholder="Hello, I would like an appointment"
                className="h-8 text-xs"
              />
            </div>
          )}
        </div>
      )}

      <label className="flex items-start gap-2 text-xs">
        <input
          type="checkbox"
          checked={design.secondaryCta}
          onChange={(e) => set({ secondaryCta: e.target.checked })}
          className="mt-0.5 accent-primary"
        />
        <span>
          Also show a quieter &ldquo;live queue&rdquo; button beside it.
          <span className="block text-[11px] text-muted-foreground">
            Turn this off if you want one unmistakable action.
          </span>
        </span>
      </label>

      {/* ── Spacing and corners ────────────────────────────────────── */}
      <div className="grid gap-5 sm:grid-cols-2">
        <Choice
          label="Spacing"
          value={design.density}
          onChange={(density) => set({ density })}
          options={vocabulary.densities}
        />
        <Choice
          label="Corners"
          value={design.corners}
          onChange={(corners) => set({ corners })}
          options={vocabulary.corners}
        />
      </div>

      {/* ── Per-section headings and layouts ───────────────────────── */}
      <div>
        <Label>What each section is called, and how it looks</Label>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Leave a heading blank to keep the built-in wording. Reordering and turning sections
          off is above.
        </p>
        <div className="mt-2 divide-y divide-border/10 overflow-hidden rounded-lg border border-border/10">
          {sections.map((s) => {
            const variants = vocabulary.sectionVariants[s.key];
            return (
              <div key={s.key} className={cn('p-2.5', !s.enabled && 'opacity-50')}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="w-28 shrink-0 text-xs font-medium">
                    {SECTION_LABELS[s.key] ?? s.key}
                    {!s.enabled && <span className="ml-1 text-[10px] text-muted-foreground">off</span>}
                  </span>
                  <Input
                    value={s.heading ?? ''}
                    onChange={(e) => setSection(s.key, { heading: e.target.value || undefined })}
                    placeholder="Built-in heading"
                    className="h-7 min-w-0 flex-1 text-[11px]"
                  />
                  {variants && (
                    <SegmentedControl
                      label={`${SECTION_LABELS[s.key] ?? s.key} layout`}
                      value={s.variant ?? variants[0]!.key}
                      onChange={(variant) => setSection(s.key, { variant })}
                      options={variants.map((v) => ({ value: v.key, label: v.label, title: v.hint }))}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {error && (
        <p className="flex items-start gap-1.5 text-[11px] text-ink-danger">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={!dirty || saving}
          onClick={save}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save how it looks'}
        </button>
        {dirty && <span className="text-[11px] text-muted-foreground">Unsaved changes.</span>}
      </div>
    </div>
  );
}
