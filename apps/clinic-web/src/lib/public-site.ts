/**
 * Shared helpers for the public-facing site (clinic page, blog).
 *
 * Kept out of the portal's `lib/api.ts` on purpose: that module attaches
 * the staff auth token to every request, and nothing on the public site
 * should ever send one. These are plain unauthenticated fetches.
 */

export const PUBLIC_API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4100/api/clinic';

/** A stored branding file (logo, doctor photo, gallery image, blog cover)
 * served through the API's single public file route. */
export function publicAsset(storagePath: string): string {
  return `${PUBLIC_API_BASE}/public/${storagePath}`;
}

export interface PublicPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content?: string;
  coverImagePath: string | null;
  tags: string | null;
  publishedAt: string | null;
  author: { name: string; qualifications?: string | null } | null;
}

export interface PublicFeedback {
  id: string;
  patientName: string | null;
  rating: number;
  comment: string | null;
  submittedAt: string;
}

export interface GalleryItem {
  id: string;
  caption: string | null;
  storagePath: string;
}

/**
 * The curated public palettes. Each is a Tailwind colour family whose 600
 * shade clears WCAG AA against white, so body text and buttons stay
 * readable whichever one the clinic picks -- the reason the API accepts a
 * named theme rather than an arbitrary hex value.
 *
 * Written as complete class strings because Tailwind's CDN build cannot
 * see dynamically concatenated names like `bg-${theme}-600`.
 */
export interface Palette {
  ring: string;      // accent text
  solid: string;     // primary button background
  solidHover: string;
  soft: string;      // tinted icon chip
  gradient: string;  // hero wash
  dot: string;
  border: string;
}

const PALETTES: Record<string, Palette> = {
  teal: {
    ring: 'text-teal-700', solid: 'bg-teal-600', solidHover: 'hover:bg-teal-700',
    soft: 'bg-teal-50', gradient: 'from-teal-50', dot: 'bg-teal-600', border: 'hover:border-teal-300',
  },
  blue: {
    ring: 'text-blue-700', solid: 'bg-blue-600', solidHover: 'hover:bg-blue-700',
    soft: 'bg-blue-50', gradient: 'from-blue-50', dot: 'bg-blue-600', border: 'hover:border-blue-300',
  },
  green: {
    ring: 'text-green-700', solid: 'bg-green-600', solidHover: 'hover:bg-green-700',
    soft: 'bg-green-50', gradient: 'from-green-50', dot: 'bg-green-600', border: 'hover:border-green-300',
  },
  indigo: {
    ring: 'text-indigo-700', solid: 'bg-indigo-600', solidHover: 'hover:bg-indigo-700',
    soft: 'bg-indigo-50', gradient: 'from-indigo-50', dot: 'bg-indigo-600', border: 'hover:border-indigo-300',
  },
  rose: {
    ring: 'text-rose-700', solid: 'bg-rose-600', solidHover: 'hover:bg-rose-700',
    soft: 'bg-rose-50', gradient: 'from-rose-50', dot: 'bg-rose-600', border: 'hover:border-rose-300',
  },
  slate: {
    ring: 'text-slate-700', solid: 'bg-slate-700', solidHover: 'hover:bg-slate-800',
    soft: 'bg-slate-100', gradient: 'from-slate-100', dot: 'bg-slate-700', border: 'hover:border-slate-400',
  },
};

export function palette(theme: string | null | undefined): Palette {
  return PALETTES[theme ?? 'teal'] ?? PALETTES.teal!;
}
