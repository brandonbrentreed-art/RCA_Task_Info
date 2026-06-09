import os
from flask import Flask, jsonify, request
from flask_cors import CORS
from google.cloud import bigquery
from functools import wraps
import jwt
from jwt import PyJWKClient

app = Flask(__name__)

FRONTEND_URL = os.environ.get("FRONTEND_URL", "https://*.run.app")
CORS(app, origins=[FRONTEND_URL], supports_credentials=True)

# Entra ID config
ENTRA_TENANT_ID = os.environ.get("ENTRA_TENANT_ID", "YOUR_BT_TENANT_ID")
ENTRA_CLIENT_ID = os.environ.get("ENTRA_CLIENT_ID", "YOUR_ENTRA_APP_CLIENT_ID")

# JWKS endpoint for Entra ID token verification
JWKS_URL = f"https://login.microsoftonline.com/{ENTRA_TENANT_ID}/discovery/v2.0/keys"
jwks_client = PyJWKClient(JWKS_URL)


def verify_entra_token(token):
    signing_key = jwks_client.get_signing_key_from_jwt(token)
    decoded = jwt.decode(
        token,
        signing_key.key,
        algorithms=["RS256"],
        audience=ENTRA_CLIENT_ID,
        issuer=f"https://login.microsoftonline.com/{ENTRA_TENANT_ID}/v2.0",
    )
    return decoded


def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Unauthorized"}), 401

        token = auth_header.split(" ", 1)[1]

        try:
            claims = verify_entra_token(token)
        except Exception as e:
            print(f"Token validation failed: {e}")
            return jsonify({"error": "Invalid token"}), 403

        request.user = claims
        return f(*args, **kwargs)

    return decorated


# BigQuery client uses the service account identity automatically
bq_client = bigquery.Client()


@app.route("/api/query", methods=["POST"])
@require_auth
def run_query():
    body = request.get_json()
    if not body:
        return jsonify({"error": "Empty request"}), 400

    query_name = body.get("query_name")

    # Predefined queries only — never accept raw SQL from frontend
    queries = {
        "task_timeline": """
            SELECT * FROM `your_dataset.task_timeline`
            WHERE jin_id = @jin_id
            ORDER BY snapshot_time
        """,
        "ndc_allocation": """
            SELECT * FROM `your_dataset.ndc_allocation`
            WHERE task_id = @task_id
        """,
    }

    if query_name not in queries:
        return jsonify({"error": "Unknown query"}), 400

    sql = queries[query_name]
    params = body.get("params", {})

    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter(k, "STRING", v)
            for k, v in params.items()
        ]
    )

    results = bq_client.query(sql, job_config=job_config).result()
    rows = [dict(row) for row in results]

    return jsonify({"data": rows})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)
