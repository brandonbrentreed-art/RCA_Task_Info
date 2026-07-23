"""Dev server — builds into dist/ then serves on port 8080."""
import http.server
import importlib.util
import os
import threading
import webbrowser

PORT = 8080
ROOT = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.join(ROOT, 'dist')


def run_build():
    spec = importlib.util.spec_from_file_location('build', os.path.join(ROOT, 'build.py'))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    mod.build()


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIST, **kwargs)

    def log_message(self, format, *args):
        pass  # suppress per-request noise


if __name__ == '__main__':
    print('\n  Building...')
    run_build()
    with http.server.HTTPServer(('127.0.0.1', PORT), Handler) as httpd:
        print(f'\n  Dev server -> http://localhost:{PORT}\n')
        threading.Timer(1, lambda: webbrowser.open(f'http://localhost:{PORT}')).start()
        httpd.serve_forever()
