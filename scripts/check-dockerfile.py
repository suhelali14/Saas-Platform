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

if problems:
    print('\n%d PROBLEM(S):' % len(problems))
    for p in problems:
        print('  ' + p)
    sys.exit(1)

print('\nAll checks passed.')
