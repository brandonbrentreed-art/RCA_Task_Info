"""
bump-build.py — increments the Client Build minor version across all nav files.
Run before committing: python bump-build.py
"""
import re, sys

FILES = ["index.html", "timeline.html", "ndp.html", "ndc.html"]
PATTERN = re.compile(r"Client Build &middot; (\d+)\.(\d+)")

def bump():
    current = None
    for f in FILES:
        try:
            text = open(f, encoding="utf-8").read()
        except FileNotFoundError:
            continue
        m = PATTERN.search(text)
        if m:
            current = (int(m.group(1)), int(m.group(2)))
            break

    if current is None:
        print("No Client Build version found.")
        sys.exit(1)

    major, minor = current
    new_minor = minor + 1
    new_label = f"Client Build &middot; {major}.{new_minor}"
    old_pattern = re.compile(r"Client Build &middot; \d+\.\d+")

    for f in FILES:
        try:
            text = open(f, encoding="utf-8").read()
        except FileNotFoundError:
            continue
        updated = old_pattern.sub(new_label, text)
        if updated != text:
            open(f, "w", encoding="utf-8").write(updated)
            print(f"  {f}  →  {new_label}")

    print(f"\nBuild bumped: {major}.{minor} → {major}.{new_minor}")

if __name__ == "__main__":
    bump()
