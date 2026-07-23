import os
from datetime import date
from flask import Flask, jsonify, request
from flask_cors import CORS
from google.cloud import bigquery
from functools import wraps
import jwt
from jwt import PyJWKClient

app = Flask(__name__)
CORS(app, origins=["*"], supports_credentials=True)

ENTRA_TENANT_ID = os.environ.get("ENTRA_TENANT_ID", "")
ENTRA_CLIENT_ID = os.environ.get("ENTRA_CLIENT_ID", "")
DEV_MODE = os.environ.get("DEV_MODE", "false").lower() == "true"

if not DEV_MODE and ENTRA_TENANT_ID:
    jwks_client = PyJWKClient(
        f"https://login.microsoftonline.com/{ENTRA_TENANT_ID}/discovery/v2.0/keys"
    )
else:
    jwks_client = None


def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Unauthorized"}), 401
        token = auth_header.split(" ", 1)[1]
        if DEV_MODE and token == "dev-bypass":
            return f(*args, **kwargs)
        try:
            signing_key = jwks_client.get_signing_key_from_jwt(token)
            jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256"],
                audience=ENTRA_CLIENT_ID,
                issuer=f"https://login.microsoftonline.com/{ENTRA_TENANT_ID}/v2.0",
            )
        except Exception as e:
            print(f"Token validation failed: {e}")
            return jsonify({"error": "Invalid token"}), 403
        return f(*args, **kwargs)
    return decorated


impersonate_sa = os.environ.get("GOOGLE_IMPERSONATE_SERVICE_ACCOUNT")
if impersonate_sa:
    from google.auth import impersonated_credentials, default as google_default
    source_creds, _ = google_default()
    creds = impersonated_credentials.Credentials(
        source_credentials=source_creds,
        target_principal=impersonate_sa,
        target_scopes=["https://www.googleapis.com/auth/bigquery"],
    )
    bq_client = bigquery.Client(credentials=creds, project="or-tfconfig-dec-exp-prod")
else:
    bq_client = bigquery.Client()

POW_QUERY = """
WITH params AS (
  SELECT
    TIMESTAMP(DATETIME(DATE(@target_date), TIME '05:00:00'), 'Europe/London') AS bt_start_ts,
    TIMESTAMP(DATETIME(DATE(@target_date), TIME '18:00:00'), 'Europe/London') AS bt_end_ts
)

SELECT
  wm_jin                AS JIN_ID,
  wm_pin                AS TECH_ID,
  wm_id                 AS WORK_MANAGER_ID,
  cug_id                AS CUG_ID,
  exchange_group_code   AS EXCHANGE_GROUP,
  zone_code             AS ZONE_CODE,
  task_type             AS TASK_TYPE,
  task_status           AS TASK_STATUS,
  tour_status           AS TOUR_STATUS,
  importance_score      AS IMPORTANCE_SCORE,
  real_time_priority    AS PRIORITY_SCORE,
  optimize_job_category AS JOB_CATEGORY,
  customer_type         AS CUSTOMER_TYPE,
  customer_tariff       AS CUSTOMER_TARIFF,
  care_level_code       AS CARE_LEVEL,
  skill_code            AS SKILL_CODE,

  FORMAT_TIMESTAMP('%d/%m/%Y %H:%M', rec_eff_ts, 'Europe/London')                      AS RECORD_TIME_BT,
  FORMAT_TIMESTAMP('%d/%m/%Y %H:%M', estimated_start_ts, 'Europe/London')              AS ESTIMATED_START_TIME_BT,
  FORMAT_TIMESTAMP('%d/%m/%Y %H:%M', original_earliest_completion_ts, 'Europe/London') AS EARLIEST_COMPLETION_TIME_BT,
  FORMAT_TIMESTAMP('%d/%m/%Y %H:%M', original_latest_completion_ts, 'Europe/London')   AS LATEST_COMPLETION_TIME_BT,
  FORMAT_TIMESTAMP('%d/%m/%Y %H:%M', commitment_ts, 'Europe/London')                   AS COMMITMENT_TIME_BT,

  CASE
    WHEN task_status = 'ISS' THEN 'Pinned'
    WHEN task_status = 'AWI' THEN 'Pre-Pinned'
    WHEN prepin_ind = 'Y'    THEN 'Pre-Pinned'
    WHEN wm_pin IS NULL OR wm_pin = 'NONE' THEN 'No Pin'
    ELSE 'Has Pin'
  END AS PIN_STATUS,

  CASE
    WHEN task_status = 'ACT' AND wm_pin IS NOT NULL AND wm_pin <> 'NONE' THEN 'Scheduled'
    WHEN task_status = 'ACT' AND (wm_pin IS NULL OR wm_pin = 'NONE')     THEN 'Active - No Pin'
    WHEN task_status = 'AWI' THEN 'Pinned'
    WHEN task_status = 'ISS' THEN 'With Engineer'
    WHEN task_status = 'HLD' THEN 'Held'
    WHEN task_status = 'CMN' THEN 'CMN'
    ELSE task_status
  END AS TASK_STATE,

  appt_slot    AS APPOINTMENT_SLOT,
  colocated_ind AS COLOCATED_INDICATOR,
  prepin_ind   AS PRE_PINNED

FROM `or-enggactvt-dp-data.enggactvt_job_details_ro.vw_pool_of_work_snapshot_daily`
CROSS JOIN params

WHERE rec_eff_ts >= bt_start_ts
  AND rec_eff_ts <= bt_end_ts
  AND zone_code = @zone_code

ORDER BY rec_eff_ts ASC, wm_jin ASC
"""


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/api/query", methods=["POST"])
@require_auth
def run_query():
    body = request.get_json()
    if not body:
        return jsonify({"error": "Empty request"}), 400

    query_name = body.get("query_name")
    if query_name != "pool_of_work":
        return jsonify({"error": f"Unknown query: {query_name}"}), 400

    params = body.get("params", {})
    zone_code = params.get("zone_code", "").strip().upper()
    if not zone_code:
        return jsonify({"error": "zone_code is required"}), 400

    # target_date: frontend sends YYYY-MM-DD, default to today (London date)
    target_date = params.get("target_date") or date.today().isoformat()

    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("zone_code", "STRING", zone_code),
            bigquery.ScalarQueryParameter("target_date", "STRING", target_date),
        ]
    )

    try:
        rows = [dict(row) for row in bq_client.query(POW_QUERY, job_config=job_config).result()]
        return jsonify({"data": rows, "count": len(rows)})
    except Exception as e:
        print(f"BigQuery error: {e}")
        return jsonify({"error": "Query failed", "detail": str(e)}), 500


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8081, debug=False, use_reloader=True)
