/**
 * Tier 1 — Clinic plan.
 *
 * The daily OPD flow in a single-doctor clinic: the doctor signs in, the
 * queue sorts itself with triage priority, one patient's consultation is
 * walked through end to end, the patient's day-by-day history is shown
 * from the patient profile, and the printed documents the clinic hands
 * out are composed and billed. The order follows a real morning: who is
 * next, what do they need, what was done, what did it cost.
 */
import { tokenFor, goto, glideTo, clickWith, typeInto, beat, spotlight } from '../lib.mjs';

const doctor = await tokenFor('doctor@demo.nayaverse.in');
const reception = await tokenFor('reception@demo.nayaverse.in');

/** A helper for a scene definition: id, caption, run(session). */
const scene = (id, caption, run, { token = doctor } = {}) => ({ id, caption, token, run });

export default {
  tierLabel: 'Clinic',
  title: 'Clinic plan',
  subtitle: 'The single-doctor OPD, from the queue to the printed bill',
  outroTitle: 'Clinic plan',
  outroSubtitle: 'Running in Sangli today. Every part demonstrated here is in production.',

  sections: [
    { at: 'overview',        title: 'The day at a glance', lede: 'The overview card and the queue that sorts itself.' },
    { at: 'open-encounter',  title: 'The consultation',   lede: 'Vitals, case sheet, prescription and certificate against one visit.' },
    { at: 'patient-detail',  title: 'The patient record', lede: 'Every visit to this patient, day by day.' },
    { at: 'billing-list',    title: 'Billing and the day', lede: 'The invoice, the payment and the day close.' },
    { at: 'website',         title: 'The clinic online',   lede: 'The patient site, built from the portal.' },
  ],

  scenes: [
    scene('overview', 'The overview card | Follow-ups due, booking requests and today\'s queue in one place',
      async ({ page }) => { await goto(page, '/'); await beat(3200); }),

    scene('queue-today', 'The queue today | The declared priority outranks the order people arrived in',
      async ({ page }) => {
        await goto(page, '/queue');
        await beat(2500);
        // The queue uses "Open" / "Call in" buttons rather than anchor tags.
        const call = page.getByRole('button', { name: /Call in|Open/i }).first();
        await spotlight(page, call, 2500);
      }),

    scene('queue-triage', 'Antenatal, child, senior patients are ranked ahead | The desk stops arbitrating turns',
      async ({ page }) => {
        await goto(page, '/queue');
        await beat(2000);
        // Any one of the real reasons shows the priority ordering: the
        // demo has a 39-week antenatal check that outranks arrival order.
        const marker = page.getByText(/Antenatal|Pregnan|Priority|39 weeks/i).first();
        await spotlight(page, marker, 3000);
      }),

    scene('open-encounter', 'Starting a consultation | Vitals, case sheet, prescription — all on one screen',
      async ({ page }) => {
        await goto(page, '/queue');
        await beat(1000);
        const call = page.getByRole('button', { name: /^Open$/ }).first();
        await clickWith(page, call);
        await beat(2500);
      }),

    scene('case-sheet', 'The case sheet | Chief complaint, examination, diagnosis and follow-up on the record',
      async ({ page }) => {
        await goto(page, '/queue');
        await beat(1000);
        const open = page.getByRole('button', { name: /^Open$/ }).first();
        await clickWith(page, open);
        await beat(1500);
        const btn = page.getByRole('button', { name: /Case [Ss]heet/ }).first();
        await clickWith(page, btn);
        await beat(2200);
      }),

    scene('prescription', 'The prescription | Autocomplete off a 2,46,000-medicine Indian database',
      async ({ page }) => {
        await goto(page, '/queue');
        await beat(1000);
        const open = page.getByRole('button', { name: /^Open$/ }).first();
        await clickWith(page, open);
        await beat(1500);
        const rx = page.getByRole('button', { name: /Prescription/ }).first();
        await clickWith(page, rx);
        await beat(2500);
        const search = page.locator('input[placeholder*="medicine" i], input[placeholder*="drug" i], input[placeholder*="search" i]').first();
        if (await search.count().catch(() => 0)) await typeInto(page, search, 'parac', { perChar: 90 });
        await beat(2000);
      }),

    scene('certificate', 'A fitness or sick-leave certificate | Autofilled; printed to letterhead in a click',
      async ({ page }) => {
        await goto(page, '/queue');
        await beat(1000);
        const open = page.getByRole('button', { name: /^Open$/ }).first();
        await clickWith(page, open);
        await beat(1500);
        const cert = page.getByRole('button', { name: /Certificate/ }).first();
        await clickWith(page, cert);
        await beat(3200);
      }),

    scene('patient-detail', 'Opening a patient\'s record | The one place every visit is on one screen',
      async ({ page }) => {
        await goto(page, '/patients');
        await beat(1000);
        const first = page.locator('a[href^="/patients/"]:not([href$="/patients"])').first();
        await clickWith(page, first);
        await beat(2500);
      }),

    scene('day-by-day', 'Each visit, day by day | Diagnosis, medicines, tests and bill, every visit as one card',
      async ({ page }) => {
        const header = page.getByRole('heading', { name: /Visits, day by day/i }).first();
        if (await header.count()) {
          await header.scrollIntoViewIfNeeded();
          await beat(1200);
          const firstDay = page.locator('ol li').first();
          if (await firstDay.count()) await spotlight(page, firstDay, 3200);
        } else {
          await beat(3000);
        }
      }),

    scene('lab-order', 'Ordering a test from the visit | Results come back on the same day card',
      async ({ page }) => {
        await goto(page, '/labs');
        await beat(3200);
      }),

    scene('billing-list', 'The billing desk | Today\'s invoices, each ready to settle',
      async ({ page }) => {
        await goto(page, '/billing');
        await beat(2800);
      }, { token: reception }),

    scene('billing-invoice', 'One invoice | Lines, discounts, part payments and the receipt',
      async ({ page }) => {
        await goto(page, '/billing');
        const first = page.locator('button:has-text("Priya"), button:has-text("Ramesh"), button:has-text("Rohit")').first();
        if (await first.count()) await clickWith(page, first);
        await beat(3500);
      }, { token: reception }),

    scene('daily-close', 'The daily close | What came in by cash, UPI and card',
      async ({ page }) => {
        await goto(page, '/billing');
        const closing = page.getByRole('button', { name: /Daily Closing|Daily Close/i }).first();
        if (await closing.count()) await clickWith(page, closing);
        await beat(3200);
      }, { token: reception }),

    scene('audit', 'The access log | Who read or changed which record, and when',
      async ({ page }) => {
        await goto(page, '/audit');
        await beat(3200);
      }),

    scene('website', 'The clinic\'s own website | Twelve languages, your sections, server-rendered',
      async ({ page }) => {
        await goto(page, '/website');
        await beat(3500);
      }),

    scene('website-preview', 'The patient-facing site | A clean address patients can share',
      async ({ page }) => {
        await goto(page, '/clinic');
        await beat(3500);
      }),
  ],
};
