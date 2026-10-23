#!/usr/bin/env node
/**
 * Measure every portal screen at phone widths, signed in.
 *
 *   node scripts/audit-responsive.mjs
 *
 * ── Why this and not a look ─────────────────────────────────────────
 *
 * The obvious responsive faults in this app were fixed by reading the
 * Tailwind classes, and a second pass over them now finds nothing: every
 * multi-column grid carries a breakpoint and every table sits in an
 * overflow-x-auto. The faults that are left are the ones static analysis
 * cannot see, because they come from content — a long patient name, a UHID,
 * a drug with a 40-character composition — pushing a box wider than the
 * phone it is on.
 *
 * Those only exist once the page has real data in it, which means signing
 * in, which is why this drives a browser rather than grepping.
 *
 * It uses @nayaverse/overflow, which sets the viewport with device metrics
 * rather than a window size. That matters here: Chrome on Windows cannot
 * open a window narrower than about 494px, so a "390px" screenshot is a
 * desktop layout with its right-hand side cut off — which is how this app
 * once had a layout "fixed" for a bug that did not exist.
 */

import { analyse, explain, COLLECT_SOURCE, CdpSession } from '@nayaverse/overflow';

const API = process.env.CLINIC_API ?? 'http://127.0.0.1:4100';
const WEB = process.env.CLINIC_WEB ?? 'http://localhost:5176';
const EMAIL = process.env.CLINIC_EMAIL ?? 'doctor@wellnessclinic.local';
const PASSWORD = process.env.CLINIC_PASSWORD ?? 'dev-pass-12345';
const WIDTHS = (process.env.WIDTHS ?? '320,360,390,414,768').split(',').map(Number);

/** Every screen behind the login, with the route the portal uses. */
const SCREENS = [
  ['Dashboard', '/'],
  ['Queue', '/queue'],
  ['Patients', '/patients'],
  ['Requests', '/requests'],
  ['Reminders', '/reminders'],
  ['Analytics', '/analytics'],
  ['Pharmacy', '/pharmacy'],
  ['Labs', '/labs'],
  ['Billing', '/billing'],
  ['Expenses', '/expenses'],
  ['Audit log', '/audit'],
  ['Website builder', '/website'],
  ['Settings', '/settings'],
  ['Staff', '/staff'],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const signIn = async () => {
  const res = await fetch(`${API}/api/clinic/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`sign-in failed: HTTP ${res.status}`);
  const { token } = await res.json();
  if (!token) throw new Error('sign-in returned no token');
  return token;
};

const main = async () => {
  const token = await signIn();
  const session = await CdpSession.open({
    endpoint: process.env.CDP_ENDPOINT ?? 'http://127.0.0.1:9222',
  });

  const rows = [];
  try {
    for (const width of WIDTHS) {
      await session.setViewport(width, 900);

      for (const [name, route] of SCREENS) {
        // The token has to be in localStorage before the app boots, or it
        // redirects to /login and we measure the login screen fourteen
        // times. Set on a cheap page first, then navigate for real.
        await session.goto(`${WEB}/login`, 300);
        await session.evaluate(
          `localStorage.setItem('clinicAccessToken', ${JSON.stringify(token)}), true`,
        );
        await session.goto(`${WEB}${route}`, 1500);

        /*
         * Wait for the data, not for a guess at how long it takes.
         *
         * A fixed delay measured loading skeletons on all fourteen screens
         * and reported every one as clean -- the worst possible result,
         * because it is a green tick over an unmeasured app. The faults
         * being hunted are caused by content, so there is no point
         * measuring a page before its content arrives.
         *
         * Polls until the text stops growing, which is what "finished
         * rendering" actually looks like from outside.
         */
        let chars = 0;
        let stable = 0;
        for (let i = 0; i < 48; i += 1) {
          const now = await session.evaluate('document.body.innerText.length');
          // A reading under this is a shell, not a screen -- the nav alone
          // is more than this. Refusing to settle on one costs a few
          // seconds; accepting one measures an empty page and reports it
          // clean, which is how this audit first claimed fourteen healthy
          // screens while looking at skeletons.
          const plausible = now > 120;
          if (now === chars && plausible) {
            stable += 1;
            if (stable >= 6) break;
          } else {
            stable = 0;
            chars = now;
          }
          await sleep(250);
        }

        // Did we actually land on the screen, or get bounced to login?
        const landed = await session.evaluate(
          `(() => ({ path: location.pathname, chars: document.body.innerText.length }))()`,
        );
        if (landed.path === '/login') {
          rows.push({ width, name, route, status: 'NOT SIGNED IN' });
          continue;
        }
        // A screen with little text is still measured -- an empty state can
        // overflow too -- but it is flagged, because the faults being hunted
        // come from content, and a screen with no rows in it passing says
        // very little. Thresholded low: "Today's Queue / No appointments
        // today" is 97 characters and is a real screen, which an earlier
        // 200-character floor threw away as empty.
        const thin = landed.chars < 250;

        // COLLECT_SOURCE hands back the viewport and scrollWidth it saw
        // along with the measurements, and analyse wants all three -- the
        // page's own numbers rather than the ones we asked for, because a
        // zoomed or scrollbar-reduced viewport is not the width we set.
        const collected = await session.evaluate(COLLECT_SOURCE);
        const result = analyse(collected.measurements, collected.viewport, collected.scrollWidth);
        rows.push({
          width, name, route, thin,
          status: result.overflow > 0 ? 'OVERFLOW' : 'ok',
          overflow: result.overflow,
          result,
        });
        const verdict = result.overflow > 0
          ? `OVERFLOW by ${Math.round(result.overflow)}px`
          : 'ok';
        // The character count is printed so a "little data" verdict can be
        // checked rather than taken on trust. An audit that silently
        // measures loading skeletons and reports fourteen clean screens is
        // worse than no audit, and that is exactly what this did at first.
        process.stdout.write(
          `  ${String(width).padStart(4)}px  ${name.padEnd(17)} ${verdict.padEnd(22)}` +
          `${String(landed.chars).padStart(5)} chars` +
          `${thin ? '  (little data)' : ''}\n`,
        );
      }
    }
  } finally {
    await session.close();
  }

  // ── The report ──────────────────────────────────────────────────────
  console.log(`\n${'='.repeat(72)}`);
  const broken = rows.filter((r) => r.status === 'OVERFLOW');
  const skipped = rows.filter((r) => r.status !== 'ok' && r.status !== 'OVERFLOW');
  const measured = rows.filter((r) => r.status === 'ok' || r.status === 'OVERFLOW');

  if (measured.length === 0) {
    console.log('Nothing was measured. Check the API and web servers are up and the');
    console.log('credentials are right — this says nothing about the layouts.');
    process.exit(1);
  }

  // Worst width per screen, because "Billing is broken" matters more than
  // "Billing is broken at five widths".
  const byScreen = new Map();
  for (const r of broken) {
    const prev = byScreen.get(r.name);
    if (!prev || r.overflow > prev.overflow) byScreen.set(r.name, r);
  }

  if (byScreen.size === 0) {
    console.log(`No horizontal overflow on ${SCREENS.length} screens at ${WIDTHS.join(', ')}px.`);
  } else {
    console.log(`${byScreen.size} of ${SCREENS.length} screens overflow. Worst width each:\n`);
    for (const r of [...byScreen.values()].sort((a, b) => b.overflow - a.overflow)) {
      console.log(`${r.name}  (${r.route})  —  ${Math.round(r.overflow)}px past a ${r.width}px viewport`);
      for (const line of explain(r.result)) console.log(line);
      console.log('');
    }
  }

  const thinScreens = [...new Set(measured.filter((r) => r.thin).map((r) => r.name))];
  if (thinScreens.length) {
    console.log('\nMeasured, but with little data on screen, so a pass is weak evidence:');
    console.log(`  ${thinScreens.join(', ')}`);
    console.log('  Content is what pushes a box past the viewport, so these want');
    console.log('  re-running against a clinic that has real rows in it.');
  }

  if (skipped.length) {
    console.log('\nNot measured, and not evidence of anything:');
    const seen = new Set();
    for (const r of skipped) {
      const key = `${r.name}|${r.status}`;
      if (seen.has(key)) continue;
      seen.add(key);
      console.log(`  ${r.name.padEnd(17)} ${r.status}`);
    }
  }

  process.exit(byScreen.size > 0 ? 1 : 0);
};

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
