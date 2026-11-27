#!/usr/bin/env node
/**
 * Put a realistic morning queue on the deployed demo for the story video.
 * Only demo-multispecialty, only its made-up patients, wiped by the nightly
 * reset. Walk-ins are created in arrival order, so the screenshot shows the
 * queue re-ordering them by priority rather than by who came first.
 *   node scripts/demo-video/reel/seed-demo-queue.mjs
 */
const API = 'https://demo-multispecialty.api.nayaverse.in/api/clinic';
const login = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'doctor@demo.nayaverse.in', password: 'nayaverse-demo' }) });
const { token } = await login.json();
const H = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
const DOCTOR = 'cmwhzurs30000pg0vpx580ag2'; // Meera Kulkarni
const ARRIVALS = [
  ['cmwj6vek8000jmq0vpjmi28vb', 'GENERAL', 'Fever and body ache, 2 days'],        // Rohit Chavan
  ['cmwj6vejr000gmq0vh1h09hvt', 'GENERAL', 'Thyroid follow-up'],                  // Kavita Gaikwad
  ['cmwj6vejb000emq0vjlgg65gn', 'GENERAL', 'Cough, 5 days'],                      // Sneha Patil (sulfa allergy)
  ['cmwj6vej1000dmq0vdcxnmyus', 'CHILD', 'Ear pain since last night'],            // Aarav Kale, 7
  ['cmwj6veic000bmq0vvxgts1vc', 'SENIOR_CITIZEN', 'BP review'],                   // Ramesh Joshi, 64 (penicillin allergy)
  ['cmwj6veis000cmq0vinmg2sw1', 'PREGNANT', 'Antenatal visit'],                   // Priya Shinde
  ['cmwj6vejj000fmq0v783b08tu', 'EMERGENCY', 'Chest pain since morning'],         // Vikram More
];
const out = {};
for (const [patientId, priority, reason] of ARRIVALS) {
  const r = await fetch(`${API}/appointments/walk-in`, { method: 'POST', headers: H, body: JSON.stringify({ patientId, doctorId: DOCTOR, priority, reason }) });
  const j = await r.json().catch(() => ({}));
  const a = j.appointment ?? j;
  out[patientId] = a.id;
  console.log(r.status, priority.padEnd(15), a.id ?? JSON.stringify(j).slice(0, 160), a.status ?? '');
  await new Promise(res => setTimeout(res, 700)); // distinct arrival times
}
console.log(JSON.stringify(out));
