import { z } from "zod";
import { SECTION_KEYS } from "./site-design.js";

/**
 * Validation for the free-canvas page document.
 *
 * ── Why this is strict ──────────────────────────────────────────────
 *
 * Everything in this document is authored by a clinic admin and then
 * rendered onto a page served to the public. That makes it the highest-
 * value injection target in the product: a field that reaches the page
 * unvalidated is stored XSS against every patient who visits, and the
 * clinic would never know.
 *
 * The free canvas was a deliberate product decision -- the clinic can put
 * anything anywhere, at any size, in any colour. "Free" is about LAYOUT.
 * It is not freedom to supply a URL scheme, a raw colour string or an
 * arbitrary image host, because none of those are layout and each one is
 * an attack. So the geometry is wide open and bounded only by arithmetic,
 * while every string that ends up in an attribute is narrow.
 *
 * The three that matter, and what each prevents:
 *
 *   href   must be http(s), tel:, mailto: or a same-site path. This is
 *          the real vector -- `javascript:` in an anchor is script
 *          execution with one click, and `data:text/html` is the same
 *          thing wearing a different hat.
 *   colour must be a hex literal. A free-text colour is a CSS injection
 *          point: `red; background-image: url(...)` closes the property
 *          and opens another, which is how a tracking pixel or a
 *          full-page overlay gets onto a clinic's homepage.
 *   src    must be a path under this clinic's own uploads. An arbitrary
 *          remote URL would let the page be made to beacon every visitor
 *          to a third party, which on a medical site is a disclosure that
 *          someone looked at a clinic's page.
 *
 * Text is never a vector here, because the renderer sets it as text and
 * never as HTML -- the same rule the blog already follows. It is capped
 * anyway, so one node cannot carry a megabyte of prose.
 */

/** Matches the web side's CANVAS_WIDTH. Positions are plain pixels in
 *  these coordinate spaces, so the bounds are arithmetic, not taste. */
const CANVAS_WIDTH = { desktop: 1200, mobile: 390 } as const;

/** A page taller than this is not a design decision, it is a runaway
 *  loop or a corrupt document. 40,000px is roughly forty screens. */
const MAX_PAGE_HEIGHT = 40_000;

/**
 * A cap on nodes, because the renderer draws all of them.
 *
 * 400 is far beyond any real page -- the migrated section layout produces
 * about ten -- and well under the point where the public page becomes slow
 * to paint on the mid-range Android a patient is holding.
 */
const MAX_NODES = 400;

const MAX_TEXT = 2_000;

/** `#abc` or `#aabbcc`. Deliberately not rgb()/hsl()/named colours: one
 *  shape to validate is one shape to get wrong. */
const hex = z
  .string()
  .trim()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Use a hex colour such as #0b7285");

/**
 * A link a clinic may point a button at.
 *
 * Parsed rather than pattern-matched where possible, because the
 * interesting attacks are the ones that look like a valid URL to a regex
 * and like something else to a browser -- leading whitespace, embedded
 * newlines, `java\tscript:`. An allow-list of schemes applied to the
 * PARSED protocol closes that whole family.
 */
const href = z
  .string()
  .trim()
  .max(500)
  .refine((v) => {
    // A same-site path or a pure fragment is always fine.
    if (v.startsWith("/") || v.startsWith("#")) return !v.includes("//..");
    let url: URL;
    try {
      url = new URL(v);
    } catch {
      return false;
    }
    return ["http:", "https:", "tel:", "mailto:"].includes(url.protocol);
  }, "Links must be a page on this site, or start with https://, tel: or mailto:");

/**
 * An image the clinic has uploaded.
 *
 * Restricted to this clinic's own stored paths, which is what the existing
 * public branding route serves (`/api/clinic/public/:scope/:id/:file`).
 * No scheme, no host, no `..` -- so it cannot be aimed at another clinic's
 * files or at a third-party host.
 */
const src = z
  .string()
  .trim()
  .max(300)
  .refine(
    (v) => /^[A-Za-z0-9/_.-]+$/.test(v) && !v.includes("..") && !v.startsWith("/"),
    "Pick an image you have uploaded to this clinic",
  );

const NODE_TYPES = ["heading", "text", "button", "image", "box", "divider", "bound"] as const;

/** A finite number in a sane pixel range. `z.number()` alone admits NaN
 *  and Infinity, both of which serialise into the document and then make
 *  the renderer lay out nothing at all. */
const px = (max: number) => z.number().finite().min(-max).max(max);

const geometry = z.object({
  x: px(CANVAS_WIDTH.desktop * 2),
  y: px(MAX_PAGE_HEIGHT),
  w: z.number().finite().min(1).max(CANVAS_WIDTH.desktop * 2),
  h: z.number().finite().min(1).max(MAX_PAGE_HEIGHT),
});

const nodeProps = z
  .object({
    text: z.string().max(MAX_TEXT).optional(),
    href: href.optional(),
    src: src.optional(),
    alt: z.string().max(200).optional(),
    /** Only the sections the page knows how to draw. Anything else is
     *  ignored rather than trusted -- the same rule the section list
     *  already follows, for the same reason. */
    bind: z.enum(SECTION_KEYS).optional(),
    fontSize: z.number().finite().min(8).max(200).optional(),
    fontWeight: z.number().int().min(100).max(900).optional(),
    align: z.enum(["left", "center", "right"]).optional(),
    color: hex.optional(),
    background: hex.optional(),
    radius: z.number().finite().min(0).max(400).optional(),
    padding: z.number().finite().min(0).max(200).optional(),
    lineHeight: z.number().finite().min(0.8).max(3).optional(),
  })
  .strict();

const node = z
  .object({
    id: z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/, "Bad node id"),
    type: z.enum(NODE_TYPES),
    at: z.object({ desktop: geometry, mobile: geometry }),
    pinned: z.object({ desktop: z.boolean().optional(), mobile: z.boolean().optional() }).strict().optional(),
    z: z.number().int().min(0).max(MAX_NODES),
    props: nodeProps,
  })
  .strict();

export const canvasSchema = z
  .object({
    version: z.literal(1),
    nodes: z.array(node).max(MAX_NODES),
    height: z.object({
      desktop: z.number().finite().min(100).max(MAX_PAGE_HEIGHT),
      mobile: z.number().finite().min(100).max(MAX_PAGE_HEIGHT),
    }),
    background: hex.optional(),
  })
  .strict()
  .superRefine((doc, ctx) => {
    // Two nodes sharing an id makes React's reconciliation and the
    // editor's selection disagree about which box is which, and the symptom
    // is edits landing on the wrong element.
    const seen = new Set<string>();
    for (const n of doc.nodes) {
      if (seen.has(n.id)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Duplicate node id: ${n.id}` });
        return;
      }
      seen.add(n.id);
    }
    // A `bound` node with no binding would render an empty rectangle on a
    // patient-facing page, which reads as a broken site.
    for (const n of doc.nodes) {
      if (n.type === "bound" && !n.props.bind) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "A clinic-content block has to say which content it shows",
        });
        return;
      }
    }
  });

export type CanvasDoc = z.infer<typeof canvasSchema>;

export const LAYOUT_MODES = ["sections", "canvas"] as const;
export type LayoutMode = (typeof LAYOUT_MODES)[number];

/**
 * What the public endpoint should serve.
 *
 * A clinic that has switched to 'canvas' but has no document, or whose
 * document has somehow become unreadable, falls back to 'sections'. That
 * fallback is the whole reason the section renderer is kept: the worst
 * outcome here is a patient seeing a blank page where a clinic's website
 * used to be, and a stale-but-correct page beats that every time.
 */
export function resolveLayoutMode(mode: unknown, canvas: unknown): LayoutMode {
  if (mode !== "canvas") return "sections";
  const parsed = canvasSchema.safeParse(canvas);
  if (!parsed.success || parsed.data.nodes.length === 0) return "sections";
  return "canvas";
}

/** Parse a stored document for rendering, or null if it cannot be trusted. */
export function readCanvas(value: unknown): CanvasDoc | null {
  const parsed = canvasSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
