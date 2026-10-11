// The CORS matcher decides who may call the tenant directory with
// credentials. A fail-open bug here is a real cross-origin hole, so it is
// tested against the lookalikes that break hand-rolled checks.
import { isPlatformSubdomain } from './slug.build.mjs';
import { validateSlug, RESERVED_SLUGS } from './slug.build.mjs';

let pass = 0, fail = 0;
function check(label, got, want) {
  const ok = got === want;
  if (ok) pass++; else fail++;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${label.padEnd(48)} ${String(got).padEnd(6)} ${ok ? '' : `expected ${want}`}`);
}

const R = 'yourco.in';
console.log('\n--- allowed ---');
check('https://acme.yourco.in',            isPlatformSubdomain('https://acme.yourco.in', R), true);
check('https://acme.portal.yourco.in',     isPlatformSubdomain('https://acme.portal.yourco.in', R), true);
check('https://yourco.in (bare root)',     isPlatformSubdomain('https://yourco.in', R), true);

console.log('\n--- must be rejected ---');
check('https://evil-yourco.in',            isPlatformSubdomain('https://evil-yourco.in', R), false);
check('https://yourco.in.evil.com',        isPlatformSubdomain('https://yourco.in.evil.com', R), false);
check('https://notyourco.in',              isPlatformSubdomain('https://notyourco.in', R), false);
check('http://acme.yourco.in (plain http)',isPlatformSubdomain('http://acme.yourco.in', R), false);
check('garbage (unparseable)',             isPlatformSubdomain('acme.yourco.in', R), false);
check('empty origin',                      isPlatformSubdomain('', R), false);
check('null-ish origin',                   isPlatformSubdomain('null', R), false);
console.log('\n--- single-label domain must admit nothing ---');
check('localhost default vs any origin',   isPlatformSubdomain('https://evil.com', 'localhost'), false);
check('empty platform domain',             isPlatformSubdomain('https://acme.yourco.in', ''), false);

console.log('\n--- slug validation (a slug becomes a hostname) ---');
check('"acme" ok',                 validateSlug('acme').ok, true);
check('"dr-asif" ok',              validateSlug('dr-asif').ok, true);
check('"api" RESERVED',            validateSlug('api').ok, false);
check('"console" RESERVED',        validateSlug('console').ok, false);
check('"www" RESERVED',            validateSlug('www').ok, false);
check('"portal" RESERVED',         validateSlug('portal').ok, false);
check('"-acme" leading hyphen',    validateSlug('-acme').ok, false);
check('"acme-" trailing hyphen',   validateSlug('acme-').ok, false);
check('"xn--abc" punycode',        validateSlug('xn--abc').ok, false);
check('"a" too short',             validateSlug('a').ok, false);
check('"Acme" uppercase',          validateSlug('Acme').ok, false);
check('"acme.clinic" has a dot',   validateSlug('acme.clinic').ok, false);
check('64 chars too long',         validateSlug('a'.repeat(64)).ok, false);
check('63 chars ok',               validateSlug('a'.repeat(63)).ok, true);
console.log(`    (${RESERVED_SLUGS.size} reserved slugs)`);

console.log(`\n${pass}/${pass + fail} passed${fail ? `, ${fail} FAILED` : ''}`);
process.exit(fail ? 1 : 0);
