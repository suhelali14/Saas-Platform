// Tests the REAL compiled resolveTenant, not a reimplementation of it.
import { resolveTenant } from './tenant.build.mjs';

const ROOT = 'yourco.in';
let pass = 0, fail = 0;

function check(host, root, expected, note) {
  const got = resolveTenant(host, root);
  const summary = got.kind === 'tenant' ? `tenant:${got.slug}:${got.mode}` : got.kind;
  const ok = summary === expected;
  if (ok) pass++; else fail++;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${host.padEnd(34)} -> ${summary.padEnd(22)} ${ok ? '' : `expected ${expected}`} ${note ?? ''}`);
}

console.log('\n--- clinic subdomains ---');
check('acme.yourco.in',            ROOT, 'tenant:acme:public');
check('bright.yourco.in',          ROOT, 'tenant:bright:public');
check('acme.portal.yourco.in',     ROOT, 'tenant:acme:portal');
check('bright.portal.yourco.in',   ROOT, 'tenant:bright:portal');
check('dr-asif.yourco.in',         ROOT, 'tenant:dr-asif:public', '(hyphens are legal)');
check('ACME.YOURCO.IN',            ROOT, 'tenant:acme:public',    '(case-insensitive)');
check('acme.yourco.in.',           ROOT, 'tenant:acme:public',    '(trailing dot is legal DNS)');
check('acme.yourco.in:5176',       ROOT, 'tenant:acme:public',    '(port stripped)');

console.log('\n--- platform hosts, must NOT be clinics ---');
check('yourco.in',                 ROOT, 'platform', '(marketing site)');
check('www.yourco.in',             ROOT, 'platform');
check('api.yourco.in',             ROOT, 'platform');
check('console.yourco.in',         ROOT, 'platform');
check('portal.yourco.in',          ROOT, 'platform', '(bare portal, no slug)');
check('admin.yourco.in',           ROOT, 'platform');

console.log('\n--- boundary attacks, must NOT resolve as tenants ---');
check('evil-yourco.in',            ROOT, 'legacy', '(suffix lookalike)');
check('yourco.in.evil.com',        ROOT, 'legacy', '(prefix lookalike)');
check('notyourco.in',              ROOT, 'legacy');
check('a.b.acme.yourco.in',        ROOT, 'platform', '(no wildcard covers this depth)');
check('acme.dashboard.yourco.in',  ROOT, 'platform', '(only .portal. is a portal)');

console.log('\n--- custom domains keep working ---');
check('drasif.in',                 ROOT, 'legacy');
check('dashboard.drasif.in',       ROOT, 'legacy');

console.log('\n--- development ---');
check('localhost',                 ROOT, 'dev');
check('127.0.0.1',                 ROOT, 'dev');
check('clinic.localhost',          ROOT, 'dev');

console.log('\n--- no platform domain configured (single-clinic deploys) ---');
check('acme.yourco.in',            '',   'legacy', '(falls back to VITE_API_URL)');
check('anything.com',              '',   'legacy');
check('localhost',                 '',   'dev');

console.log(`\n${pass}/${pass + fail} passed${fail ? `, ${fail} FAILED` : ''}`);
process.exit(fail ? 1 : 0);
