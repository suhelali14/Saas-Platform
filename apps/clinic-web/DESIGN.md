# Clinic Portal — Design System

Written for: engineers and designers working on `apps/clinic-web`.

This is a working spec, not aspiration. Last revised 9 November 2026,
when the portal moved to the Nayaverse look shared with Growth. Where the current code disagrees
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

### The Nayaverse look

The portal shares its visual world with Nayaverse Growth: warm paper,
near-black ink and one amber. It is a tool used all day at a front desk
in daylight, so **light is the default** and dark is a warm-dark option
for an evening clinic. Both come from the same palette.

The tokens are CSS variables (HSL triplets) in `src/index.css`, mapped to
Tailwind in `tailwind.config.js`. Dark sits on `:root` and light under
`:root.theme-light` only because the portal was written dark-first;
`ThemeContext` decides which applies. **Use the tokens, never a hex.**
The public patient site is excluded: it keeps each clinic's own palette
and typeface (`lib/site-design.ts`).

| Purpose | Class | Light | Dark |
|---|---|---|---|
| Page ground | `bg-background` | paper `42 36% 95%` | `40 8% 8%` |
| Panel, row, card | `bg-card` | warm white `43 100% 99%` | `40 7% 11%` |
| Selected, quiet fill | `bg-accent` | tan `40 32% 89%` | `40 6% 18%` |
| Text | `text-foreground` | ink `45 8% 10%` | `40 25% 93%` |
| Secondary text | `text-muted-foreground` | `39 10% 38%` | `40 10% 66%` |
| Lines | `border-border/15`, `/10` for dividers | strong warm brown, thinned | |
| Main action | `bg-primary` | **ink** | **amber** |

Every text token clears 4.5:1 on both the page ground and the card in its
theme.

**One strong button per screen, or per row.** In light the main action is
an ink button, as in Growth; amber is kept for what needs noticing. A
queue with four equal "Call in" buttons says nothing about who is next,
so only the first in each doctor's line gets the strong one.

### Semantic colour carries meaning. Never decorate with it.

One class per meaning, defined in `index.css` (`.tone-*`): the tint is
derived from the ink, so the pair cannot drift.

| Class | Means |
|---|---|
| `tone-danger`, `text-ink-danger` | Allergy, emergency, destructive, failure |
| `tone-warning`, `text-ink-warning` | Needs attention: a long wait, money owed, a result awaited |
| `tone-success`, `text-ink-success` | Done: vitals recorded, paid |
| `tone-info` | Informational, the Child priority |
| `tone-pink` | The Pregnant priority |
| `tone-neutral` | Absence of a state: cancelled, inactive |

A red mark on this product means *clinical risk*. Never use red for a
neutral count or an accent; the moment red becomes decorative, the
allergy banner stops working.

**Priority colours are fixed** and shared through `lib/categories.ts`:
Emergency red, Pregnant pink, Senior amber, Child blue, General none.

### Visual weight follows exception, not norm

The **default state should be quiet; the exception should be loud.** A list
of ten sections that are all "Shown" with ten green badges gives the eye
nowhere to rest and makes the one Hidden row invisible. Invert it: Shown is
muted text, Hidden is an amber chip. On the queue, an ordinary wait is
plain text and a wait over 30 minutes turns amber; only an emergency row
gets a red edge.

> **Was a real bug.** The Website builder shipped with nine emerald "Shown"
> badges dominating the screen. Fixed in `Website.tsx`.

---

## 3. Typography

Two families, both self-hosted through `@fontsource` (no network request
to a font CDN):

- **IBM Plex Sans** for everything (`font-portal`, applied by the
  `.portal` class on the shell and the sign-in page). Its Devanagari
  companion is loaded too, so a patient's name typed in Marathi or Hindi
  sits on the same line height as one in English.
- **Barlow Condensed**, semibold, uppercase, for page titles only
  (`font-display`). Every `h1` inside `#main` gets it automatically from
  `index.css`; do not restyle page titles per screen. Token numbers on the
  queue use it too, because they are read across a room.

| Role | Style |
|---|---|
| Page title | `<h1>` inside `#main`. Nothing else needed. |
| Section heading | `text-[16px] font-semibold`, sentence case, with a muted count: "Waiting · 4" |
| Body | 15px (set on `.portal`) |
| Row meta, hints | `text-[13px] text-muted-foreground` |
| Labels on fields | `text-[13px] font-medium`, above the field, never a placeholder |
| Floor | 11px. Nothing smaller. |

**No small-caps eyebrows** above headings, and no database constants on
screen: "With the doctor", not "IN_PROGRESS"; "Did not come", not
"NO_SHOW".

Figures that line up (times, amounts, tokens) use `tabular-nums`.

**Inputs are exempt on touch devices.** `theme.css` forces every input to
16px under `@media (pointer: coarse)`: below that, iOS Safari zooms the
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

Grouped by job, as in Growth, and filtered by role so each person sees
only what they use:

| Group | Items | Who |
|---|---|---|
| (first, no caption) | Queue, Overview, Booking requests, Follow-ups due | Everyone; booking requests for the front desk |
| Patients | All patients | Everyone |
| Clinical | Lab orders, Pharmacy | Pharmacy for pharmacist, doctor, admin |
| Money | Billing, Expenses, Reports | Billing roles; Reports also for admins |
| Clinic | Website, Staff, Settings, Audit log | Website and audit log for admins |
| Open in a new tab | Waiting-room screen, Clinic website | Everyone |

The active item is a tan ground with ink text, never a solid colour bar.
The clinic's own name is the mark, in condensed capitals.

Below `md`: top bar + slide-over drawer, ≥44px targets, closes on
navigate / Escape / backdrop, body scroll-locked while open.
At `md`+: fixed 240px sidebar, `sticky top-0`, independently scrollable.

### The queue and the patient record

- **Queue** is one list in the order the day runs: with the doctor,
  waiting (in triage order, with token, place in that doctor's line, time
  waited and an estimate), booked and not here yet, seen, and a collapsed
  cancelled/did-not-come group. Each row has one obvious next step; the
  rest sits behind the row's menu.
- **Tokens** are given at check-in, one sequence a day for the whole
  clinic, never reissued (`clinic-api/src/lib/queue.ts`).
- **The wait estimate** is the middle consultation length among today's
  finished visits, and is not shown until there are three
  (`lib/queue-time.ts`). Rounded to five minutes: a wait stated to the
  minute is a promise.
- **Walk-in** takes a name, phone or file number in one box; Enter picks
  the first match; a new patient is three fields. A phone already in the
  register is pointed out before a duplicate is made.
- **The patient record** shows one card per day: why they came, vitals,
  diagnosis, medicines, tests, certificates and the bill. Allergies sit
  above everything. "At a glance" answers when they were last here, what
  they were last given, and whether anything is owed.

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
