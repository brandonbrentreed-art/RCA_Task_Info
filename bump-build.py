"""
bump-build.py — increments the Client Build minor version across all nav files.
Run before committing: python bump-build.py
"""
import re
import sys

FILES = ["index.html", "timeline.html", "ndp.html", "ndc.html"]
VERSION_RE = re.compile(r"Client Build &middot; (\d+)\.(\d+)")


def read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


def write(path, text):
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)


def bump():
    current = None
    for path in FILES:
        try:
            m = VERSION_RE.search(read(path))
        except FileNotFoundError:
            continue
        if m:
            current = (int(m.group(1)), int(m.group(2)))
            break

    if current is None:
        print("No Client Build version found.")
        sys.exit(1)

    major, minor = current
    new_label = f"Client Build &middot; {major}.{minor + 1}"

    for path in FILES:
        try:
            text = read(path)
        except FileNotFoundError:
            continue
        updated = VERSION_RE.sub(new_label, text)
        if updated != text:
            write(path, updated)
            print(f"  {path}  ->  {new_label}")

    print(f"\nBuild bumped: {major}.{minor} -> {major}.{minor + 1}")


if __name__ == "__main__":
    bump()
