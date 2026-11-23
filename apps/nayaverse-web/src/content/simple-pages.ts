/**
 * The shape and content of the secondary pages (/about, /features,
 * /security, /why-nayaversse, per-plan pages, /stories, /blog). Each
 * follows the same template so the renderer is one component.
 *
 * These are copy, not product truth: edits here never change what the
 * software does. The claims that MUST match the product (plan tiers,
 * module lists, prices) live in structure.ts and the fares array in
 * each locale, and are enforced by scripts/prerender.mjs.
 *
 * Why in one file per locale: it is a lot of prose. Keeping it beside
 * the other translations in en.ts / hi.ts / mr.ts would push those
 * files past comfortable reading length and slow every edit.
 */

export interface SimpleSection {
  heading: string;
  body: string[];
}

export interface SimplePageContent {
  title: string;
  lede: string;
  sections: SimpleSection[];
  cta: { label: string; href: string };
}

/** All eleven secondary pages that use the same renderer. */
export interface SimplePages {
  about: SimplePageContent;
  /** The founder's own page: the one a search for his name should land on. */
  founder: SimplePageContent;
  features: SimplePageContent;
  security: SimplePageContent;
  whyNayaversse: SimplePageContent;
  forClinics: SimplePageContent;
  forPolyclinics: SimplePageContent;
  forHospitals: SimplePageContent;
  forMultiSpecialty: SimplePageContent;
  stories: SimplePageContent;
  blog: SimplePageContent;
}
