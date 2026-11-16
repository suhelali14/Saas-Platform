# Demo videos — what is in each one

Four MP4 files, one per tier of the clinic plan. Each one is a walk through
the real portal doing real work, with branded title cards, captions, and
section headings. 1440×900, H.264 + AAC, 30 fps. The narration is a script
beside the file; play the videos muted and read the script, or hand it to
somebody with a microphone.

Everything here was captured against the same demo data the live checks
use: a single-doctor clinic that has grown into a multi-specialty hospital
with every module switched on. The data resets every morning; the videos
were recorded from the snapshot available on the day of the render.

| Tier         | File                 | Length   | Narration
|---           |---                   |---       |---
| Clinic       | `clinic.mp4`         | ~1:40    | `../narration/clinic.md`
| Polyclinic   | `polyclinic.mp4`     | ~1:50    | `../narration/polyclinic.md`
| Hospital     | `hospital.mp4`       | ~1:45    | `../narration/hospital.md`
| Multi-specialty | `multi.mp4`      | ~1:55    | `../narration/multi.md`

## What each tier covers, in order

**Clinic.** Overview, the queue (triage ordering, an emergency jumping
ahead), opening a consultation, the case sheet, the prescription with the
2.46-lakh-row Indian medicine database, the certificate, the patient
record day by day, lab orders, the invoice and daily close, the access
log, and the clinic's own website.

**Polyclinic.** On top of Clinic: a second doctor on the roster and the
switch into their queue, the staff list, the pharmacy desk with FEFO
dispensing, the expense ledger and the profit and loss, booking requests,
reports, and the patient site in Hindi and Marathi.

**Hospital.** On top of Polyclinic: departments and service points, the
cashier opening and closing the counter, the bed board with admission
flowing into the running bill flowing into one discharge invoice, the
operation theatre list, and the insurance desk with pre-auth → submit →
settle ageing.

**Multi-specialty.** On top of Hospital: a government-scheme claim with
its package list, the radiology worklist and a report, the nursing ward
list, the specialty records engine showing a pregnancy, a fertility
couple and a growing child, and the form library an admin edits.

## Known limits

- No spoken narration. The Windows voices available here are robotic and
  would make the videos look cheap. The script per tier is tight enough to
  read over the video at a normal pace.
- No AI-generated marketing images. The title cards use the portal's own
  look (cream background, amber accent, condensed display face) so they
  read as part of the product.
- A scene whose elements are not on the screen that moment is recorded
  anyway — the caption still plays, the portal is shown, and the render
  continues. Scenes that depend on the demo data (an emergency triage row,
  Fatima's antenatal card, Meghna and Rahul's fertility record) all
  render because the demo seed carries them.

## Re-rendering

The local stack has to be up (Postgres on 54341, Redis on 6380, API on
4100 with CLINIC_PLAN=ENTERPRISE, web on 5176). Then:

```sh
node scripts/demo-video/render-tier.mjs <tier>
```

Each tier takes 4–7 minutes end to end on this machine.
