"""Dev server — serves static files on port 8080 using Python built-ins only."""
import http.server
import os
import threading
import webbrowser

PORT = 8080
ROOT = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def log_message(self, format, *args):
        pass  # suppress per-request noise

if __name__ == "__main__":
    with http.server.HTTPServer(("127.0.0.1", PORT), Handler) as httpd:
        print(f"\n  Dev server → http://localhost:{PORT}\n")
        threading.Timer(1, lambda: webbrowser.open(f"http://localhost:{PORT}")).start()
        httpd.serve_forever()
