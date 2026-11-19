# Billing: Service Catalogs + Episode-Based Invoicing

The current billing module ships, but the way it works is **ad-hoc** —
every line item is typed from scratch, prices are re-entered every
time, and an admitted patient's charges sit in whichever invoice
somebody happened to open that day. Two concrete gaps the owner
raised:

1. A doctor who gives an injection or dispenses from their own stock
   shouldn't retype the drug name and the price every time. They have
   **their own board** of what they charge — they should pick from it.
2. An admitted patient who comes back for a follow-up appointment
   today while still on the admission's open bill shouldn't get a
   second invoice. **One bill, many visits** until discharge.

This document is the plan. Two independent shippable changes.

---

## Change 1 — Service catalogs ("the board")

### What it is

A per-clinic (optionally per-doctor) list of billable items with a
default price. Pick one in the invoice editor, line fills in. Still
editable before save for the one-off case.

### Schema

```prisma
model ServiceItem {
  id           String   @id @default(cuid())
  /// A short code the clinic uses on paper ("CONSULT-OPD", "INJ-B12",
  /// "DRESSING-L1"). Optional; mainly useful for clinics that already
  /// have one.
  code         String?
  /// The name that lands on the bill.
  name         String
  /// Which InvoiceItemCategory this item defaults to. Can be
  /// overridden on the line when added.
  category     InvoiceItemCategory
  /// What it costs. The line item still carries its own `amount`
  /// because a one-off discount should be per-bill, not here.
  defaultPrice Decimal  @db.Decimal(10, 2)

  /// When set, this item only shows up on this doctor's board. When
  /// null, it's shared across the clinic.
  ///
  /// This is the "doctor has their own board" ask. A clinic-wide
  /// catalogue is the floor; a doctor can add their own items on
  /// top. The UI shows both merged, with the doctor's own items
  /// first.
  doctorId     String?
  doctor       ClinicUser? @relation("ServiceItemOwner", fields: [doctorId], references: [id], onDelete: SetNull)

  /// For medicines and injections, if the clinic uses pharmacy stock,
  /// a link so dispensing can decrement the batch. Null = not stocked
  /// (doctor supplies from their own, nothing to decrement).
  drugId       String?
  drug         Drug?       @relation(fields: [drugId], references: [id], onDelete: SetNull)

  isActive     Boolean  @default(true)
  sortOrder    Int      @default(0)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@unique([doctorId, name])
  @@index([category, isActive])
}
```

### Behaviour

- **Listing** `GET /service-items?doctorId=X&category=INJECTION`
  returns the doctor's own items **plus** the clinic-wide items, with
  the doctor's items first.
- **Create** `POST /service-items` — the doctor's token writes to their
  own board (doctorId auto-filled from auth). An admin can leave
  doctorId null to add a clinic-wide item.
- **On the invoice editor** — a "Pick from board" button opens a
  grouped picker. One tap adds the line. Free-text "type anything"
  stays as the escape hatch.
- **Seed on first use** — three generic items (`General consultation`,
  `Follow-up consultation`, `Dressing`) so a brand-new clinic has
  something to tap.

### Why this shape

- One table, not one-per-doctor-per-category. Scales to any number of
  doctors and categories.
- Clinic-wide + per-doctor is the right split: clinic agrees on
  consultation prices, but every doctor stocks their own injections.
- `drugId` is a thin link, not a copy. When a doctor prescribes a
  stocked item from the catalogue, FEFO dispensing kicks in; when
  they supply from their own, no stock changes.
- `defaultPrice` not `price` — a one-off discount is on the invoice,
  not on the catalogue. The board's price is a default, not a lock.

---

## Change 2 — Episode-based invoicing (one bill, many visits)

### What it is today

An invoice is implicitly per-visit. If a patient comes twice, there
are two invoices. If they're admitted and come back for a follow-up
during the stay, nobody is quite sure where the follow-up should
appear.

### What it needs to be

An **invoice has a lifecycle**:
- **OPEN** — new line items can be added; payments can land.
- **FINALIZED** — bill totals are locked; payments still accepted.
- **PAID** — full amount received.
- **VOID** — cancelled (kept for audit).

And:
- An admitted patient has **one OPEN invoice from admission to
  discharge**, into which every follow-up visit, injection, lab,
  and medicine lands.
- An OPD patient's visit creates a **new OPEN invoice** that finalizes
  at the end of the visit (or when payment is made in full).

### Schema change (additive, no breakage)

```prisma
enum InvoiceStatus {
  OPEN       // accepting new line items
  FINALIZED  // locked; still takes payments
  PAID       // fully paid (derived, kept nullable in DB)
  VOID       // cancelled; kept for audit
}

model Invoice {
  // ... existing fields
  status      InvoiceStatus @default(OPEN)
  finalizedAt DateTime?
  voidedAt    DateTime?
  voidReason  String?
}

model InvoiceItem {
  // ... existing fields
  /// Which appointment this line item belongs to. On a patient-level
  /// bill, lets the receipt group by visit date. Null = clinic
  /// dispensed outside a visit (rare, kept open).
  appointmentId String?
  appointment   Appointment? @relation(fields: [appointmentId], references: [id], onDelete: SetNull)
  /// Which ServiceItem this line came from, if picked from the board.
  /// Null = typed freehand. Kept for audit of "doctor's price went
  /// up this quarter" questions a year later.
  serviceItemId String?
  serviceItem   ServiceItem? @relation(fields: [serviceItemId], references: [id], onDelete: SetNull)
  /// When the line was added. The bill breakdown groups by appointment
  /// date, so a two-week admission reads back as "Day 1 / Day 2 / …".
  addedAt       DateTime     @default(now())
}
```

### Behaviour

**Finding the open bill:**
- `GET /patients/:id/open-invoice` — returns the one OPEN invoice,
  if any. Creates one if a patient is in an active admission and
  none exists.
- `POST /invoices/:id/items` — only allowed while OPEN.
- Appointment finalization offers "close this bill" or "keep open
  for next visit".
- Admission discharge finalizes the OPEN invoice automatically.

**On the UI side:**
- Patient Detail shows the one OPEN bill, if any, with "Add charge"
  right there. No navigating to Billing.
- Billing page gets two sections: **Open bills** and **To close
  today** (visits where the appointment ended but the invoice is
  still OPEN).
- At finalize, the system asks "any last charges?" and shows a
  summary before locking.

**The bill PDF:**
- Groups line items by date, showing each visit's charges as a
  mini-section (`Day 1 — 18 Nov: Consultation ₹500, Injection B12
  ₹200`). Already compatible with the current `drawTable` in pdf.ts;
  just needs a grouping pass.

### Why this shape

- No big refactor. `Invoice` + `InvoiceItem` stay. Four new columns,
  one new enum.
- Backwards compatible: existing invoices are all effectively OPEN
  until the migration back-fills them (we keep them PAID if they have
  payments ≥ total, else OPEN).
- The "doctor's own board" change (Change 1) and this one dovetail:
  a doctor adds an injection from their board to the patient's open
  invoice, mid-visit, without leaving the Encounter screen.
- Grouping by date on the PDF matches how hospital bills already
  look — patients read them as a visit log, not as a flat line
  dump.

---

## Order of work

1. **ServiceItem schema + API + manager UI in Settings** —
   catalogue management, standalone piece. ~1 session.
2. **"Pick from board" in the invoice editor** — the board becomes
   usable. ~1 session.
3. **InvoiceStatus + per-item appointmentId + patient-level open-
   bill API** — the plumbing for episode billing. ~1 session.
4. **Billing page redesign: Open bills / To close / Closed** — the
   receptionist / doctor view the bill in the right place. ~1
   session.
5. **PDF grouping by visit date** — the bill reads back as a
   visit log. ~1 session.

Each step ships on its own and is useful before the next lands.

---

## What this means for the owner

**Today** the owner says "it's complicated and unclear." Here's what
changes once the five steps above ship:

- Doctor opens Encounter → sees the patient → clicks "Add charge" →
  picks "Consultation ₹500" and "Vitamin B12 injection ₹200" from
  **their own board**, in two taps. Bill is created or the open bill
  is appended to. No navigating to Billing. No typing.
- Receptionist opens Billing → sees today's **open bills** and
  **bills to close** as two clear lists. One tap takes payment.
- Admitted patient's three days of charges live in one bill, grouped
  by day, and the PDF at discharge reads back clean.
- A doctor who dispenses from their own stock doesn't have to add
  the pharmacy step; the price lands on the bill, the stock on their
  side stays theirs.

**Still ad-hoc** in a healthy way:
- One-off line items can still be typed. The board is the common
  case, not the only case.
- Prices can still be overridden per bill. The board's price is a
  default.
- A bill can still be split across patients, visits reassigned,
  payments reversed with a note. Flexibility where flexibility is
  needed.

---

## Sources (research 2026-11-19)

- Hospital service catalog with billing codes (AIIMS Raipur, Narayana
  Health, RGCI): referenced via the government PDFs returned by the
  search. Treat as pattern reference, not price benchmarks.
- Max Dehradun billing policy (11am-11am IPD cycle, follow-up rules).
- MCGM 2026 Hospital Service Rate list (Mumbai tender document).
