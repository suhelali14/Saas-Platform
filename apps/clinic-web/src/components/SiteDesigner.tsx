import { useEffect, useState } from 'react';
import { AlertTriangle, Check } from 'lucide-react';
import { apiFetch, ApiError } from '../lib/api';
import { sectionHint, sectionLabel, sectionDefaultHeading } from '../lib/sections';
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

// Section names come from lib/sections.ts. This file used to keep its
// own copy, which is how a doctor ended up reading the literal string
// "booking" in a list where every other row had a real name.

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
      {/*
        auto-fit, not a fixed two columns.

        These sit in a 320px settings column, and Spacing and Corners
        were additionally side by side, so each option card was ending
        up about 75px wide -- "Less space between sections." set two
        words to a line, down a column, for every option. A fixed
        column count cannot know how much room it has; a minimum
        width can, and drops to one column rather than shredding the
        sentence.

        152px is the measured floor: below it "Comfortable" and
        "Very round" start breaking mid-word.
      */}
      <div className="mt-2 grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(152px,1fr))]">
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
              <span className="flex items-start justify-between gap-1.5 text-xs font-medium">
                <span className="min-w-0">{o.label}</span>
                {selected && <Check size={11} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />}
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
        onChange={(action) => {
          // Drop a label that was only ever the previous action's default.
          //
          // The label is stored, and changing the action did not touch it
          // -- so picking "Show the live queue", then changing your mind
          // and picking "Ask for an appointment", left a button that said
          // "see how busy we are" and opened the booking form. The words
          // contradicted what the button did, on the clinic's own home
          // page.
          //
          // A label the clinic actually wrote is kept. One that matches
          // any action's built-in wording was never a decision, so it
          // gives way to the new action's.
          const current = design.cta.label?.trim().toLowerCase();
          const wasADefault =
            !current ||
            vocabulary.ctaActions.some((a) => a.defaultLabel.trim().toLowerCase() === current);
          set({
            cta: {
              ...design.cta,
              action,
              ...(wasADefault ? { label: undefined } : {}),
            },
          });
        }}
        options={vocabulary.ctaActions.map((a) => ({
          ...a,
          disabled: (a.key === 'call' || a.key === 'whatsapp') && !available.phone
            ? 'Needs a phone number in Settings.'
            : a.key === 'directions' && !available.mapUrl
              ? 'Needs a map link in Settings.'
              : undefined,
        }))}
      />

      {/* One column unless there is a second field to pair with. Half of a
          320px column truncated the label at "see how busy we ar". */}
      {design.cta.action !== 'none' && (
        <div className={cn('grid gap-3', design.cta.action === 'whatsapp' && 'sm:grid-cols-2')}>
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

      {/* Not offered when the main button already goes there. Two
          buttons to the same page, one of them labelled "see how busy we
          are" and the other "live queue", is the sort of thing that makes
          a page look unfinished. */}
      {design.cta.action !== 'queue' && (
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
      )}

      {/* ── Spacing and corners ────────────────────────────────────── */}
      {/* Stacked, not side by side. Each of these needs the full
          width of the settings column for its options to read; two
          of them abreast is what made the cards unreadable. */}
      <div className="grid gap-5">
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

            // A section that is switched off gets its name and nothing
            // else. It used to carry a heading field and a layout picker
            // too -- eleven rows of controls for things nobody will see,
            // burying the handful that are actually live. Visual weight
            // follows the exception, not the norm.
            if (!s.enabled) {
              return (
                <div key={s.key} className="flex items-center gap-2 px-2.5 py-2">
                  <span className="w-28 shrink-0 text-xs text-muted-foreground">
                    {sectionLabel(s.key)}
                  </span>
                  <span className="tone-neutral rounded-full px-1.5 py-0.5 text-[10px] font-medium">
                    not shown
                  </span>
                </div>
              );
            }

            return (
                <div key={s.key} className="p-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="w-28 shrink-0 text-xs font-medium" title={sectionHint(s.key)}>
                      {sectionLabel(s.key)}
                    </span>
                    <Input
                      value={s.heading ?? ''}
                      onChange={(e) => setSection(s.key, { heading: e.target.value || undefined })}
                      // The heading it will actually carry, not the words
                      // "Built-in heading". The question this row raises
                      // is "what will this say if I leave it alone", and
                      // the placeholder may as well answer it.
                      placeholder={sectionDefaultHeading(s.key)}
                      className="h-7 min-w-0 flex-1 text-[11px]"
                    />
                    {variants && (
                      <SegmentedControl
                        label={`${sectionLabel(s.key)} layout`}
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
