# Decision: the website editor's renderer

**Status:** decided — build the C++/WebGL editor.
**Date:** 19 October 2026.
**Decided by:** the owner, against the recommendation recorded below.

## The question

The website builder currently edits a document and renders real DOM. Should
it instead be rebuilt the way Figma is built — a C++ core compiled to
WebAssembly, drawing to a GPU canvas?

## What the two kinds of tool actually do

These are not the same problem, and the difference is the whole decision.

**Figma draws to a canvas** — a C++ core compiled to WebAssembly with a
custom WebGL renderer, since moved to WebGPU, [architected "more like a game
engine than a traditional web
application"](https://madebyevan.com/figma/webassembly-cut-figmas-load-time-by-3x).
It does that because it is a drawing tool for arbitrary vectors, where the
browser's layout engine is the wrong tool. The price is that a canvas holds
shapes with no meaning — nothing in it knows "this is a button" — which is
why Figma-to-code is approximate rather than exact.

**Website builders render DOM.** [Wix's own
documentation](https://support.wix.com/en/article/site-performance-your-sites-dom-order)
describes the published site as ordinary DOM whose order follows the editor's
visual arrangement. Webflow, Framer and Builder.io work the same way. There
is no convert-to-code step because there is nothing to convert: the editor
and the published page render the same document. Wix moved *further* in this
direction — Editor X was [a deliberate shift from absolute pixel positioning
toward real CSS layout](https://www.s9-consulting.com/post/editor-x).

A website's output *is* DOM. That is the asymmetry: Figma's canvas renders
something that was never going to be HTML, while this editor renders
something that must be.

## What we have today

`apps/clinic-web/src/lib/canvas-doc.ts` and its editor: ~2,300 lines, free
absolute positioning, drag, eight-handle resize, snapping, undo/redo,
per-breakpoint layouts, 103 passing geometry tests. The preview is an iframe
of the real public page; the handles are drawn in the parent. Nothing is
measured, because the document holds the geometry — so the editor and the
published page cannot disagree.

## The costs a GPU renderer carries here

Four, in order of how much they hurt.

**1. Text, in twelve scripts.** The public site publishes in Hindi, Marathi,
Bengali, Telugu, Tamil, Gujarati, Kannada, Malayalam, Punjabi, Odia, Urdu
and Assamese. Scripts whose glyphs change shape depending on their
neighbours — Devanagari, Tamil, Arabic — require real shaping, which in
practice means [HarfBuzz](https://en.wikipedia.org/wiki/HarfBuzz); [bidi is
a separate layer](https://en.wikipedia.org/wiki/Complex_text_layout) and an
RTL flag does not provide it, which Urdu needs. The documented failure is
text drawn codepoint-by-codepoint arriving [unjoined for Devanagari and
Arabic](https://github.com/sammycage/lunasvg/issues/279). A project that
wrote its own shaper found its [Devanagari conjuncts diverging from
HarfBuzz](https://github.com/BuLEEto/Runa). Getting this wrong renders a
patient's own language incorrectly on their doctor's website.

**2. Accessibility has to be rebuilt by hand.** A canvas has one focusable
element and a near-empty accessibility tree. Figma's answer was to render
[hidden DOM elements behind the canvas mirroring the scene
graph](https://www.figma.com/blog/building-accessibility-into-a-canvas-based-product/),
with an internal accessibility tree and coalesced announcements. So the
rewrite does not escape the DOM — it ends up maintaining a second, worse one
alongside the renderer.

**3. Two renderers will disagree.** If the editor paints with WebGL and
patients are served DOM, every divergence in font fallback, line breaking,
subpixel metrics or `object-fit` is a preview that lies. The current
architecture's single real virtue is that the editing surface *is* the
published page.

**4. Opportunity cost.** One paying clinic, a solo engineer, a $4–6/month
VPS, price undecided. The renderer is invisible to the doctor; what is
visible is picking an image, starting from a template, and knowing what to
do first.

## What a GPU renderer would actually buy

Sixty frames per second with thousands of objects, smooth infinite-canvas
zoom, and true vector editing. A clinic page holds roughly ten to forty
blocks. The DOM does that at sixty frames per second without help.

## Decision

Build it, as the owner has directed, with one constraint that is not
negotiable: **the published page stays DOM.** The GPU renderer is for the
editing surface; an HTML exporter remains the publishing path. Without that,
the product loses SEO, accessibility and the per-clinic language support that
is already shipped and already sold.

## Consequences accepted

- A text pipeline — shaping, bidi, line breaking, glyph atlas — for twelve
  scripts, or the editor renders some clinics' languages wrong.
- A mirror DOM for assistive technology, built and maintained by hand.
- Two renderers to keep in agreement, forever, with a visual-diff harness as
  the only thing standing between them and silent drift.
- An Emscripten/CMake toolchain in a repo that has none, and a second
  language in a one-engineer codebase.
- Months during which the editor is no better for the doctor than the one
  that shipped on 19 October 2026.

## What would make this clearly right

Any one of these changes the arithmetic, and none is true today:

- pages routinely holding several hundred blocks, where DOM hit-testing and
  handle layout measurably stall;
- true vector or freehand drawing on the page, which DOM cannot express;
- real-time multiplayer editing, where a shared scene graph starts paying;
- the editor becoming the product sold, rather than the clinic's website.

## Revisit when

A profile of the shipped DOM editor shows interaction latency above ~100ms
at a page size real clinics actually build. Until there is such a profile,
the renderer is not the bottleneck — and the decision above is a bet on a
problem this product has not yet got.
