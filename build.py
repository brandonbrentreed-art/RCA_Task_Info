"""
build.py — Static site build pipeline
======================================
For each source HTML page:
  1. Injects <!-- include: partials/head.html --> with shared head content
  2. Injects <!-- include: partials/nav.html --> with shared nav chrome,
     adding class="active" to the link matching the output filename
  3. Replaces href/src on all local <link> and <script> tags with
     content-hashed versions (e.g. styles.css?v=a3f2c1)
  4. Writes the result to dist/

Usage:
    python build.py

Output: dist/timeline.html, dist/ndp.html, dist/ndc.html
"""

import hashlib
import os
import re
import shutil
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.join(ROOT, 'dist')

# Pages that use <!-- include: partials/... --> markers
PARTIAL_PAGES = ['timeline.html', 'ndp.html', 'ndc.html']

# Pages that are standalone — just copy with hash injection, no partials
PLAIN_PAGES = ['index.html', 'home.html', 'auth-guard.html']

# Files to copy verbatim into dist (preserving directory structure)
COPY_DIRS = ['css', 'js', 'shared-ui', 'shared-components', 'assets']


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def file_hash(path):
    """Return first 6 hex chars of MD5 of file contents."""
    try:
        with open(path, 'rb') as f:
            return hashlib.md5(f.read()).hexdigest()[:6]
    except FileNotFoundError:
        return None


def add_hash(url, page_dir):
    """
    Given a relative URL (possibly already with ?v=...), resolve the file
    relative to page_dir, compute its hash, and return url?v=<hash>.
    Skips external URLs and URLs that already have a non-v query param.
    """
    if url.startswith('http') or url.startswith('//'):
        return url
    # Strip existing ?v=... query string
    base = url.split('?')[0]
    abs_path = os.path.normpath(os.path.join(page_dir, base))
    h = file_hash(abs_path)
    if h:
        return base + '?v=' + h
    return base  # file not found — return without hash


def inject_hashes(html, page_dir):
    """Replace href/src on local <link> and <script> tags with hashed versions."""
    def replace_link(m):
        href = m.group(1)
        new_href = add_hash(href, page_dir)
        return m.group(0).replace(href, new_href, 1)

    def replace_script(m):
        src = m.group(1)
        new_src = add_hash(src, page_dir)
        return m.group(0).replace(src, new_src, 1)

    html = re.sub(r'<link\b[^>]*\shref="([^"]+)"[^>]*>', replace_link, html)
    html = re.sub(r'<script\b[^>]*\ssrc="([^"]+)"[^>]*>', replace_script, html)
    return html


def inject_partial(html, marker, partial_content):
    """Replace <!-- include: path --> with partial_content."""
    return html.replace('<!-- include: ' + marker + ' -->', partial_content, 1)


def set_active_nav(nav_html, page_filename):
    """
    Add class="active" to the <a> whose data-nav-page matches page_filename.
    Removes any existing class="active" first to keep it idempotent.
    """
    # Remove any existing active classes on nav links
    nav_html = re.sub(r'(<a\b[^>]*)\s+class="active"', r'\1', nav_html)
    # Add active to the matching link
    nav_html = re.sub(
        r'(<a\b[^>]*data-nav-page="' + re.escape(page_filename) + r'")',
        r'\1 class="active"',
        nav_html
    )
    # Remove data-nav-page attributes from output (they're build-only markers)
    nav_html = re.sub(r'\s+data-nav-page="[^"]*"', '', nav_html)
    return nav_html


# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------

def build():
    # Read partials
    head_partial = open(os.path.join(ROOT, 'partials', 'head.html'), encoding='utf-8').read()
    nav_partial_template = open(os.path.join(ROOT, 'partials', 'nav.html'), encoding='utf-8').read()

    # Create dist
    if os.path.exists(DIST):
        shutil.rmtree(DIST, ignore_errors=True)
    os.makedirs(DIST, exist_ok=True)

    # Copy asset directories
    for d in COPY_DIRS:
        src = os.path.join(ROOT, d)
        if os.path.exists(src):
            shutil.copytree(src, os.path.join(DIST, d), dirs_exist_ok=True)

    built = []
    for page in PARTIAL_PAGES:
        src_path = os.path.join(ROOT, page)
        if not os.path.exists(src_path):
            sys.stdout.write('SKIP (not found): ' + page + '\n')
            continue

        html = open(src_path, encoding='utf-8').read()

        # 1. Inject head partial
        html = inject_partial(html, 'partials/head.html', head_partial)

        # 2. Inject nav partial with correct active link
        nav_html = set_active_nav(nav_partial_template, page)
        html = inject_partial(html, 'partials/nav.html', nav_html)

        # 3. Content-hash all local asset URLs
        html = inject_hashes(html, ROOT)

        out_path = os.path.join(DIST, page)
        open(out_path, 'w', encoding='utf-8').write(html)
        built.append(page)
        sys.stdout.write('Built:  dist/' + page + '\n')

    for page in PLAIN_PAGES:
        src_path = os.path.join(ROOT, page)
        if not os.path.exists(src_path):
            sys.stdout.write('SKIP (not found): ' + page + '\n')
            continue

        html = open(src_path, encoding='utf-8').read()

        # Hash injection only — no partials
        html = inject_hashes(html, ROOT)

        out_path = os.path.join(DIST, page)
        open(out_path, 'w', encoding='utf-8').write(html)
        built.append(page)
        sys.stdout.write('Built:  dist/' + page + '\n')

    sys.stdout.write('\nDone. ' + str(len(built)) + ' page(s) built into dist/\n')


if __name__ == '__main__':
    build()
