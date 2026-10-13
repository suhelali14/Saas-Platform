"""Checks every COPY source in the Dockerfile against the real build
context, applying .dockerignore the way Docker does (last matching rule
wins, `!` re-includes).

Cannot replace `docker build`, but it catches the failure this Dockerfile
is most likely to have: a COPY whose source does not exist, or exists but
is excluded by .dockerignore. Both abort the build, and both are invisible
until you run it.
"""
import io
import os
import re
import fnmatch
import sys

# Repo root, two levels up from scripts/.
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCKERFILE = os.path.join(ROOT, 'deploy', 'docker', 'Dockerfile')
IGNOREFILE = os.path.join(ROOT, '.dockerignore')


def load_ignore():
    rules = []
    if not os.path.exists(IGNOREFILE):
        return rules
    for line in io.open(IGNOREFILE, encoding='utf-8'):
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        negate = line.startswith('!')
        if negate:
            line = line[1:].strip()
        rules.append((negate, line.rstrip('/')))
    return rules


def is_ignored(path, rules):
    """Docker semantics: every rule is tested, the LAST match decides."""
    path = path.replace(os.sep, '/')
    # Strip a leading "./" as a PREFIX. lstrip('./') strips those as a
    # character set, which turns ".mcp.json" into "mcp.json" and makes
    # every dotfile rule look like it is not matching.
    if path.startswith('./'):
        path = path[2:]
    ignored = False
    for negate, pattern in rules:
        pat = pattern.replace(os.sep, '/')
        hit = False
        # `**` spans path segments; fnmatch's `*` already crosses `/`,
        # which is close enough for the patterns in use here.
        if fnmatch.fnmatch(path, pat) or fnmatch.fnmatch(path, pat + '/*'):
            hit = True
        if pat.endswith('/**') and path.startswith(pat[:-3] + '/'):
            hit = True
        # A rule naming a directory covers everything beneath it.
        if not hit and fnmatch.fnmatch(path, pat.rstrip('/*') + '/*'):
            hit = True
        if hit:
            ignored = not negate
    return ignored


rules = load_ignore()
src = io.open(DOCKERFILE, encoding='utf-8').read()

# Join line continuations so multi-line COPYs parse as one.
src = re.sub(r'\\\s*\n\s*', ' ', src)

problems = []
checked = 0

for raw in src.split('\n'):
    line = raw.strip()
    if not line.upper().startswith('COPY '):
        continue
    # Skip stage-to-stage copies: their source is another image's
    # filesystem, where .dockerignore does not apply.
    if '--from=' in line:
        continue

    parts = line[5:].split()
    parts = [p for p in parts if not p.startswith('--')]
    if len(parts) < 2:
        continue
    sources, dest = parts[:-1], parts[-1]

    for s in sources:
        if s == '.':
            continue
        checked += 1
        full = os.path.join(ROOT, s.replace('/', os.sep))
        exists = os.path.exists(full)
        ignored = is_ignored(s, rules)

        if not exists:
            problems.append('MISSING   %s  (COPY would fail: no such file in context)' % s)
        elif ignored:
            problems.append('IGNORED   %s  (exists, but .dockerignore excludes it -> COPY fails)' % s)
        else:
            print('  ok       %s' % s)

print('\nChecked %d COPY source(s) from the build context.' % checked)

# Things that must NOT reach the image.
print('\nSecrets and PHI must be excluded:')
must_exclude = [
    'apps/clinic-api/.env',
    'apps/provider-api/.env',
    'apps/clinic-api/uploads',
    'apps/api/uploads',
    '.mcp.json',
    'node_modules',
    '.git',
]
for p in must_exclude:
    present = os.path.exists(os.path.join(ROOT, p.replace('/', os.sep)))
    ign = is_ignored(p, rules)
    status = 'excluded' if ign else '*** NOT EXCLUDED ***'
    note = '' if present else '  (not present locally)'
    print('  %-28s %s%s' % (p, status, note))
    if present and not ign:
        problems.append('LEAK      %s would be sent to the Docker daemon' % p)

# Manifests npm ci needs.
print('\nWorkspace manifests reaching the build:')
members = []
for base in ('apps', 'packages'):
    d = os.path.join(ROOT, base)
    if os.path.isdir(d):
        for name in sorted(os.listdir(d)):
            mf = '%s/%s/package.json' % (base, name)
            if os.path.exists(os.path.join(ROOT, mf.replace('/', os.sep))):
                members.append(mf)

copied = set()
for raw in src.split('\n'):
    if raw.strip().upper().startswith('COPY ') and '--from=' not in raw:
        for tok in raw.split():
            if tok.endswith('package.json'):
                copied.add(tok)

for m in members:
    ok = m in copied
    print('  %-46s %s' % (m, 'copied' if ok else '*** NOT COPIED -> npm ci will fail ***'))
    if not ok:
        problems.append('LOCKFILE  %s is a workspace member but is never copied' % m)

# THE RULE: `npm ci` runs postinstall for EVERY workspace member, so
# whatever a postinstall READS has to be in the build context before the
# install line -- not merely present in the repository, and not supplied
# by the `COPY . .` that comes afterwards. One member's missing input
# fails the whole install, including for an app this image never runs.
#
# This started life checking only Prisma schemas, after a missing schema
# killed a build 33 seconds in. That was too specific: clinic-web's
# postinstall is `node scripts/ensure-shell.mjs`, its scripts/ directory
# was not copied, and npm ci died with ERR_MODULE_NOT_FOUND 42 seconds
# in -- having passed this guard. So it now derives what each postinstall
# needs rather than knowing about one tool, and checks ORDER, which the
# schema version never did.
print('\nPostinstall inputs reaching the context before `npm ci`:')
import json

lines = src.split('\n')

# Everything a postinstall needs must be copied above this line.
npm_ci_at = None
for i, raw in enumerate(lines):
    s = raw.strip()
    if s.upper().startswith('RUN ') and re.search(r'\bnpm ci\b', s):
        npm_ci_at = i
        break

if npm_ci_at is None:
    problems.append('DOCKERFILE no `RUN npm ci` line found, so postinstall inputs cannot be checked')
    npm_ci_at = len(lines)

# COPY sources that land in the image before the install runs.
early = []
for raw in lines[:npm_ci_at]:
    s = raw.strip()
    if not s.upper().startswith('COPY ') or '--from=' in s:
        continue
    toks = [t for t in s[5:].split() if not t.startswith('--')]
    if len(toks) < 2:
        continue
    for t in toks[:-1]:
        if t != '.':
            early.append(t.rstrip('/'))


def copied_early(rel):
    """Is this repo-relative path inside something COPYed before npm ci?"""
    rel = rel.replace(os.sep, '/')
    for s in early:
        if rel == s or rel.startswith(s + '/'):
            return True
    return False


# What a postinstall reads: any path-shaped token it names, plus a Prisma
# schema when it shells out to prisma without naming one.
PATHISH = re.compile(r'[A-Za-z0-9_.\-/]+\.(?:mjs|cjs|js|ts|sh|json|prisma)')

for mf in members:
    d = os.path.dirname(mf)
    try:
        pkg = json.load(io.open(os.path.join(ROOT, mf.replace('/', os.sep)), encoding='utf-8'))
    except Exception:
        continue
    postinstall = (pkg.get('scripts') or {}).get('postinstall') or ''
    if not postinstall.strip():
        continue

    needs = ['%s/%s' % (d, t.lstrip('./')) for t in PATHISH.findall(postinstall)]
    if 'prisma' in postinstall and not any(n.endswith('.prisma') for n in needs):
        needs.append('%s/prisma/schema.prisma' % d)

    if not needs:
        print('  %-26s reads nothing local  (%s)' % (d, postinstall))
        continue

    for rel in needs:
        if not os.path.exists(os.path.join(ROOT, rel.replace('/', os.sep))):
            print('  %-26s %-40s *** NOT ON DISK ***' % (d, rel))
            problems.append('POSTINSTALL %s runs `%s` but %s does not exist' % (d, postinstall, rel))
        elif not copied_early(rel):
            print('  %-26s %-40s *** NOT COPIED BEFORE npm ci ***' % (d, rel))
            problems.append(
                'POSTINSTALL %s runs `%s`, which reads %s -- not in the context before `npm ci`, so the install fails'
                % (d, postinstall, rel))
        elif is_ignored(rel, rules):
            print('  %-26s %-40s *** .dockerignored ***' % (d, rel))
            problems.append('POSTINSTALL %s needs %s but .dockerignore excludes it' % (d, rel))
        else:
            print('  %-26s %-40s ok' % (d, rel))

if problems:
    print('\n%d PROBLEM(S):' % len(problems))
    for p in problems:
        print('  ' + p)
    sys.exit(1)

print('\nAll checks passed.')
