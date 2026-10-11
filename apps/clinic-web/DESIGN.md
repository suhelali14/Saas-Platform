# Clinic Portal — Design System

Written for: engineers and designers working on `apps/clinic-web`.

This is a working spec, not aspiration. Where the current code disagrees
with it, the code is wrong and should be brought here — each such gap is
marked **⚠ gap** so it can be found and closed.

---

## 1. What this product is, and why that decides everything

A clinic portal is not a SaaS dashboard. Four facts about the people using
it drive every rule below:

| Fact | What it forces |
|---|---|
| Reception works standing, on a phone, with a patient in front of them | Touch targets ≥44px. One-handed reach. Nothing important below the fold on a 375px screen. |
| A doctor is between patients, not browsing | The next action must be obvious without reading. No hunting. |
| The data is regulated PHI | An allergy must be impossible to miss. Destructive actions must be hard to trigger twice. |
| Consultations run 7–10 minutes | Every extra click is real. Density beats whitespace here, unlike a marketing page. |

**The governing rule:** *this is a tool, not a brochure.* Optimise for the
fiftieth use, not the first. Something delightful once and slow forever is
a bad trade.

The public patient site (`/clinic`) is the opposite — read once, by a
stranger, deciding whether to trust you. It has its own light, spacious
design and deliberately does **not** follow this document.

---

## 2. Colour

### Dark is the default, and why

Staff stare at this for eight hours. Dark reduces glare in a consulting
room that is often dimly lit for examinations. Light is offered
(`theme.css`) and follows the OS preference on first visit.

### Tokens

Tailwind is loaded from CDN, so these are utility classes, not CSS
variables. Use these and only these.

**Surfaces**

| Purpose | Class | Notes |
|---|---|---|
| Page ground | `bg-[#0b0d12]` | The one hardcoded hex. Everything else is an overlay on it. |
| Raised panel | `bg-white/[0.02]` | Cards, panels, list rows. |
| Input / inset | `bg-white/5` | Fields, tabs at rest. |
| Interactive rest | `bg-white/10` | Secondary buttons, chips. |
| Interactive hover | `bg-white/20` | |
| Table header | `bg-white/[0.03]` | |

**Lines**

| Purpose | Class |
|---|---|
| Panel / card border | `border-white/10` |
| Subtle divider | `border-white/5`, `divide-white/5` |

**Text** — the ramp runs light→dark as the number rises. All four clear
WCAG AA on the page ground.

| Level | Class | Use for |
|---|---|---|
| Primary | `text-white` | Headings, values, the thing being read |
| Body | `text-gray-300` | Nav labels, body copy |
| Secondary | `text-gray-400` | Descriptions, column headers |
| Muted | `text-gray-500` | Hints, timestamps |
| Faint | `text-gray-600` | Placeholders, disabled |

Do not invent `text-gray-700` or lower — it fails contrast on `#0b0d12`.

### Semantic colour carries meaning. Never decorate with it.

| Colour | Means | Classes |
|---|---|---|
| **Emerald** | Primary action, success, "active" | `bg-emerald-500 text-black` (solid) · `bg-emerald-500/15 text-emerald-400` (badge) |
| **Red** | Allergy, destructive, failure | `bg-red-500/10 text-red-400` |
| **Amber** | Needs attention, unreviewed, warning | `bg-amber-500/15 text-amber-400` |
| **Blue** | Nurse role, informational | `bg-blue-500/15 text-blue-400` |
| **Purple** | Pharmacist role | `bg-purple-500/15 text-purple-400` |

A red badge on this product means *clinical risk*. Never use red for a
neutral count or an accent — the moment red becomes decorative, the
allergy banner stops working.

**Patient category colours are fixed** and shared with the backend via
`lib/categories.ts` so the two cannot drift: Emergency red, Pregnant pink,
Senior amber, Child blue, General grey.

### Visual weight follows exception, not norm

The **default state should be quiet; the exception should be loud.** A list
of ten sections that are all "Shown" with ten green badges gives the eye
nowhere to rest and makes the one Hidden row invisible. Invert it: Shown is
muted text, Hidden is an amber chip.

> **Was a real bug.** The Website builder shipped with nine emerald "Shown"
> badges dominating the screen. Fixed in `Website.tsx`.

---

## 3. Typography

One family (system sans, via Tailwind default). Size *and weight* carry
hierarchy — never colour alone.

| Role | Class | Notes |
|---|---|---|
| Page title | `text-xl font-bold` | One per screen, with a lucide icon at `size={20}` in emerald |
| Section heading | `text-sm font-semibold` | Inside a panel |
| Body | `text-sm` | |
| Table cell / dense | `text-[13px]` | |
| Secondary / meta | `text-xs` | |
| Label above a field | `text-xs font-medium text-gray-400` | |
| Micro (badges, hints) | `text-[11px]` | **Floor.** Nothing smaller. |
| Uppercase micro-label | `text-[10px] uppercase tracking-wide` | Only inside dense data blocks |

**Never below 11px.** The existing `text-[10px]` uses are the absolute
limit and only for all-caps labels, which read larger than their size.

**Inputs are exempt on touch devices.** `theme.css` forces every input to
16px under `@media (pointer: coarse)` — below that, iOS Safari zooms the
viewport on focus and leaves it zoomed. That is the threshold, not a
stylistic choice; do not "fix" it.

---

## 4. Spacing and layout

### Scale

Use `1, 1.5, 2, 2.5, 3, 4, 5, 6, 8` only. Not arbitrary values.

| Context | Value |
|---|---|
| Inside a chip / badge | `px-2 py-1` |
| Inside a button (sm / md) | `px-2.5 py-1.5` / `px-4 py-2` |
| Inside a panel | `p-4` |
| Between panels | `gap-5` |
| Between a label and its field | `mb-1` |
| Table cell | `px-3 py-2` |

### Page shell

```
p-4 sm:p-6 md:p-8        ← always stepped; 24px each side on a 375px
                            phone leaves only 327px of content
max-w-3xl                ← forms and settings (reading measure)
max-w-5xl                ← lists with a couple of columns
max-w-6xl                ← side-by-side editor + preview
(none)                   ← full-width data tables
```

### Responsive rules

- **Every** `grid-cols-N` needs a breakpoint prefix. A bare `grid-cols-5`
  is 75px per field on a phone.
  - 5+ fields → `grid-cols-2 sm:grid-cols-3 md:grid-cols-5`
  - 2-field form → `grid-cols-1 sm:grid-cols-2`
  - 12-col row → `grid-cols-2 sm:grid-cols-12`, spans behind `sm:`
- Tables: wrap in `overflow-x-auto` with an explicit `min-w-[…]`.
  Horizontal scroll is acceptable; a crushed table is not.
- `<main>` needs `min-w-0`, or a wide table stretches the flex row and
  pushes the sidebar off screen.
- Sticky sidebars/previews: `lg:sticky lg:top-6`.

### Navigation

Below `md`: top bar + slide-over drawer, ≥44px targets, closes on
navigate / Escape / backdrop, body scroll-locked while open.
At `md`+: fixed 240px sidebar, `sticky top-0`, independently scrollable.

---

## 5. Components

### Button — `components/Button.tsx`

**Always use this, never a bare `<button>` for an async action.** It awaits
the promise your `onClick` returns, shows a spinner and blocks re-entry.

```tsx
<Button variant="primary" onClick={save} busyLabel="Saving…">Save</Button>
<Button variant="ghost" size="sm" onClick={() => remove(id)} aria-label="Delete" />
```

| Variant | Use |
|---|---|
| `primary` | The one main action on the screen. **At most one per view.** |
| `secondary` | Everything else |
| `ghost` | Icon-only, table row actions |
| `danger` | Destructive, when it needs to look it |

> **Was a real bug.** 136 buttons, 30 with any pending guard, zero
> spinners. Reception double-tapped "Dispense" on a slow connection and
> decremented stock twice.

### Panel

```tsx
<div className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
  <h2 className="text-sm font-semibold">Title</h2>
  <p className="text-xs text-gray-500 mb-3">One line of why this matters.</p>
  …
</div>
```

Radii: `rounded-md` chips · `rounded-lg` buttons/inputs · `rounded-xl`
panels · `rounded-2xl` public site only. No `rounded-full` except avatars
and count badges.

### Table

`overflow-x-auto` wrapper → `min-w-[…]` table → `bg-white/[0.03]` header,
`text-xs text-gray-400` → `divide-y divide-white/5` rows →
`hover:bg-white/[0.02]`. Numbers right-aligned and `whitespace-nowrap`.
Always an empty state: `colSpan` row, `text-gray-600`, says what to do
next, not just "no data".

### Form field

```tsx
<label className="block text-xs font-medium text-gray-400 mb-1">Label</label>
<input className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10
                  text-sm outline-none focus:border-emerald-400" />
<p className="text-[11px] text-gray-600 mt-1">Hint, if it earns its place.</p>
```

Never a placeholder as the only label — it vanishes on focus, exactly when
someone re-reads it.

`<select>` gets explicit `background-color` on the option elements in
`theme.css`. A native `<option>` does not inherit its parent's styling in
any browser.

> **Was a real bug.** Every dropdown rendered white-on-white: the select
> had `text-white`, the options fell back to the system white background.

### Badge

`px-1.5 py-0.5 rounded text-[10px] font-semibold` + a semantic pair from §2.

---

## 6. States — all four, every time

A screen is not done until it handles all of these.

1. **Loading** — `<Loading />` for a panel, `<Spinner />` inline, `busy` on
   a button. Never a blank screen.
2. **Empty** — say what it means and what to do. "No expenses recorded in
   this period." beats "No data".
3. **Error** — `px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-sm`,
   in plain language, near what failed. Never a raw stack or status code.
4. **Success** — `bg-emerald-500/10 text-emerald-400`, auto-clearing after
   ~2.5s. Only for something with no other visible result.

---

## 7. Accessibility

Non-negotiable, not polish.

- Every icon-only control: `aria-label`.
- Decorative icons: `aria-hidden="true"`.
- Overlays: `role="dialog"`, `aria-label`, Escape closes, focus trapped.
- Toggles: `aria-expanded`. Async buttons: `aria-busy` (Button does this).
- Contrast: AA (4.5:1) for body, 3:1 for large text. Both themes.
- Never colour alone — pair it with an icon or a word. A red badge and an
  amber badge are the same badge to ~8% of men.
- Visible focus. Never `outline-none` without `focus:border-*` replacing it.

---

## 8. Anti-patterns

| Don't | Why |
|---|---|
| Bare `grid-cols-N` | Unusable on a phone |
| Arbitrary hex outside the tokens | Breaks the light theme, which remaps by class |
| Red for anything non-clinical | Devalues the allergy banner |
| Two primary buttons on one screen | Neither is primary |
| Text below 11px | Unreadable at arm's length |
| A bare `<button>` for an async action | Double submits |
| Placeholder as the only label | Vanishes on focus |
| `text-gray-700`+ on dark | Fails contrast |
| `title` as the only hint | Never appears on touch |
| Spinner replacing rendered content | Flashes; overlay it instead |

---

## 9. Known gaps

Honest list of where the code does not yet meet this document. A design doc
that pretends the codebase already complies is worthless within a month.

**Closed**

- ~~No global focus ring~~ — `:focus-visible` now defined in `theme.css`
  for both themes. Uses `:focus-visible` not `:focus`, so a mouse click
  never leaves a ring behind (the reason blanket `outline:none` gets
  written into codebases in the first place).
- ~~Text below the 11px floor~~ — the reminder badge was 9px; now 11px.
- ~~Staff had no empty state~~ — added.
- ~~Queue and Patients capped at 896px~~ — both now `max-w-[1600px]`.
  These are scanned, not read: a queue of today'''s patients capped to half
  a monitor wastes space at the one desk that never has spare time. Forms
  stay capped, where a long measure genuinely hurts.

**Open**

- **⚠ gap** — ~117 of 127 buttons are still bare `<button>`. The
  highest-risk async actions were converted; the rest are cosmetic-only
  and pending.
- **⚠ gap** — Tables scroll horizontally on phones rather than becoming
  cards. Defensible, but Audit Log and Expenses would read better as cards.
- **⚠ gap** — Typography scale is applied by convention, not enforced. A
  shared `<Heading>`/`<Text>` would stop drift.
- **⚠ gap** — Only the Website builder and document template have live
  previews. Nothing else needs one yet, but the `DeviceFrame` component is
  general if that changes.

## 10. Checklist before merging a screen

- [ ] Works at 375px with no horizontal page scroll
- [ ] Every `grid-cols-*` has a breakpoint prefix
- [ ] Loading, empty, error and success states all handled
- [ ] Async actions use `<Button>`
- [ ] At most one `primary`
- [ ] Icon-only controls have `aria-label`
- [ ] Colours come from §2; semantic colours mean what §2 says
- [ ] No text below 11px
- [ ] Checked in **both** themes
- [ ] Tables wrapped in `overflow-x-auto` with `min-w-*`
