"""Dev Server - Clean start on each run. Kills existing port usage then serves."""

import http.server
import mimetypes
import socket
import subprocess
import sys
import os
import time
import webbrowser

PORT = 8080
HOST = "localhost"
ROOT = os.path.dirname(os.path.abspath(__file__))

# Fix Windows MIME type issues — registry overrides can break CSS/JS serving
mimetypes.add_type("text/css", ".css")
mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("text/html", ".html")
mimetypes.add_type("image/png", ".png")
mimetypes.add_type("image/svg+xml", ".svg")


def kill_port(port):
    """Kill any process occupying the target port."""
    try:
        result = subprocess.run(
            f'netstat -ano | findstr :{port}',
            capture_output=True, text=True, shell=True
        )
        killed = False
        for line in result.stdout.strip().splitlines():
            parts = line.split()
            if len(parts) < 5:
                continue
            local_addr = parts[1]
            if not local_addr.endswith(f":{port}"):
                continue
            pid = parts[-1]
            if pid.isdigit() and int(pid) != os.getpid():
                subprocess.run(f"taskkill /F /PID {pid}", shell=True,
                               capture_output=True)
                print(f"  Killed PID {pid} on port {port}")
                killed = True
        if killed:
            time.sleep(0.5)
    except Exception:
        pass


def port_free(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex((HOST, port)) != 0


def serve():
    kill_port(PORT)

    if not port_free(PORT):
        print(f"ERROR: Port {PORT} still in use.")
        sys.exit(1)

    os.chdir(ROOT)
    handler = http.server.SimpleHTTPRequestHandler
    server = http.server.HTTPServer((HOST, PORT), handler)

    url = f"http://{HOST}:{PORT}"
    print(f"\n  Dev server running → {url}")
    print(f"  Serving from: {ROOT}")
    print("  Press Ctrl+C to stop\n")

    try:
        webbrowser.open(url)
    except Exception:
        pass

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.shutdown()
        print("\n  Server stopped.")


if __name__ == "__main__":
    serve()
