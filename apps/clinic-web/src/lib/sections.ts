/**
 * The public site's sections, named once.
 *
 * ── Why this file exists ────────────────────────────────────────────
 *
 * There were three copies of this map: one in pages/Website.tsx, one in
 * components/SiteDesigner.tsx, and a third set of wordings in
 * lib/canvas-blocks.ts. They agreed, which is exactly why nobody noticed
 * there were three -- and then `booking` was added to two of them. The
 * designer panel fell through to `?? s.key` and showed a doctor the
 * literal string "booking" in a list where everything else had a real
 * name.
 *
 * One record per section key. The keys must match the API's SECTION_KEYS
 * (apps/clinic-api/src/lib/site-design.ts), which is the authority on
 * what the page can draw; anything it does not recognise never reaches
 * the browser.
 *
 * The wording is also deliberately the same everywhere now. "About" in
 * one panel and "About the clinic" in another is a small thing that
 * makes a doctor wonder whether they are looking at the same setting.
 */

export const SECTIONS = {
  about: {
    label: 'About the clinic',
    hint: 'Your introduction. Edited in Settings → Public Website.',
    defaultHeading: 'About the clinic',
  },
  services: {
    label: 'Services',
    hint: 'What you treat. Edited in Settings.',
    defaultHeading: 'What we treat',
  },
  highlights: {
    label: 'Why patients choose us',
    hint: 'Your strongest points.',
    defaultHeading: 'What makes this clinic different',
  },
  doctors: {
    label: 'Doctors',
    hint: 'Every doctor set to appear publicly, with their real credentials.',
    defaultHeading: 'Meet your doctor',
  },
  gallery: {
    label: 'Photo gallery',
    hint: 'Photos of the clinic, managed under Photo Gallery.',
    defaultHeading: 'A look inside',
  },
  blog: {
    label: 'Health articles',
    hint: 'Your published articles, newest first.',
    defaultHeading: 'Articles from our doctors',
  },
  feedback: {
    label: 'Patient feedback',
    hint: 'The private form, and only feedback you explicitly publish.',
    defaultHeading: 'Your experience',
  },
  queue: {
    label: 'Live queue link',
    hint: 'Invites patients to check how busy the clinic is.',
    defaultHeading: 'Live queue',
  },
  faq: {
    label: 'Questions and answers',
    hint: 'Common questions. Edited in Settings.',
    defaultHeading: 'Frequently asked',
  },
  booking: {
    label: 'Appointment requests',
    hint: 'A short form for patients. Requests arrive under Requests, and nothing is booked without you.',
    defaultHeading: 'Ask for an appointment',
  },
  contact: {
    label: 'Contact and map',
    hint: 'Address, phone, email, and the map if you set one.',
    defaultHeading: 'Get in touch',
  },
} as const satisfies Record<string, { label: string; hint: string; defaultHeading: string }>;

export type SectionKey = keyof typeof SECTIONS;

/** Display order for a clinic that has never reordered anything. Mirrors
 *  the API's own default so the two cannot disagree about what a fresh
 *  site looks like. */
export const SECTION_ORDER = Object.keys(SECTIONS) as SectionKey[];

/**
 * A section's name, for a key that may have come from stored config.
 *
 * Takes `string` rather than `SectionKey` on purpose: the caller is
 * usually iterating a saved array, and a key from an older or newer
 * version of the API is a real possibility. Falling back to the key
 * itself is what produced the "booking" bug, so this falls back to
 * something a person can read instead.
 */
export function sectionLabel(key: string): string {
  return SECTIONS[key as SectionKey]?.label ?? 'Unrecognised section';
}

export function sectionHint(key: string): string {
  return SECTIONS[key as SectionKey]?.hint ?? '';
}

/**
 * The heading the public page uses when the clinic has not set one.
 *
 * Read out of PublicClinic's own `heading(key, fallback)` calls, so the
 * builder can show a doctor what the section will actually be called
 * rather than the words "Built-in heading" eleven times in a column --
 * which answered the one question that row raises with nothing.
 *
 * Duplicated from the page rather than imported from it, because the page
 * resolves these through the translation layer at render time and the
 * builder only needs the English. If a default changes on the page, change
 * it here too; the placeholder being slightly stale is a far smaller
 * problem than the builder pulling in the whole i18n stack.
 */
export function sectionDefaultHeading(key: string): string {
  return SECTIONS[key as SectionKey]?.defaultHeading ?? '';
}

/** True when the page knows how to draw this key at all. */
export function isKnownSection(key: string): key is SectionKey {
  return key in SECTIONS;
}
