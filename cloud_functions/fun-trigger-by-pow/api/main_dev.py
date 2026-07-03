"""
Dev runner — uses Application Default Credentials (gcloud auth application-default login).
Sets DEV_MODE=true so the frontend's dev-bypass token is accepted without Entra validation.

Usage:
    gcloud auth application-default login
    python main_dev.py
"""
import os

os.environ.setdefault("DEV_MODE", "true")
os.environ.setdefault("GOOGLE_IMPERSONATE_SERVICE_ACCOUNT", "scheduler-sa@or-tfconfig-dec-exp-prod.iam.gserviceaccount.com")

from main import app

if __name__ == "__main__":
    print("Starting dev server on http://localhost:8081")
    print(f"  DEV_MODE : {os.environ['DEV_MODE']}")
    app.run(host="127.0.0.1", port=8081, debug=False, use_reloader=True)
