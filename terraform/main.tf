terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

variable "project_id" {
  type = string
}

variable "region" {
  type    = string
  default = "europe-west2"
}

variable "image_tag" {
  type    = string
  default = "latest"
}

variable "api_service_account" {
  type        = string
  description = "Service account email for the API Cloud Run service"
}

variable "entra_tenant_id" {
  type        = string
  description = "BT Entra ID tenant ID"
}

variable "entra_client_id" {
  type        = string
  description = "Entra ID App Registration client ID"
}

locals {
  frontend_image = "${var.region}-docker.pkg.dev/${var.project_id}/rca-task-info/frontend:${var.image_tag}"
  api_image      = "${var.region}-docker.pkg.dev/${var.project_id}/rca-task-info/api:${var.image_tag}"
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# ─── Frontend (static site + Entra ID auth at app level) ─────────────────────

resource "google_cloud_run_v2_service" "frontend" {
  name     = "rca-task-info-frontend"
  location = var.region

  template {
    containers {
      image = local.frontend_image
      ports { container_port = 8080 }
      resources {
        limits = { cpu = "1", memory = "256Mi" }
      }
      env {
        name  = "PORT"
        value = "8080"
      }
    }
    scaling {
      min_instance_count = 0
      max_instance_count = 3
    }
  }
}

# Frontend is publicly accessible — Entra ID auth happens in the browser
resource "google_cloud_run_v2_service_iam_member" "frontend_public" {
  depends_on = [google_cloud_run_v2_service.frontend]
  name       = google_cloud_run_v2_service.frontend.name
  location   = var.region
  role       = "roles/run.invoker"
  member     = "allUsers"
}

# ─── Backend API (service account, queries BigQuery) ──────────────────────────

resource "google_cloud_run_v2_service" "api" {
  name     = "rca-task-info-api"
  location = var.region

  template {
    service_account = var.api_service_account

    containers {
      image = local.api_image
      ports { container_port = 8080 }
      resources {
        limits = { cpu = "1", memory = "512Mi" }
      }
      env {
        name  = "PORT"
        value = "8080"
      }
      env {
        name  = "ENTRA_TENANT_ID"
        value = var.entra_tenant_id
      }
      env {
        name  = "ENTRA_CLIENT_ID"
        value = var.entra_client_id
      }
      env {
        name  = "FRONTEND_URL"
        value = google_cloud_run_v2_service.frontend.uri
      }
    }
    scaling {
      min_instance_count = 0
      max_instance_count = 5
    }
  }
}

# API is publicly accessible at network level — auth is validated in code
# (the API verifies the Entra ID Bearer token before processing requests)
resource "google_cloud_run_v2_service_iam_member" "api_public" {
  depends_on = [google_cloud_run_v2_service.api]
  name       = google_cloud_run_v2_service.api.name
  location   = var.region
  role       = "roles/run.invoker"
  member     = "allUsers"
}

# ─── Outputs ─────────────────────────────────────────────────────────────────

output "frontend_url" {
  value = google_cloud_run_v2_service.frontend.uri
}

output "api_url" {
  value = google_cloud_run_v2_service.api.uri
}
