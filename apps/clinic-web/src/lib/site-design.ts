/**
 * Turns a clinic's chosen design into what the page needs to render it.
 *
 * The vocabulary itself lives in the API, which is what guarantees the
 * editor can only offer layouts the page draws. This file is the other
 * half: given a resolved design, the fonts to load and the classes to
 * apply.
 *
 * Classes rather than inline styles, because Tailwind's own spacing and
 * radius scales are what the rest of the page is built from — a density
 * setting that fought them would produce a page where half the gaps
 * responded and half did not.
 */

export type SiteDesign = {
  font: string;
  density: string;
  corners: string;
  heroVariant: string;
  heroHeadline?: string;
  cta: { action: string; label?: string; message?: string };
  secondaryCta: boolean;
};

export type SectionConfig = {
  key: string;
  enabled: boolean;
  heading?: string;
  variant?: string;
};

export const FALLBACK_DESIGN: SiteDesign = {
  font: 'clean',
  density: 'comfortable',
  corners: 'soft',
  heroVariant: 'centred',
  cta: { action: 'call' },
  secondaryCta: true,
};

/**
 * The type pairings, mirroring the API's list.
 *
 * Duplicated deliberately and narrowly: the page has to know the family
 * names to load them, and a network round trip to discover its own font
 * would mean the page renders in a fallback face and then reflows. The
 * API remains the authority on which keys are valid — anything it does
 * not recognise never reaches here.
 */
const FONTS: Record<string, { heading: string; body: string; google: string }> = {
  clean: {
    heading: '"Inter"', body: '"Inter"',
    google: 'Inter:wght@400;500;600;700',
  },
  classic: {
    heading: '"Lora"', body: '"Inter"',
    google: 'Lora:wght@500;600;700&family=Inter:wght@400;500;600',
  },
  warm: {
    heading: '"Nunito"', body: '"Nunito Sans"',
    google: 'Nunito:wght@600;700&family=Nunito+Sans:wght@400;600',
  },
  formal: {
    heading: '"IBM Plex Sans"', body: '"IBM Plex Sans"',
    google: 'IBM+Plex+Sans:wght@400;500;600',
  },
};

const STACK = 'ui-sans-serif, system-ui, -apple-system, sans-serif';

/** Vertical rhythm. The section padding, which is most of the page's feel. */
const DENSITY: Record<string, string> = {
  comfortable: 'py-16 sm:py-20',
  compact: 'py-10 sm:py-12',
  airy: 'py-20 sm:py-28',
};

/** Corner radius, as the three scales the page uses. */
const CORNERS: Record<string, { card: string; button: string; chip: string }> = {
  soft: { card: 'rounded-xl', button: 'rounded-xl', chip: 'rounded-lg' },
  sharp: { card: 'rounded-none', button: 'rounded-none', chip: 'rounded-none' },
  pill: { card: 'rounded-3xl', button: 'rounded-full', chip: 'rounded-full' },
};

export type Styling = {
  /** For a <link> to Google Fonts, or null for a system stack. */
  fontHref: string | null;
  bodyFont: string;
  headingFont: string;
  section: string;
  card: string;
  button: string;
  chip: string;
};

export function styling(design: SiteDesign): Styling {
  const font = FONTS[design.font] ?? FONTS.clean!;
  const corners = CORNERS[design.corners] ?? CORNERS.soft!;
  return {
    fontHref: `https://fonts.googleapis.com/css2?family=${font.google}&display=swap`,
    // The system stack always follows, so a page whose fonts never
    // arrive is still laid out in something sensible rather than in a
    // serif default that looks like a broken stylesheet.
    bodyFont: `${font.body}, ${STACK}`,
    headingFont: `${font.heading}, ${STACK}`,
    section: DENSITY[design.density] ?? DENSITY.comfortable!,
    card: corners.card,
    button: corners.button,
    chip: corners.chip,
  };
}

/**
 * Loads the chosen webfont once.
 *
 * Appended rather than written into index.html, because one static page
 * is served to every clinic and the font is a per-clinic choice. Keyed
 * on the href so switching fonts in the builder's live preview replaces
 * the link instead of stacking them up.
 */
export function useWebFont(href: string | null): void {
  if (typeof document === 'undefined' || !href) return;
  const id = 'clinic-webfont';
  const existing = document.getElementById(id) as HTMLLinkElement | null;
  if (existing?.href === href) return;
  const link = existing ?? document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = href;
  if (!existing) document.head.appendChild(link);
}

/**
 * What a section is called.
 *
 * The clinic's wording wins over the built-in translation. A practice
 * that calls its services "Treatments we offer" should be able to say
 * so, and the default is a reasonable phrase rather than the only one.
 */
export function sectionHeading(
  sections: SectionConfig[],
  key: string,
  fallback: string,
): string {
  return sections.find((s) => s.key === key)?.heading?.trim() || fallback;
}

/** Which layout a section was set to, or its default. */
export function sectionVariant(
  sections: SectionConfig[],
  key: string,
  fallback: string,
): string {
  return sections.find((s) => s.key === key)?.variant || fallback;
}

export type CtaTarget = { label: string; href: string; external: boolean } | null;

/**
 * Where the page's main button goes.
 *
 * Returns null when the action cannot work — no phone number recorded,
 * no map link — rather than rendering a button that does nothing. A dead
 * primary call to action is worse than none, because it is the one thing
 * a visitor is most likely to press.
 *
 * WhatsApp is here because in this market it is how a clinic actually
 * gets booked, and a "Book an Appointment" button opening a form is
 * often the wrong answer.
 */
export function ctaTarget(
  design: SiteDesign,
  clinic: { phone?: string | null; mapUrl?: string | null },
  queueHref: string,
): CtaTarget {
  const label = design.cta.label?.trim();
  const digits = (clinic.phone ?? '').replace(/[^\d]/g, '');

  switch (design.cta.action) {
    case 'call':
      if (!digits) return null;
      return { label: label || 'Call the clinic', href: `tel:${clinic.phone}`, external: false };

    case 'whatsapp': {
      if (!digits) return null;
      // wa.me wants the full international number with no punctuation.
      // A ten-digit Indian number is assumed to be +91, which is what a
      // clinic here will have typed.
      const intl = digits.length === 10 ? `91${digits}` : digits;
      const text = design.cta.message?.trim();
      return {
        label: label || 'Message us on WhatsApp',
        href: `https://wa.me/${intl}${text ? `?text=${encodeURIComponent(text)}` : ''}`,
        external: true,
      };
    }

    case 'queue':
      return { label: label || 'See how busy we are', href: queueHref, external: false };

    case 'directions':
      if (!clinic.mapUrl) return null;
      return { label: label || 'Get directions', href: clinic.mapUrl, external: true };

    default:
      return null;
  }
}
