#!/usr/bin/env python
"""
Every section the API can render must have a name a person can read.

Born from a real bug. `booking` was added to SECTION_KEYS and to two of the
THREE places the browser kept section labels, and the one that was missed
fell through to `?? s.key` -- so the clinic's own site builder listed ten
sections with names and an eleventh called "booking". The doctor who
reported it could not have known that was a missing label rather than a
broken feature.

The labels now live in one file. This checks that file against the API's
list, which is the authority on what the page can actually draw, so the
next section added cannot reach a clinic unnamed.

Checked rather than trusted, because the two files are in different apps
and nothing else makes them agree.
"""
import io
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
API = os.path.join(ROOT, "apps", "clinic-api", "src", "lib", "site-design.ts")
WEB = os.path.join(ROOT, "apps", "clinic-web", "src", "lib", "sections.ts")

for path in (API, WEB):
    if not os.path.exists(path):
        print("skipped: %s is not present" % os.path.relpath(path, ROOT))
        sys.exit(0)


def read(path):
    return io.open(path, encoding="utf-8", errors="replace").read()


api_src = read(API)
block = re.search(r"export const SECTION_KEYS = \[(.*?)\] as const", api_src, re.S)
if not block:
    print("could not find SECTION_KEYS in site-design.ts -- has it been restructured?")
    sys.exit(1)
api_keys = re.findall(r'"([a-z_]+)"', block.group(1))

web_src = read(WEB)
web_block = re.search(r"export const SECTIONS = \{(.*?)\n\} as const", web_src, re.S)
if not web_block:
    print("could not find SECTIONS in sections.ts -- has it been restructured?")
    sys.exit(1)
# Top-level keys only: a nested `label:`/`hint:` is indented further.
web_keys = re.findall(r"^  ([a-z_]+): \{", web_block.group(1), re.M)

problems = []
for key in api_keys:
    if key not in web_keys:
        problems.append(
            'SECTION_KEYS has "%s" but sections.ts does not name it -- the builder '
            "would show the raw key to a clinic" % key
        )
for key in web_keys:
    if key not in api_keys:
        problems.append(
            'sections.ts names "%s" but SECTION_KEYS does not have it -- the page '
            "cannot draw it, so offering it is a dead option" % key
        )

# A label nobody can read is the same bug with extra steps.
for key in web_keys:
    entry = re.search(
        r"^  %s: \{(.*?)^  \}," % re.escape(key), web_block.group(1), re.S | re.M
    )
    if not entry:
        continue
    label = re.search(r"label:\s*'([^']*)'", entry.group(1))
    if not label or not label.group(1).strip():
        problems.append('"%s" has no label text' % key)
    elif label.group(1).strip() == key:
        problems.append('"%s" is labelled with its own key' % key)

print(
    "%d section keys in the API, %d named in the browser"
    % (len(api_keys), len(web_keys))
)

if problems:
    print("")
    print("%d PROBLEM(S):" % len(problems))
    for p in problems:
        print("  " + p)
    print("")
    print(
        "Section names live in apps/clinic-web/src/lib/sections.ts, and only\n"
        "there. Add the key to that record when you add it to SECTION_KEYS."
    )
    sys.exit(1)

print("  ok   every section the page can draw has a readable name")
