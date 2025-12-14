# =============================================================================
# Dev Stack - Cloud Run service for development environment
# =============================================================================
# The service is referenced by the Serverless NEG created in shared stack.
# =============================================================================

locals {
  region = "asia-northeast1"
}

# =============================================================================
# Cloud Run Service
# =============================================================================

resource "google_cloud_run_v2_service" "web-dev" {
  project  = var.project_id
  location = local.region
  name     = "koborin-ai-web-dev"
  ingress  = "INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER"

  template {
    execution_environment = "EXECUTION_ENVIRONMENT_GEN2"

    containers {
      image = var.image_uri

      env {
        # NODE_ENV: server-side environment detection
        # (affects Next.js optimizations, logging, etc.)
        name  = "NODE_ENV"
        value = "development"
      }

      env {
        # NEXT_PUBLIC_ENV: client-side environment detection
        # (exposed to browser, used for GA4, API endpoints, etc.)
        name  = "NEXT_PUBLIC_ENV"
        value = "dev"
      }
    }

    scaling {
      min_instance_count = 0
      max_instance_count = 1
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  lifecycle {
    ignore_changes = [
      template[0].containers[0].image, # Allow manual image updates
    ]
  }
}

# =============================================================================
# IAM - Grant Cloud Run Invoker to IAP Service Agent
# =============================================================================
# IAP uses this service account to invoke the Cloud Run service after authentication

resource "google_cloud_run_v2_service_iam_member" "web-dev-iap-invoker" {
  project  = var.project_id
  location = local.region
  name     = google_cloud_run_v2_service.web-dev.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:service-${var.project_number}@gcp-sa-iap.iam.gserviceaccount.com"
}

# =============================================================================
# Outputs
# =============================================================================

output "service_url" {
  description = "The URL of the Cloud Run service"
  value       = google_cloud_run_v2_service.web-dev.uri
}

output "service_name" {
  description = "The name of the Cloud Run service"
  value       = google_cloud_run_v2_service.web-dev.name
}

