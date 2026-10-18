import type { NodeType } from './canvas-doc';

/**
 * What the palette offers, in the words a doctor would use.
 *
 * The names are the whole point of this file. A section key is `faq` and a
 * node type is `bound`; neither means anything to someone who has never
 * built a website, and a palette labelled with either is a palette nobody
 * touches. So every entry carries a plain name and a one-line "what this
 * is for", and the hint answers the question people actually have, which
 * is not "what is this" but "why would I add it".
 */

export interface PaletteItem {
  /** What gets created. */
  type: NodeType;
  /** For `bound`, which clinic content. */
  bind?: string;
  label: string;
  hint: string;
}

/** Blocks the clinic writes itself. */
export const BASIC_BLOCKS: PaletteItem[] = [
  { type: 'heading', label: 'Heading', hint: 'A short line in large type, to start a part of the page.' },
  { type: 'text', label: 'Paragraph', hint: 'A few sentences. Line breaks you type are kept.' },
  { type: 'button', label: 'Button', hint: 'Something to tap: your phone number, or a page on this site.' },
  { type: 'image', label: 'Picture', hint: 'One of the photos you uploaded under Gallery.' },
  { type: 'box', label: 'Coloured box', hint: 'A panel of colour. Put it behind other blocks to group them.' },
  { type: 'divider', label: 'Line', hint: 'A thin rule, to separate one part of the page from the next.' },
];

/**
 * Blocks whose content is the clinic's real records.
 *
 * These exist so a free canvas does not turn into a page of frozen copies.
 * A doctor could type their services into a paragraph, and then it is
 * wrong the day they add one. A `bound` block positions and styles real
 * data and updates itself.
 *
 * The keys must match the API's SECTION_KEYS exactly -- the server
 * validates against that list and ignores anything else, so a key typed
 * wrong here is a block that silently renders nothing.
 */
export const CONTENT_BLOCKS: PaletteItem[] = [
  { type: 'bound', bind: 'about', label: 'About the clinic', hint: 'The About text from your Settings.' },
  { type: 'bound', bind: 'services', label: 'Services', hint: 'What you treat. Edited in Settings.' },
  { type: 'bound', bind: 'highlights', label: 'Why patients choose us', hint: 'Your list of strong points.' },
  { type: 'bound', bind: 'doctors', label: 'Doctors', hint: 'Every doctor set to appear publicly, with their real credentials.' },
  { type: 'bound', bind: 'gallery', label: 'Photo gallery', hint: 'The photos you uploaded, as a grid.' },
  { type: 'bound', bind: 'blog', label: 'Health articles', hint: 'Your published articles, newest first.' },
  { type: 'bound', bind: 'feedback', label: 'Patient feedback', hint: 'The private feedback form, and anything you chose to publish.' },
  { type: 'bound', bind: 'queue', label: 'Live queue link', hint: 'Sends patients to the waiting-room display.' },
  { type: 'bound', bind: 'faq', label: 'Questions and answers', hint: 'Your FAQs from Settings.' },
  { type: 'bound', bind: 'booking', label: 'Appointment request form', hint: 'Patients leave a name and number; you call back to confirm.' },
  { type: 'bound', bind: 'contact', label: 'Contact and map', hint: 'Address, phone, email, and the map if you set one.' },
];

/** Short names for the content blocks, used by the inspector and the
 *  on-canvas tags. Derived so the two can never disagree. */
export const SECTION_LABELS: Record<string, string> = Object.fromEntries(
  CONTENT_BLOCKS.map((b) => [b.bind!, b.label]),
);
