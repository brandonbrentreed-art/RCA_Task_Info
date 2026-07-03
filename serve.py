"""Dev server — Flask serves static files + API on port 8080 (single origin)."""
import sys
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
API_DIR = os.path.join(ROOT, "cloud_functions", "fun-trigger-by-pow", "api")
sys.path.insert(0, API_DIR)

os.environ.setdefault("DEV_MODE", "true")

from flask import Flask, send_from_directory
from main import app, require_auth, run_query

# Serve all static files from the project root
@app.route("/", defaults={"path": "index.html"})
@app.route("/<path:path>")
def static_files(path):
    return send_from_directory(ROOT, path)

if __name__ == "__main__":
    print(f"\n  Dev server → http://localhost:8080")
    print(f"  DEV_MODE   : {os.environ['DEV_MODE']}\n")
    app.run(host="0.0.0.0", port=8080, debug=True)
