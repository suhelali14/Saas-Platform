/**
 * The capture recipe for the Clinic-tier ad.
 *
 * One entry per voice line in ads/clinic.md's table, in the same order.
 * Each entry says what the renderer should capture while that line plays:
 *
 *   kind: 'title' | 'outro'    -- a still card, animated in
 *   kind: 'web'                -- a Playwright capture of the portal
 *     route:  the clinic-web path to navigate to
 *     target: an optional selector to ring with highlight()
 *     zoom:   an optional { scale, hold } for soft UI zoom
 *     wait:   milliseconds to sit on the page before any highlight
 *             starts -- gives data time to arrive on screen
 *
 * This file is the thing that makes an ad feel like an ad rather than a
 * walkthrough with sound: each line has one shot, targeted to the thing
 * the voice names, with a highlight that focuses the eye.
 */
export default {
  tier: 'clinic',
  // demo-clinic's API cert needs the `listen 443 ssl` block (certbot
  // --reinstall --redirect on the server); until that's done, record
  // against demo-multispecialty, which has the same routes the Clinic
  // ad shoots (/, /queue, /patients, /billing, /clinic).
  demo: 'demo-multispecialty',
  // Demo accounts were seeded under @demo.nayaverse.in (single 's') --
  // email strings, not resolved hostnames, so they stay on the old spelling.
  login: 'doctor@demo.nayaverse.in',
  outDir: 'out/_ad_clinic',
  title: { eyebrow: 'Nayaverse Clinic', main: 'The single-doctor OPD', sub: 'A clinic in Sangli, in the plan it runs on.' },
  outro: { main: 'Try it.', sub: 'nayaversse.in' },
  lines: [
    // 0 -- "A single-doctor clinic in Sangli. Thirty patients a day..."
    { kind: 'title', variant: 'opening' },
    // 1 -- "Every visit copied twice. Every follow-up a phone call..."
    { kind: 'title', variant: 'problem' },
    // 2 -- "Nayaverse runs this clinic."
    { kind: 'title', variant: 'promise' },
    // 3 -- "One screen opens the day. Follow-ups due, today's queue, who is next."
    { kind: 'web', route: '/', wait: 1800, target: '[data-testid="today-queue"], main', zoom: { scale: 1.06, hold: 4000 } },
    // 4 -- "A pregnant patient, a senior, an emergency -- the queue puts them ahead by itself."
    { kind: 'web', route: '/queue', wait: 1800, targetText: /Pregn|Emergen|Priorit|Antenatal/i, zoom: { scale: 1.1, hold: 4200 } },
    // 5 -- "A consultation on one page: vitals, case sheet, prescription, certificate..."
    { kind: 'web', route: '/queue', wait: 1800, clickButton: /^Open$/, afterClickWait: 2000, target: 'main, article', zoom: { scale: 1.04, hold: 3500 } },
    // 6 -- "Medicines from a two-lakh-forty-six-thousand-row Indian database..."
    { kind: 'web', route: '/queue', wait: 1500, clickButton: /^Open$/, afterClickWait: 1500, thenClickButton: /Prescription/i, afterClickWait: 1800, targetPlaceholder: /medicine|drug|search/i, zoom: { scale: 1.1, hold: 4200 } },
    // 7 -- "The record carries itself. Every visit, day by day, for the next doctor who opens it."
    { kind: 'web', route: '/patients', wait: 1500, clickFirst: 'a[href^="/patients/"]:not([href$="/patients"])', afterClickWait: 2000, targetText: /Visits, day by day/i, zoom: { scale: 1.05, hold: 4200 } },
    // 8 -- "Billing settles as the patient pays. Cash, UPI, card -- counted on the day's close."
    { kind: 'web', route: '/billing', wait: 1800, clickButton: /Daily Clos(e|ing)/i, afterClickWait: 1800, target: 'main', zoom: { scale: 1.05, hold: 4000 } },
    // 9 -- "The clinic's own website is built in from the first day. Twelve Indian languages..."
    { kind: 'web', route: '/clinic?lang=hi', wait: 2200, target: 'main', zoom: { scale: 1.04, hold: 4200 } },
    // 10 -- "Running in Sangli today. Every part of this ad was captured from the real product."
    { kind: 'outro', variant: 'proof' },
    // 11 -- "Nayaverse. Try the Clinic plan at nayaversse.in."
    { kind: 'outro', variant: 'cta' },
  ],
};
