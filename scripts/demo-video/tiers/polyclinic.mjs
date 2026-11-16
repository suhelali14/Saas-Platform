/**
 * Tier 2 — Polyclinic plan.
 *
 * Everything from the Clinic plan still works; this adds what a polyclinic
 * needs when several doctors share the day: a second doctor on the roster,
 * the pharmacy dispensing with batch stock and FEFO, the clinic's own
 * expenses and the profit against what came in, the patient website in
 * twelve Indian languages, visit-and-workload reports, and a public
 * booking inbox the front desk clears.
 */
import { tokenFor, goto, beat, clickWith, spotlight } from '../lib.mjs';

const doctor = await tokenFor('doctor@demo.nayaverse.in');
const doctor2 = await tokenFor('doctor2@demo.nayaverse.in');
const pharma = await tokenFor('pharmacy@demo.nayaverse.in');
const reception = await tokenFor('reception@demo.nayaverse.in');

const scene = (id, caption, run, { token = doctor } = {}) => ({ id, caption, token, run });

export default {
  tierLabel: 'Polyclinic',
  title: 'Polyclinic plan',
  subtitle: 'Several doctors, a pharmacy, the day\'s money, your website in twelve languages',
  outroTitle: 'Polyclinic plan',
  outroSubtitle: 'Carries everything the Clinic plan does, with staff accounts and the pharmacy and reports added.',

  sections: [
    { at: 'two-doctors',  title: 'Several doctors', lede: 'Each doctor sees their own queue, patients can book with one.' },
    { at: 'pharmacy',     title: 'The pharmacy',    lede: 'Batch stock dispensed first-expired first-out.' },
    { at: 'expenses',     title: 'Expenses and the P&L', lede: 'Who the money goes to, and what is left.' },
    { at: 'requests',     title: 'Booking requests', lede: 'Public enquiries land in one list for the desk.' },
    { at: 'languages',    title: 'Your website in twelve languages', lede: 'Twelve Indian languages, shipped on the clinic site today.' },
  ],

  scenes: [
    scene('two-doctors', 'Two doctors on the roster | Each sees their own patients',
      async ({ page }) => { await goto(page, '/queue'); await beat(3000); }),

    scene('switch-doctor', "A second doctor's queue", async ({ page }) => {
      await goto(page, '/queue');
      await beat(3000);
    }, { token: doctor2 }),

    scene('staff', 'The staff list | A login for every person, so the audit log names who did what',
      async ({ page }) => { await goto(page, '/staff'); await beat(3000); }),

    scene('pharmacy', 'The pharmacy desk | Every prescription waiting to be dispensed',
      async ({ page }) => { await goto(page, '/pharmacy'); await beat(3000); }, { token: pharma }),

    scene('pharmacy-fefo', 'Stock dispensed first-expired-first-out | Never from an expired batch',
      async ({ page }) => {
        await goto(page, '/pharmacy');
        await beat(1200);
        const inv = page.getByRole('button', { name: /^Inventory$/i }).first();
        await clickWith(page, inv);
        await beat(3200);
      }, { token: pharma }),

    scene('expenses', 'The expense ledger | Categorised, so the same cost cannot be typed three ways',
      async ({ page }) => { await goto(page, '/expenses'); await beat(3000); }, { token: reception }),

    scene('pnl', 'The profit and loss | Earnings count money received, never invoices raised',
      async ({ page }) => {
        await goto(page, '/expenses');
        await beat(1200);
        // The expenses page carries P&L as its default view when the
        // admin is signed in; the "Ledger" tab is the other side.
        const ledger = page.getByRole('button', { name: /^Ledger$/i }).first();
        if (await ledger.count().catch(() => 0)) await clickWith(page, ledger);
        await beat(3000);
      }),

    scene('requests', 'Booking requests | People who enquired on the website',
      async ({ page }) => { await goto(page, '/requests'); await beat(3000); }, { token: reception }),

    scene('reports', 'Reports | Visits over time, top diagnoses, each doctor\'s workload',
      async ({ page }) => { await goto(page, '/analytics'); await beat(3500); }),

    scene('languages', 'The public site, admin side | Sections and the clinic\'s hero image',
      async ({ page }) => { await goto(page, '/website'); await beat(3000); }),

    scene('languages-hi', 'The patient site in Hindi | Hand-translated UI, the clinic\'s own prose yours to enter',
      async ({ page }) => { await goto(page, '/clinic?lang=hi'); await beat(3500); }),

    scene('languages-mr', 'And in Marathi | Twelve Indian languages, server-rendered for search',
      async ({ page }) => { await goto(page, '/clinic?lang=mr'); await beat(3500); }),
  ],
};
