/**
 * The three values the owner must fill in before this site goes live.
 *
 * There is no lead backend and building one to hold six fields would be the
 * wrong thing: this market replies on WhatsApp. The enquiry form composes the
 * message and hands it over, with phone and email as fallbacks. Nothing is
 * posted anywhere and nothing is stored, which is also the honest answer to
 * "what happens to what I type here".
 *
 * Until these are set, `contactReady` is false and the form says so rather
 * than handing a visitor a button that silently goes nowhere.
 *
 * Not `as const`: frozen as literals, `phone: ''` narrows to the type `''` and
 * every `contact.phone && ...` branch becomes unreachable.
 */
type Contact = {
  /** Digits only, with country code, no plus. e.g. "919876543210" */
  whatsapp: string;
  /** Display and tel: form. e.g. "+91 98765 43210" */
  phone: string;
  /** e.g. "hello@nayaversse.in" */
  email: string;
  /** Shown as the placeholder in the enquiry form's City field. */
  city: string;
};

export const contact: Contact = {
  whatsapp: '917558436263',
  phone: '+91 75584 36263',
  email: '',
  city: 'Sangli',
};

export const contactReady = Boolean(contact.whatsapp || contact.phone || contact.email);

/**
 * The founder, as search engines should know him. `alternateName` carries
 * the spellings people actually type for his name, so each of them leads to
 * the same person and this site. `sameAs` lists profiles that are his; add
 * each one as it exists (X, Instagram, LinkedIn, YouTube, GitHub). Those links
 * are how Google ties the person on this site to the person on those sites.
 */
export const founder = {
  name: 'Suhelali Pakjade',
  alternateName: ['Suhel Ali Pakjade', 'Suhelali Shakil Pakjade', 'Suhel Ali', 'Suhelali'],
  jobTitle: 'Founder',
  homeLocation: 'Sangli, Maharashtra, India',
  sameAs: ['https://www.linkedin.com/in/suhelali-pakjade-0842b9226/'] as string[],
};

/**
 * Google Search Console ownership check (URL-prefix property, "HTML tag"
 * method): paste only the content="..." value Google shows. Empty means no
 * tag is written. Safe to leave in place after verifying; removing it later
 * un-verifies the property.
 */
export const googleSiteVerification = '';

export const site = {
  domain: 'www.nayaversse.in',
  url: 'https://www.nayaversse.in',
} as const;

/**
 * Studio, the company's video product, linked from the footer -- but only
 * once it is live. Set at build time (the STUDIO_URL repository variable,
 * passed as VITE_STUDIO_URL by the static deploy); unset, nothing renders,
 * so a visitor is never sent to a domain that does not answer yet.
 */
export const studioUrl: string | null = (import.meta.env.VITE_STUDIO_URL as string | undefined)?.trim() || null;
