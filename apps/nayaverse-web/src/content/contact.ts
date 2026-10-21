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
  /** e.g. "hello@nayaverse.in" */
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

export const site = {
  domain: 'www.nayaverse.in',
  url: 'https://www.nayaverse.in',
} as const;
