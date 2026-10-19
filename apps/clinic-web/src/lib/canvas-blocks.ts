import type { NodeType } from './canvas-doc';
import { SECTIONS, SECTION_ORDER } from './sections';

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
export const CONTENT_BLOCKS: PaletteItem[] = SECTION_ORDER.map((key) => ({
  type: 'bound' as const,
  bind: key,
  label: SECTIONS[key].label,
  hint: SECTIONS[key].hint,
}));

/** Re-exported so the canvas components keep one import. The names
 *  themselves come from lib/sections.ts, which is the only place they are
 *  written down. */
export { sectionLabel } from './sections';
