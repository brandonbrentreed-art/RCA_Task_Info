from flask import Flask, jsonify, request
from google.cloud import bigquery
from functools import wraps
import google.auth
import google.auth.transport.requests
from google.oauth2 import id_token

app = Flask(__name__)

# Verify the caller's Entra ID token (forwarded from frontend)
ENTRA_TENANT_ID = "YOUR_BT_TENANT_ID"
ENTRA_CLIENT_ID = "YOUR_ENTRA_APP_CLIENT_ID"


def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Unauthorized"}), 401

        token = auth_header.split(" ", 1)[1]

        try:
            # Verify Entra ID token
            claims = id_token.verify_token(
                token,
                requests.Request(),
                audience=ENTRA_CLIENT_ID,
                certs_url=f"https://login.microsoftonline.com/{ENTRA_TENANT_ID}/discovery/v2.0/keys",
            )
        except Exception:
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
