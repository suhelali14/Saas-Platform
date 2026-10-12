#!/usr/bin/env python3
"""Deploy scripts must be executable, and must exist.

Two faults this catches, both found the hard way.

set-origins.sh was committed 100644 while every other deploy script was
100755. Windows does not track the exec bit, so a local `chmod +x` never
reaches git. These scripts are invoked by path on the server, so after a
`git reset --hard` the whole feature failed with "permission denied" and
the console reported a failed job without being able to say why.

The second is the inverse: a script invoked by path that is not in the
repository at all. That also surfaces as a runtime failure on the server
rather than at build time, and it is the easy mistake to make when
adding a step to the runner.

Only deploy/ is checked for the mode. A script under scripts/ is run by
CI as `python3 x.py` or `bash x.sh`, where the bit is irrelevant -- and
requiring it there would be a rule nobody could explain.
"""
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

index = subprocess.run(
    ["git", "ls-files", "-s", "--", "deploy"],
    capture_output=True, text=True, check=True,
).stdout

modes = {}
for line in index.splitlines():
    if not line.strip():
        continue
    meta, path = line.split("\t", 1)
    modes[path] = meta.split()[0]

problems = []

# ── 1. Every deploy/*.sh is executable ───────────────────────────────
scripts = sorted(p for p in modes if p.endswith(".sh"))
for path in scripts:
    if modes[path] != "100755":
        problems.append(f"{path} is {modes[path]} in the index, expected 100755")

# ── 2. Every script invoked by path exists and is executable ─────────
#
# Matches an invocation like "$ROOT/repo/deploy/add-clinic.sh", which is
# how the runner reaches the host scripts.
invocation = re.compile(r'(?:\$\{?ROOT\}?/repo/|\$\{?ROOT\}?/|")?(?:[\w./$\{\}-]*/)?deploy/([\w-]+\.sh)')
referenced = set()
for path in scripts:
    text = (ROOT / path).read_text(encoding="utf-8", errors="replace")
    for m in invocation.finditer(text):
        name = m.group(1)
        if name != Path(path).name:
            referenced.add(name)

for name in sorted(referenced):
    target = f"deploy/{name}"
    if target not in modes:
        problems.append(f"{target} is invoked by another deploy script but is not in the repository")

print(f"checked {len(scripts)} scripts in deploy/, {len(referenced)} cross-references")
if problems:
    print("\nProblems:")
    for p in problems:
        print(f"  {p}")
    print("\nFix a mode with:  git update-index --chmod=+x <path>")
    sys.exit(1)
print("all executable, all cross-references resolve")
