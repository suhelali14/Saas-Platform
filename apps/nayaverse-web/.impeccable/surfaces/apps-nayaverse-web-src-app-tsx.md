---
version: 1
slug: "apps-nayaverse-web-src-app-tsx"
primary_target: "apps/nayaverse-web/src/App.tsx"
related_targets: ["apps/nayaverse-web/src/sections","apps/nayaverse-web/src/content","apps/nayaverse-web/src/index.css"]
---

# Surface: nayaverse.in — the company's own site

**Scope and mode.** `apps/nayaverse-web`. Six prerendered pages: home and
pricing in English, हिन्दी and मराठी, plus a 404 per language. Visitor mode:
**Persuade**. This is Nayaverse's own site, not a clinic's. A clinic's public
site is a different surface with the opposite instincts and is unaffected.

**Audience and job.** An owner of a small Indian business — clinic, kirana,
salon, gym, restaurant, coaching class — usually on a phone, usually in the
gap between customers. They have been sold software before. In order, they
want: what does it cost, does it fit how my trade actually runs, does it work
on the machine I have, and whose data is it.

**Action.** One: an enquiry that reaches the founder, carrying the business's
own particulars. It composes a prefilled WhatsApp message and degrades to
phone and email. No lead backend exists; the destination is three values in
`src/content/contact.ts` that the owner must supply.

**Proof that is real.** The triaged OPD queue; 2,46,000 Indian medicines; a
document composer with pre-printed-stationery support; 12 Indian languages on
a clinic's patient site; one Postgres database per clinic; an append-only
DPDP/NABH access log; and `apps/api`'s 22 business types with catalogue,
orders, stock, bookings, billing and customers behind them.

**Constraints that bind every edit.**
- One live business: a clinic in Sangli. It is not named without consent.
- No testimonial, logo wall, customer count, uptime figure, benchmark,
  certification or press. **No percentage anywhere** — there is no measurement
  to cite, and the build fails if one appears.
- NMC prohibits patient testimonials, so none can ever appear here.
- `BUILDING` is not "available". The platform's records cover those trades;
  the per-trade screens are next-phase work. The build counts the status cells
  and fails if a row is flipped.
- ₹3,000 and ₹50,000 are the owner's figures. **₹12,000 is an assumption**
  awaiting confirmation.
- हिन्दी and मराठी are first drafts and **not yet reviewed by a native
  speaker**. The owner is from Sangli and should read them before promoting.

## Direction contract

**THESIS.** A queue is a list of named people in order, where a declared
priority outranks the order they arrived in — which is what Indian civic
transit print has always been for. This surface is a chart board: the product
shown as the record it keeps, read the way this audience already reads a chart
pasted beside a coach door. It refuses the SaaS landing page — gradient hero,
a screenshot tilted in a browser frame, a logo wall, three equal pricing
cards, a testimonial rail — and it refuses that page's indie-mono opposite.
The form also solves the hardest honesty problem on the site: twenty-three
trades where one is in production cannot go on a page as a feature grid
without lying, and a chart with a status column can.

**OWN-WORLD.** Ground is dark steel-blue, faintly ribbed like coach cladding,
with real voids between sections. On it sit laminated panels in hairline steel
frames: warm cream chart paper, punched along one edge, ruled in faded
red-brown. Ink near-black. Status in a fixed monospaced cell grid — green for
live, amber for building, dashed grey for waitlist, saturated red for the
priority marker, violet for the date stamp, one amber lamp on the row being
served. The destination board is matte black with oversized condensed painted
caps. Barlow Condensed (Khand for Devanagari) for board lettering, IBM Plex
Sans (Plex Sans Devanagari) for prose, IBM Plex Mono with true tabular figures
for every chart row. No icon in a circle, no card with a soft shadow, no
rounded pill, no coloured border down one side. With all content removed it is
still recognisably a frame of ruled panels on steel.

**STORY.** The visitor understands within one screen that this is one system
covering the whole working day, that it costs from ₹3,000, and — from three
counts on the board — exactly how much of it is real. They find their own
trade on the service chart and read its status. They come to believe it
because the chart below is the real product behaving: a priority patient
inserting above the general rows, a status resolving cell by cell. They act at
the enquiry counter, having already found their row in the fare chart.

**FIRST VIEWPORT.** Steel ground. A thin top rail: wordmark as a small painted
plate at left; nav plates, the three-language switcher and the enquiry action
at right. Centre, a matte-black destination board, bolted, wider than every
panel below it. On its left the route strip, then the oversized headline set
flush, then one lede paragraph. On its right, behind a rule: three ruled lines
giving Live / Building / Waitlist with their counts, then the fare from
₹3,000, then the walkthrough action and the engraved secondary. The board's
lower edge sits above the fold so the cream service-chart panel starts
in-viewport.

**FORM.** The coach-side chart board — a laminated reservation chart in a
steel frame under a painted destination board. Position 4 of 7 on the ordered
grounded list (prescription pad, bahi-khata ledger, hand-painted clinic
signboard, **reservation chart**, pharmacy strip packaging, OPD token board,
government form). seed:36b9ed0773b25092

Raises taken from challengers it beat or declined, each named for its donor:
- *Split-flap concourse (competitive):* a status change cascades character by
  character inside fixed cells, and a waiting row restyles without breaking
  the grid.
- *Jacquard brocade (declined):* full traceability between levels — a chart
  row expands in place to the record beneath it at the same legibility, never
  a modal screenshot.
- *Cloud quarry (declined):* sectional construction with genuine voids; deep
  dark gutters between panels rather than one continuous ruled field.
- *Emergency signal (declined):* one genuinely live element, so the page is
  current rather than printed once — the chart's running clock.
- *Movida cover (declined):* the nerve to break the grid once. Discharged by
  the destination board being wider than every panel beneath it. An earlier
  version pushed the headline's first line past the board's edge; at every
  width that read as a margin that had slipped rather than paint over an edge,
  and the most important line on the site is the wrong place to spend it.
- *Ebru floated pigment (declined):* motion comes from the material — rules
  rule themselves in, stamps press, cells flip. No float-and-fade anywhere.

**Memorable moment.** An emergency walks in while you are reading, and the
clinic chart re-ranks it above everyone waiting and behind the person already
with the doctor. Only the Live tab moves; a design that animates is pretending
to be a product.

**Honest risk.** Bureaucratic print is one notch of craft away from looking
like an ugly government form. It survives on hairline rule weights, true
tabular figures, generous panel padding and a warm paper tone rather than
grey. In Devanagari it survives on leading and tracking, which Latin settings
destroy.

**Unresolved.** The middle fare. The three contact values. Native review of
हिन्दी and मराठी. Whether `www` and the apex move to this app's own Vercel
project; today they serve clinic-web.

**FINISH.** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
