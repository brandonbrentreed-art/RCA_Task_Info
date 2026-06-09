# iam.tf - IAM bindings for the platform
# User auth = Entra ID (app level)
# IAM = service accounts, deployment, and data access permissions

locals {
  scheduler_sa = "serviceAccount:scheduler-sa@or-tfconfig-dec-exp-prod.iam.gserviceaccount.com"
  deployer_sa  = "serviceAccount:${var.deployer_sa_email}"
}

variable "deployer_sa_email" {
  type        = string
  description = "SA used by GitLab CI to deploy (needs Cloud Build + Artifact Registry + Cloud Run Admin)"
}

# ─── API Service Account → BigQuery ──────────────────────────────────────────

resource "google_project_iam_member" "sa_bq_data_viewer" {
  project = var.project_id
  role    = "roles/bigquery.dataViewer"
  member  = local.scheduler_sa
}

resource "google_project_iam_member" "sa_bq_job_user" {
  project = var.project_id
  role    = "roles/bigquery.jobUser"
  member  = local.scheduler_sa
}

# ─── Deployer SA → Cloud Build + Artifact Registry + Cloud Run ────────────────

resource "google_project_iam_member" "deployer_cloud_build" {
  project = var.project_id
  role    = "roles/cloudbuild.builds.editor"
  member  = local.deployer_sa
}

resource "google_project_iam_member" "deployer_artifact_registry" {
  project = var.project_id
  role    = "roles/artifactregistry.writer"
  member  = local.deployer_sa
}

resource "google_project_iam_member" "deployer_cloud_run_admin" {
  project = var.project_id
  role    = "roles/run.admin"
  member  = local.deployer_sa
}

resource "google_project_iam_member" "deployer_sa_user" {
  project = var.project_id
  role    = "roles/iam.serviceAccountUser"
  member  = local.deployer_sa
}
