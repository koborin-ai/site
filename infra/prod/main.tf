# =============================================================================
# Prod Stack - Cloud Run service for production environment
# =============================================================================
# The service is referenced by the Serverless NEG created in shared stack.
# =============================================================================

locals {
  region = "asia-northeast1"
}

# =============================================================================
# Cloud Run Service
# =============================================================================

resource "google_cloud_run_v2_service" "web-prod" {
  project  = var.project_id
  location = local.region
  name     = "koborin-ai-web-prod"
  ingress  = "INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER"

  template {
    execution_environment = "EXECUTION_ENVIRONMENT_GEN2"

    containers {
      image = var.image_uri

      env {
        # NODE_ENV: server-side environment detection
        # (affects Next.js optimizations, logging, etc.)
        name  = "NODE_ENV"
        value = "production"
      }

      env {
        # NEXT_PUBLIC_ENV: client-side environment detection
        # (exposed to browser, used for GA4, API endpoints, etc.)
        name  = "NEXT_PUBLIC_ENV"
        value = "prod"
      }
    }

    scaling {
      min_instance_count = 0
      max_instance_count = 10
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

}

# =============================================================================
# IAM - Allow public access
# =============================================================================

resource "google_cloud_run_v2_service_iam_member" "web-prod-invoker" {
  project  = var.project_id
  location = local.region
  name     = google_cloud_run_v2_service.web-prod.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# =============================================================================
# Outputs
# =============================================================================

output "service_url" {
  description = "The URL of the Cloud Run service"
  value       = google_cloud_run_v2_service.web-prod.uri
}

output "service_name" {
  description = "The name of the Cloud Run service"
  value       = google_cloud_run_v2_service.web-prod.name
}

