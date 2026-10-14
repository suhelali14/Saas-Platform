"""Every configurable section must render with an id equal to its key.

Three separate features depend on that correspondence, and all three fail
silently when it breaks:

  1. The public page's nav builds its anchors from the section keys, so a
     section rendered under a different id gives a menu item that scrolls
     nowhere. This already happened once -- "highlights" rendered as
     id="why-us" -- and was found by hand.

  2. The website builder's preview selects a block by reading the id of
     the <section> that was clicked. A section with no id cannot be
     selected, and the click does nothing at all.

  3. `scroll-mt` anchoring and any shared link to #section.

None of it is a type error: the keys live in the API's site-design module
and the ids are string literals in JSX, so nothing connects them but this
check. When it last broke, two of the ten sections ("about" and "queue")
had no id and nobody noticed until the builder tried to select them.
"""
import io
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KEYS_FILE = os.path.join(ROOT, "apps", "clinic-api", "src", "lib", "site-design.ts")
PAGE_FILE = os.path.join(ROOT, "apps", "clinic-web", "src", "pages", "PublicClinic.tsx")

# Rendered ids that are deliberately not section keys.
ALLOWED_EXTRA = {
    "top",      # the <main> scroll target
    "hero",     # always rendered, configurable but not a toggleable section
}


def read(path):
    return io.open(path, encoding="utf-8", errors="replace").read()


for path in (KEYS_FILE, PAGE_FILE):
    if not os.path.exists(path):
        print(f"skipped: {os.path.relpath(path, ROOT)} is not present")
        sys.exit(0)

keys_src = read(KEYS_FILE)
block = re.search(r"export const SECTION_KEYS = \[(.*?)\] as const", keys_src, re.S)
if not block:
    print("could not find SECTION_KEYS -- has site-design.ts been restructured?")
    sys.exit(1)
keys = re.findall(r'"([a-z]+)"', block.group(1))

page_src = read(PAGE_FILE)
ids = set(re.findall(r'<Section[^>]*\bid="([a-z-]+)"', page_src))
ids |= set(re.findall(r'<section[^>]*\bid="([a-z-]+)"', page_src))

print(f"{len(keys)} section keys, {len(ids)} ids rendered by the public page")

problems = []
for key in keys:
    if key not in ids:
        problems.append(
            f"section '{key}' is a SECTION_KEY but nothing renders id=\"{key}\" -- "
            f"its nav anchor scrolls nowhere and the builder cannot select it"
        )

for rendered in sorted(ids):
    if rendered not in keys and rendered not in ALLOWED_EXTRA:
        problems.append(
            f"id=\"{rendered}\" is rendered but is not a SECTION_KEY -- "
            f"either rename it to its key, or add it to ALLOWED_EXTRA with a reason"
        )

if problems:
    print(f"\n{len(problems)} PROBLEM(S):")
    for p in problems:
        print(f"  {p}")
    print(
        "\nThe id on each <Section> must equal its key in SECTION_KEYS. Nothing\n"
        "else connects them -- the keys are in the API and the ids are JSX string\n"
        "literals, so neither tsc nor a test will tell you."
    )
    sys.exit(1)

print("every section key renders under its own id")
