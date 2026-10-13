/**
 * How a clinic's public website looks, beyond which sections are on.
 *
 * The site could already reorder and hide sections and pick one of six
 * palettes. Everything else — the shape of the hero, the typeface, what
 * each section is called, what the main button says and does — was fixed
 * in the code, so every clinic's page looked like the same product with
 * a different colour.
 *
 * ── What the research actually says ──────────────────────────────────
 *
 * Surveyed rather than guessed, from 2026 roundups of medical practice
 * sites (colorlib, azurodigital, blendb2b, healthus.ai). What recurs:
 *
 * - **Patient-intent navigation.** The core actions have to be obvious
 *   and few: find a doctor, find the place, book, read something. The
 *   sites held up as models reduce the homepage to those.
 * - **One prominent call to action**, not five competing ones. This is
 *   the single most repeated recommendation.
 * - **The hero states the value in one line, in plain language.** The
 *   example that stuck: "Trusted Heart Specialists in Mumbai Offering
 *   Advanced, Gentle Cardiac Treatments" — a sentence a patient
 *   understands, not a mission statement.
 * - **Calm palette, clean layout, clear typography.** Consistently
 *   described as what makes a medical site read as credible.
 *
 * So the knobs here are the ones that change those things, and the CTA
 * includes WhatsApp — because in this market that is how a clinic
 * actually gets booked, and a "Book an Appointment" button that opens a
 * form is often the wrong answer.
 *
 * ── A vocabulary, not a canvas ───────────────────────────────────────
 *
 * Same decision as the printed documents, for a related reason. A free
 * layout editor lets a clinic produce a page a patient cannot read or
 * navigate on a phone, and this page is read once by a stranger deciding
 * whether to trust a doctor. Every variant below is a layout the
 * renderer draws properly and that has been built to work at phone
 * width; a clinic composes from them and cannot produce something
 * broken.
 *
 * Still deliberately absent: a free colour picker and arbitrary fonts.
 * An arbitrary hex pair reliably produces unreadable text, and this is
 * not a page to discover that on.
 */

export const SECTION_KEYS = [
  "about", "services", "highlights", "doctors", "gallery",
  "blog", "feedback", "queue", "faq", "contact",
] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

/**
 * The layouts each section can be drawn in.
 *
 * Only the sections where the shape genuinely changes how the page
 * reads. Adding a variant means writing a layout, so this list is
 * exactly what the renderer supports -- an option the page cannot draw
 * would be a setting that silently does nothing.
 */
export const SECTION_VARIANTS: Partial<Record<SectionKey | "hero", readonly { key: string; label: string; hint: string }[]>> = {
  hero: [
    { key: "centred", label: "Centred", hint: "Headline and buttons in the middle. Calm, and the safest with no photo." },
    { key: "split", label: "Text beside photo", hint: "Headline on one side, your photo on the other. Needs a hero image." },
    { key: "banner", label: "Photo behind text", hint: "Full-width photo with the headline over it. Strongest with a bright, wide photo of the clinic." },
    { key: "minimal", label: "Minimal", hint: "Just the name, one line and one button. Fastest to read." },
  ],
  services: [
    { key: "grid", label: "Grid of cards", hint: "Two or three across. Good for six to twelve services." },
    { key: "list", label: "Simple list", hint: "One per line. Good for a long list, or very short names." },
    { key: "chips", label: "Compact chips", hint: "Wraps inline. Good when there are many short services." },
  ],
  doctors: [
    { key: "cards", label: "Cards", hint: "Photo, name, qualifications and bio. Best for one to three doctors." },
    { key: "rows", label: "Rows", hint: "Compact, photo on the left. Better past three or four." },
  ],
  highlights: [
    { key: "grid", label: "Grid", hint: "Side by side with the heading above each." },
    { key: "stacked", label: "Stacked", hint: "Full width, one under another. More room for longer text." },
  ],
};

/**
 * Curated type pairings.
 *
 * A heading face and a body face that are known to work together and to
 * remain legible at the sizes this page uses. Not a font picker: a
 * clinic choosing a display face for body text produces a page that is
 * hard to read, and the people most affected are the oldest patients.
 *
 * Each is loaded from Google Fonts with a system fallback, so a page
 * still renders correctly if the font never arrives.
 */
export const FONT_PAIRINGS = [
  {
    key: "clean",
    label: "Clean and neutral",
    hint: "Inter throughout. Modern, plain, reads as competent rather than styled.",
    heading: "Inter",
    body: "Inter",
    weights: "400;500;600;700",
  },
  {
    key: "classic",
    label: "Classic and established",
    hint: "A serif for headings. Reads as a practice that has been here a while.",
    heading: "Lora",
    body: "Inter",
    weights: "400;500;600;700",
  },
  {
    key: "warm",
    label: "Warm and approachable",
    hint: "Rounder letterforms. Suits paediatrics and family practice.",
    heading: "Nunito",
    body: "Nunito Sans",
    weights: "400;600;700",
  },
  {
    key: "formal",
    label: "Formal and clinical",
    hint: "Tight, precise. Suits a specialist or diagnostic practice.",
    heading: "IBM Plex Sans",
    body: "IBM Plex Sans",
    weights: "400;500;600",
  },
] as const;
export type FontKey = (typeof FONT_PAIRINGS)[number]["key"];

/** How much air the page has. */
export const DENSITIES = [
  { key: "comfortable", label: "Comfortable", hint: "Generous spacing. The default, and easiest to scan." },
  { key: "compact", label: "Compact", hint: "Less space between sections. Fits more above the fold." },
  { key: "airy", label: "Airy", hint: "Lots of space. Suits a short page with few sections." },
] as const;
export type DensityKey = (typeof DENSITIES)[number]["key"];

export const CORNERS = [
  { key: "soft", label: "Soft", hint: "Rounded. The default." },
  { key: "sharp", label: "Sharp", hint: "Square corners. Reads as more formal." },
  { key: "pill", label: "Very round", hint: "Fully rounded buttons and cards." },
] as const;
export type CornerKey = (typeof CORNERS)[number]["key"];

/**
 * What the page's main button does.
 *
 * The research is consistent that one prominent action beats several,
 * and this market makes the choice of action matter: a great many
 * clinics are booked on WhatsApp, and a "Book an Appointment" button
 * that opens a form is then the wrong answer. So the clinic picks both
 * the words and the behaviour.
 */
export const CTA_ACTIONS = [
  { key: "call", label: "Call the clinic", hint: "Dials the clinic's phone number. Works on every phone." },
  { key: "whatsapp", label: "Open WhatsApp", hint: "Opens a chat with the clinic's number, with a message ready to send." },
  { key: "queue", label: "Show the live queue", hint: "Sends them to the waiting-room display, so they can see how busy it is." },
  { key: "directions", label: "Get directions", hint: "Opens the clinic's location in a map app." },
  { key: "none", label: "No main button", hint: "The hero shows no button at all." },
] as const;
export type CtaAction = (typeof CTA_ACTIONS)[number]["key"];

export interface SectionConfig {
  key: string;
  enabled: boolean;
  /** Replaces the section's built-in heading. Blank keeps the default. */
  heading?: string;
  /** One of SECTION_VARIANTS for this key. */
  variant?: string;
}

export interface SiteDesign {
  font: FontKey;
  density: DensityKey;
  corners: CornerKey;
  heroVariant: string;
  /** The hero's one-line value statement. Falls back to the tagline. */
  heroHeadline?: string;
  cta: {
    action: CtaAction;
    /** The button's words. Blank uses a sensible default per action. */
    label?: string;
    /** Prefilled WhatsApp message. */
    message?: string;
  };
  /** Show a second, quieter button beside the main one. */
  secondaryCta: boolean;
}

export const DEFAULT_DESIGN: SiteDesign = {
  font: "clean",
  density: "comfortable",
  corners: "soft",
  heroVariant: "centred",
  cta: { action: "call" },
  secondaryCta: true,
};

export const DEFAULT_SECTIONS: SectionConfig[] = SECTION_KEYS.map((key) => ({ key, enabled: true }));

const has = <T extends { key: string }>(list: readonly T[], key: unknown): boolean =>
  typeof key === "string" && list.some((x) => x.key === key);

/**
 * Normalises stored design JSON into something the page can render.
 *
 * Unknown keys are dropped and out-of-range values replaced rather than
 * trusted: this JSON is written by an API and read by the code that
 * renders a page patients act on, so a hand-edited row must not be able
 * to produce a layout that does not exist.
 *
 * Also the migration path. A clinic that saved before any of this
 * existed has no design row at all and resolves to the defaults, which
 * are the layout it is already being served.
 */
export function resolveDesign(stored: unknown): SiteDesign {
  const d: SiteDesign = { ...DEFAULT_DESIGN, cta: { ...DEFAULT_DESIGN.cta } };
  if (!stored || typeof stored !== "object") return d;
  const s = stored as Record<string, unknown>;

  if (has(FONT_PAIRINGS, s.font)) d.font = s.font as FontKey;
  if (has(DENSITIES, s.density)) d.density = s.density as DensityKey;
  if (has(CORNERS, s.corners)) d.corners = s.corners as CornerKey;
  if (has(SECTION_VARIANTS.hero ?? [], s.heroVariant)) d.heroVariant = s.heroVariant as string;

  if (typeof s.heroHeadline === "string" && s.heroHeadline.trim()) {
    // Long enough for the plain-language sentence the research
    // recommends, short enough that it cannot become a paragraph in the
    // one place a visitor looks first.
    d.heroHeadline = s.heroHeadline.trim().slice(0, 160);
  }
  if (typeof s.secondaryCta === "boolean") d.secondaryCta = s.secondaryCta;

  if (s.cta && typeof s.cta === "object") {
    const c = s.cta as Record<string, unknown>;
    if (has(CTA_ACTIONS, c.action)) d.cta.action = c.action as CtaAction;
    if (typeof c.label === "string" && c.label.trim()) d.cta.label = c.label.trim().slice(0, 40);
    if (typeof c.message === "string" && c.message.trim()) d.cta.message = c.message.trim().slice(0, 300);
  }

  return d;
}

/**
 * Normalises the section list: the clinic's order, unknown keys dropped,
 * and any section it never mentioned appended with its defaults.
 *
 * That last part matters on every release. A section added to this list
 * later must appear for clinics that saved before it existed, rather
 * than silently never rendering for them.
 */
export function resolveSections(stored: unknown): SectionConfig[] {
  if (!Array.isArray(stored)) return DEFAULT_SECTIONS.map((s) => ({ ...s }));

  const out: SectionConfig[] = [];
  const seen = new Set<string>();

  for (const raw of stored) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.key !== "string") continue;
    if (!SECTION_KEYS.includes(r.key as SectionKey) || seen.has(r.key)) continue;
    seen.add(r.key);

    const variants = SECTION_VARIANTS[r.key as SectionKey];
    out.push({
      key: r.key,
      enabled: r.enabled !== false,
      heading: typeof r.heading === "string" && r.heading.trim() ? r.heading.trim().slice(0, 80) : undefined,
      variant: variants && has(variants, r.variant) ? (r.variant as string) : undefined,
    });
  }

  for (const s of DEFAULT_SECTIONS) {
    if (!seen.has(s.key)) out.push({ ...s });
  }

  return out;
}

/** The default words for a call to action, when the clinic has not set its own. */
export function defaultCtaLabel(action: CtaAction): string {
  switch (action) {
    case "call": return "Call the clinic";
    case "whatsapp": return "Message us on WhatsApp";
    case "queue": return "See how busy we are";
    case "directions": return "Get directions";
    default: return "";
  }
}
