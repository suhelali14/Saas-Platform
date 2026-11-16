/**
 * Tier 4 — Multi-specialty plan.
 *
 * Everything from the Hospital plan still works; a multi-specialty adds
 * the government-scheme desk for PM-JAY, MJPJAY, CGHS and ECHS; the
 * radiology worklist and reports; the nursing stations with the ward
 * rounds and the vitals chart; and the specialty records engine that
 * carries a pregnancy, a fertility couple, a child's growth and vaccines,
 * and every other clinic's own record shape.
 */
import { tokenFor, goto, beat, clickWith, spotlight } from '../lib.mjs';

// Six accounts are more than the sign-in rate limit allows in a minute, so
// we batch the logins: five now, wait for the window to roll, then the
// sixth. Any sign-in that trips the limit just retries after 65 seconds.
async function tokenPatient(email) {
  for (let i = 0; i < 2; i++) {
    try { return await tokenFor(email); }
    catch (e) { await new Promise((r) => setTimeout(r, 65_000)); }
  }
  return tokenFor(email);
}
const doctor = await tokenPatient('doctor@demo.nayaverse.in');
const gynae = await tokenPatient('gynae@demo.nayaverse.in');
const paeds = await tokenPatient('doctor2@demo.nayaverse.in');
const radio = await tokenPatient('radiology@demo.nayaverse.in');
const nurse = await tokenPatient('nurse@demo.nayaverse.in');
const billing = await tokenPatient('billing@demo.nayaverse.in');

const scene = (id, caption, run, { token = doctor } = {}) => ({ id, caption, token, run });

// Resolve a patient id once -- used to open the specialty views directly.
async function patientId(token, search) {
  const r = await fetch(`http://localhost:4100/api/clinic/patients?search=${encodeURIComponent(search)}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const d = await r.json();
  return d.data?.[0]?.id ?? null;
}
const fatima = await patientId(gynae, 'Fatima');
const meghna = await patientId(gynae, 'Meghna');
const ishaan = await patientId(paeds, 'Ishaan');

export default {
  tierLabel: 'Multi-specialty',
  title: 'Multi-specialty plan',
  subtitle: 'Scheme desk, radiology, nursing stations and specialty records for every specialty',
  outroTitle: 'Multi-specialty plan',
  outroSubtitle: 'Carries everything Clinic, Polyclinic and Hospital do, with scheme, imaging, nursing and specialty records added.',

  sections: [
    { at: 'scheme-claim', title: 'Government schemes', lede: 'PM-JAY, MJPJAY, CGHS and ECHS packages and claims.' },
    { at: 'radiology',    title: 'Radiology',          lede: 'The worklist, with every scan from ordered to reported.' },
    { at: 'nursing',      title: 'Nursing stations',   lede: 'Ward round list, vitals chart, medicines given.' },
    { at: 'pregnancy',    title: 'Specialty records',  lede: 'One engine for every specialty. A pregnancy, a couple, a growing child.' },
  ],

  scenes: [
    scene('scheme-claim', 'A scheme claim | MJPJAY: package, pre-auth status, documents, settlement',
      async ({ page }) => {
        await goto(page, '/claims');
        await beat(1500);
        const scheme = page.getByText(/MJPJAY|PM-JAY|CGHS|ECHS/).first();
        if (await scheme.count()) {
          const row = scheme.locator('xpath=ancestor::tr | ancestor::a').first();
          await clickWith(page, row);
        } else {
          const first = page.locator('a[href^="/claims/"]:not([href$="/claims"])').first();
          if (await first.count()) await clickWith(page, first);
        }
        await beat(3500);
      }, { token: billing }),

    scene('scheme-packages', 'The package list | Entered from the scheme\'s current circular',
      async ({ page }) => {
        await goto(page, '/claims');
        await beat(1500);
        const pkgs = page.getByRole('button', { name: /Scheme packages/i }).first();
        if (await pkgs.count()) await clickWith(page, pkgs);
        await beat(3500);
      }, { token: billing }),

    scene('radiology', 'The imaging worklist | What is waiting to be done, what is waiting to be reported',
      async ({ page }) => { await goto(page, '/radiology'); await beat(3500); }, { token: radio }),

    scene('radiology-report', 'Writing a report | Findings, impression, who reported it',
      async ({ page }) => {
        await goto(page, '/radiology');
        await beat(1500);
        const report = page.getByRole('button', { name: /Write report/i }).first();
        if (await report.count()) await clickWith(page, report);
        await beat(3500);
      }, { token: radio }),

    scene('nursing', 'The ward list | Every admitted patient, when their vitals were last charted',
      async ({ page }) => { await goto(page, '/nursing'); await beat(3500); }, { token: nurse }),

    scene('pregnancy', 'A pregnancy record | 39 weeks, every antenatal visit on the card',
      async ({ page }) => { if (fatima) { await goto(page, `/patients/${fatima}`); await beat(3800); } else { await beat(3000); } }, { token: gynae }),

    scene('antenatal-chart', 'Each visit is a row | Weight, BP, fundal height, Hb — the paper card, in data',
      async ({ page }) => {
        if (!fatima) { await beat(2500); return; }
        await goto(page, `/patients/${fatima}`);
        await beat(1500);
        const card = page.getByText(/Antenatal visit/).first();
        if (await card.count()) await card.scrollIntoViewIfNeeded();
        await beat(3000);
      }, { token: gynae }),

    scene('fertility', 'A fertility couple | Both partners on one record',
      async ({ page }) => { if (meghna) { await goto(page, `/patients/${meghna}`); await beat(3800); } else { await beat(3000); } }, { token: gynae }),

    scene('growth', 'A child\'s growth and vaccines | Birth history, every dose, growth trend',
      async ({ page }) => { if (ishaan) { await goto(page, `/patients/${ishaan}`); await beat(3800); } else { await beat(3000); } }, { token: paeds }),

    scene('forms-library', 'The form library | An admin switches forms off or adds the clinic\'s own',
      async ({ page }) => {
        await goto(page, '/settings');
        await beat(1000);
        const tab = page.getByText('Specialty forms', { exact: true }).first();
        if (await tab.count()) await clickWith(page, tab);
        await beat(3500);
      }),
  ],
};
