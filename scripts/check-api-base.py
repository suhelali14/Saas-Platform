#!/usr/bin/env python3
"""Only lib/api.ts may know where the API is.

clinic-web serves every clinic from one static bundle, so the API base
cannot be baked in at build time -- the tenant directory resolves it at
boot and calls setApiBaseUrl. lib/api.ts holds that value; everything
else asks it with getApiBaseUrl().

Thirteen places did not ask. Each wrote its own

    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:4100/api/clinic';

and production deliberately leaves VITE_API_URL empty for this app,
which is the entire point of resolving at runtime. So all thirteen fell
through to the localhost default and the visitor's browser tried to
reach a server on their own machine: every image on the public site, the
page's own data, every upload, every PDF.

The fallback reads like a sensible default rather than a landmine, which
is why it was copied around. This refuses the next copy.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
APPS = {
    "clinic-web": {"allow": {"src/lib/api.ts"}, "needle": re.compile(r"VITE_API_URL|localhost:4100")},
}

problems = []
scanned = 0

for app, rule in APPS.items():
    src = ROOT / "apps" / app / "src"
    if not src.is_dir():
        continue
    for path in sorted(src.rglob("*")):
        if path.suffix not in (".ts", ".tsx"):
            continue
        rel = path.relative_to(ROOT / "apps" / app).as_posix()
        if rel in rule["allow"]:
            continue
        scanned += 1
        text = path.read_text(encoding="utf-8", errors="replace")
        lines = text.split("\n")
        for m in rule["needle"].finditer(text):
            lineno = text[: m.start()].count("\n") + 1
            line = lines[lineno - 1].strip()
            # Prose explaining the rule is not a breach of it.
            if line.startswith(("*", "//", "/*")):
                continue
            problems.append(f"{app}/{rel}:{lineno}  {m.group(0)}   in: {line[:92]}")

print(f"scanned {scanned} files")
if problems:
    print("\nThese read the build-time API base instead of asking lib/api.ts:")
    for p in problems:
        print(f"  {p}")
    print(
        "\nUse getApiBaseUrl() from lib/api.ts. It returns the base the tenant\n"
        "directory resolved at boot, and falls back to the build-time value for a\n"
        "single-clinic deployment that has no directory."
    )
    sys.exit(1)
print("only lib/api.ts knows where the API is")
