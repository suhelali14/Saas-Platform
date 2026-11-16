/**
 * Tier 3 — Hospital plan.
 *
 * Everything from the Polyclinic plan still works; a hospital adds the
 * desks a small hospital runs on. Departments and service points, so each
 * person sees only their own work. A cash counter the cashier opens and
 * closes, with the drawer counted. Wards and beds, admission and the
 * running bill, one final bill at discharge. The theatre list and the
 * insurance desk.
 */
import { tokenFor, goto, beat, clickWith, spotlight } from '../lib.mjs';

// Six accounts across the tier would trip the sign-in rate limit in one
// minute; retry once past the window if it is tripped.
async function tokenPatient(email) {
  for (let i = 0; i < 2; i++) {
    try { return await tokenFor(email); }
    catch { await new Promise((r) => setTimeout(r, 65_000)); }
  }
  return tokenFor(email);
}
const doctor = await tokenPatient('doctor@demo.nayaverse.in');
const admin = doctor; // same token; the demo doctor is an admin too
const nurse = await tokenPatient('nurse@demo.nayaverse.in');
const cashier = await tokenPatient('cashier@demo.nayaverse.in');
const billing = await tokenPatient('billing@demo.nayaverse.in');
const reception = await tokenPatient('reception@demo.nayaverse.in');

const scene = (id, caption, run, { token = doctor } = {}) => ({ id, caption, token, run });

export default {
  tierLabel: 'Hospital',
  title: 'Hospital plan',
  subtitle: 'Departments, cash counter, wards and beds, theatre and insurance',
  outroTitle: 'Hospital plan',
  outroSubtitle: 'Carries everything Clinic and Polyclinic do, with the hospital desks added on top.',

  sections: [
    { at: 'departments',    title: 'Departments',     lede: 'Clinical departments and the desks each person belongs to.' },
    { at: 'counter-open',   title: 'Cash counter',    lede: 'The cashier opens the drawer, takes money, closes it with a count.' },
    { at: 'ipd-board',      title: 'Inpatients',       lede: 'Bed board, admission, the running bill, one final bill at discharge.' },
    { at: 'ot',             title: 'Operation theatre', lede: 'The day list, clash-checked bookings, operation notes.' },
    { at: 'claims',         title: 'Insurance desk',   lede: 'Pre-authorisation, claims, settlements and ageing.' },
  ],

  scenes: [
    scene('departments', 'Departments | Clinical departments and the service points each person belongs to',
      async ({ page }) => { await goto(page, '/departments'); await beat(3500); }, { token: admin }),

    scene('counter-open', 'The cashier opens the counter | With the cash already in the drawer',
      async ({ page }) => { await goto(page, '/counter'); await beat(3200); }, { token: cashier }),

    scene('counter-advance', 'Advances and payments on the counter | Only they can take money on it',
      async ({ page }) => {
        await goto(page, '/counter');
        await beat(1500);
        const take = page.getByText(/Take money|Receive payment/i).first();
        if (await take.count()) await spotlight(page, take, 2500);
        else await beat(2500);
      }, { token: cashier }),

    scene('ipd-board', 'The bed board | Every ward, every bed, who is in it',
      async ({ page }) => { await goto(page, '/ipd'); await beat(3500); }, { token: nurse }),

    scene('ipd-admission', 'One admission | The running bill against the deposit, charges and room days',
      async ({ page }) => {
        await goto(page, '/ipd');
        await beat(1500);
        const taken = page.locator('a[href^="/ipd/"]:not([href$="/ipd"])').first();
        if (await taken.count()) await clickWith(page, taken);
        await beat(3500);
      }),

    scene('ipd-discharge', 'Discharge | The account becomes one final bill',
      async ({ page }) => {
        await goto(page, '/ipd');
        await beat(1500);
        const taken = page.locator('a[href^="/ipd/"]:not([href$="/ipd"])').first();
        if (await taken.count()) await clickWith(page, taken);
        await beat(1500);
        const discharge = page.getByRole('button', { name: /Discharge/i }).first();
        if (await discharge.count()) await spotlight(page, discharge, 2500);
      }),

    scene('ot', 'The theatre list | Clash-checked bookings, each by theatre',
      async ({ page }) => { await goto(page, '/ot'); await beat(3500); }),

    scene('claims', 'The insurance desk | Every claim this hospital holds, sorted by what needs doing',
      async ({ page }) => { await goto(page, '/claims'); await beat(3500); }, { token: billing }),

    scene('claim-detail', 'One claim | Pre-auth, documents, queries, settlement and deductions',
      async ({ page }) => {
        await goto(page, '/claims');
        await beat(1500);
        const first = page.locator('a[href^="/claims/"]:not([href$="/claims"])').first();
        if (await first.count()) await clickWith(page, first);
        await beat(3500);
      }, { token: billing }),

    scene('claims-ageing', 'The ageing | What payers still owe, by how long',
      async ({ page }) => {
        await goto(page, '/claims');
        await beat(1500);
        const summary = page.getByText(/Owed by payers|Ageing/i).first();
        if (await summary.count()) await spotlight(page, summary, 3000);
        else await beat(3000);
      }, { token: billing }),

    scene('counter-close', 'Closing the counter | What was counted, what was expected, what differs',
      async ({ page }) => {
        await goto(page, '/counter');
        await beat(1500);
        const close = page.getByRole('button', { name: /Close counter|Close the counter/i }).first();
        if (await close.count()) await spotlight(page, close, 3000);
        else await beat(3000);
      }, { token: cashier }),
  ],
};
