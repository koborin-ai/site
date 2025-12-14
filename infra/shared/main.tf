# =============================================================================
# Shared Stack - Resources shared across dev/prod environments
# =============================================================================
# This stack manages:
# - API enablement
# - Artifact Registry for container images
# - Global static IP for HTTPS load balancer
# - Serverless NEG (dev/prod) pointing to Cloud Run services
# - Backend Service (dev with IAP, prod without IAP)
# - Managed SSL Certificate (multi-domain)
# - URL Map (host-based routing)
# - Target HTTPS Proxy
# - Global Forwarding Rule
# - Workload Identity for GitHub Actions
#
# Note: DNS is hosted in Cloudflare (A records managed manually)
# =============================================================================

locals {
  region = "asia-northeast1"
}

# =============================================================================
# API Enablement
# =============================================================================

resource "google_project_service" "api-run-googleapis-com" {
  project                    = var.project_id
  service                    = "run.googleapis.com"
  disable_dependent_services = false
  disable_on_destroy         = false
}

resource "google_project_service" "api-compute-googleapis-com" {
  project                    = var.project_id
  service                    = "compute.googleapis.com"
  disable_dependent_services = false
  disable_on_destroy         = false
}

resource "google_project_service" "api-iam-googleapis-com" {
  project                    = var.project_id
  service                    = "iam.googleapis.com"
  disable_dependent_services = false
  disable_on_destroy         = false
}

resource "google_project_service" "api-cloudresourcemanager-googleapis-com" {
  project                    = var.project_id
  service                    = "cloudresourcemanager.googleapis.com"
  disable_dependent_services = false
  disable_on_destroy         = false
}

resource "google_project_service" "api-artifactregistry-googleapis-com" {
  project                    = var.project_id
  service                    = "artifactregistry.googleapis.com"
  disable_dependent_services = false
  disable_on_destroy         = false
}

resource "google_project_service" "api-cloudbuild-googleapis-com" {
  project                    = var.project_id
  service                    = "cloudbuild.googleapis.com"
  disable_dependent_services = false
  disable_on_destroy         = false
}

resource "google_project_service" "api-iap-googleapis-com" {
  project                    = var.project_id
  service                    = "iap.googleapis.com"
  disable_dependent_services = false
  disable_on_destroy         = false
}

resource "google_project_service" "api-monitoring-googleapis-com" {
  project                    = var.project_id
  service                    = "monitoring.googleapis.com"
  disable_dependent_services = false
  disable_on_destroy         = false
}

resource "google_project_service" "api-logging-googleapis-com" {
  project                    = var.project_id
  service                    = "logging.googleapis.com"
  disable_dependent_services = false
  disable_on_destroy         = false
}

resource "google_project_service" "api-certificatemanager-googleapis-com" {
  project                    = var.project_id
  service                    = "certificatemanager.googleapis.com"
  disable_dependent_services = false
  disable_on_destroy         = false
}

# =============================================================================
# Artifact Registry
# =============================================================================

resource "google_artifact_registry_repository" "artifact-registry" {
  project       = var.project_id
  location      = local.region
  repository_id = "koborin-ai-web"
  description   = "Container images for koborin.ai web application (dev/prod)"
  format        = "DOCKER"

  docker_config {
    immutable_tags = true
  }

  depends_on = [
    google_project_service.api-run-googleapis-com,
    google_project_service.api-compute-googleapis-com,
    google_project_service.api-artifactregistry-googleapis-com,
  ]
}

# =============================================================================
# Global Static IP
# =============================================================================

resource "google_compute_global_address" "lb" {
  project      = var.project_id
  name         = "koborin-ai-global-ip"
  address_type = "EXTERNAL"
  ip_version   = "IPV4"
  description  = "Static IP for koborin.ai HTTPS load balancer"

  depends_on = [
    google_project_service.api-run-googleapis-com,
    google_project_service.api-compute-googleapis-com,
    google_project_service.api-artifactregistry-googleapis-com,
  ]
}

# =============================================================================
# Dev Environment Backend
# =============================================================================

resource "google_compute_region_network_endpoint_group" "dev" {
  project               = var.project_id
  region                = local.region
  name                  = "koborin-ai-dev-neg"
  network_endpoint_type = "SERVERLESS"

  cloud_run {
    service = "koborin-ai-web-dev"
  }

  lifecycle {
    create_before_destroy = true
  }

  depends_on = [
    google_project_service.api-run-googleapis-com,
    google_project_service.api-compute-googleapis-com,
    google_project_service.api-artifactregistry-googleapis-com,
  ]
}

resource "google_compute_backend_service" "dev" {
  project               = var.project_id
  name                  = "koborin-ai-dev-backend"
  protocol              = "HTTP"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  timeout_sec           = 30

  # Prevent search engine indexing for dev environment
  custom_response_headers = ["X-Robots-Tag: noindex, nofollow"]

  backend {
    group           = google_compute_region_network_endpoint_group.dev.id
    balancing_mode  = "UTILIZATION"
    capacity_scaler = 1.0
  }

  iap {
    enabled              = true
    oauth2_client_id     = var.oauth_client_id
    oauth2_client_secret = var.oauth_client_secret
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "google_iap_web_backend_service_iam_binding" "dev" {
  project             = var.project_id
  web_backend_service = google_compute_backend_service.dev.name
  role                = "roles/iap.httpsResourceAccessor"
  members             = ["user:${var.iap_user}"]
}

# =============================================================================
# Prod Environment Backend
# =============================================================================

resource "google_compute_region_network_endpoint_group" "prod" {
  project               = var.project_id
  region                = local.region
  name                  = "koborin-ai-prod-neg"
  network_endpoint_type = "SERVERLESS"

  cloud_run {
    service = "koborin-ai-web-prod"
  }

  lifecycle {
    create_before_destroy = true
  }

  depends_on = [
    google_project_service.api-run-googleapis-com,
    google_project_service.api-compute-googleapis-com,
    google_project_service.api-artifactregistry-googleapis-com,
  ]
}

resource "google_compute_backend_service" "prod" {
  project               = var.project_id
  name                  = "koborin-ai-prod-backend"
  protocol              = "HTTP"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  timeout_sec           = 30

  backend {
    group           = google_compute_region_network_endpoint_group.prod.id
    balancing_mode  = "UTILIZATION"
    capacity_scaler = 1.0
  }

  log_config {
    enable      = true
    sample_rate = 1.0
  }

  lifecycle {
    create_before_destroy = true
  }
}

# =============================================================================
# HTTPS Load Balancer
# =============================================================================

resource "google_compute_managed_ssl_certificate" "managed-cert" {
  project = var.project_id
  name    = "koborin-ai-cert"

  managed {
    domains = ["koborin.ai", "dev.koborin.ai"]
  }

  lifecycle {
    create_before_destroy = true
  }

  depends_on = [
    google_project_service.api-run-googleapis-com,
    google_project_service.api-compute-googleapis-com,
    google_project_service.api-artifactregistry-googleapis-com,
  ]
}

resource "google_compute_url_map" "lb" {
  project         = var.project_id
  name            = "koborin-ai-url-map"
  description     = "Routes traffic to dev/prod backends based on host header"
  default_service = google_compute_backend_service.prod.id

  host_rule {
    hosts        = ["koborin.ai"]
    path_matcher = "prod-matcher"
  }

  host_rule {
    hosts        = ["dev.koborin.ai"]
    path_matcher = "dev-matcher"
  }

  path_matcher {
    name            = "prod-matcher"
    default_service = google_compute_backend_service.prod.id
  }

  path_matcher {
    name            = "dev-matcher"
    default_service = google_compute_backend_service.dev.id
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "google_compute_target_https_proxy" "https-proxy" {
  project          = var.project_id
  name             = "koborin-ai-https-proxy"
  url_map          = google_compute_url_map.lb.id
  ssl_certificates = [google_compute_managed_ssl_certificate.managed-cert.id]

  lifecycle {
    create_before_destroy = true
  }
}

resource "google_compute_global_forwarding_rule" "forwarding-rule" {
  project               = var.project_id
  name                  = "koborin-ai-forwarding-rule"
  target                = google_compute_target_https_proxy.https-proxy.id
  port_range            = "443"
  ip_protocol           = "TCP"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  network_tier          = "PREMIUM"
  ip_address            = google_compute_global_address.lb.address
}

# =============================================================================
# Workload Identity (for GitHub Actions)
# =============================================================================
# Security Note: While pool/provider IDs and project numbers are hardcoded here,
# this configuration is secure due to multi-layered protection:
# 1. attributeCondition restricts access to repository_owner "nozomi-koborinai" only
# 2. IAM binding grants impersonation only to specific subject (nozomi-koborinai/koborin-ai)
# 3. GitHub issues OIDC tokens that must match these conditions
# Even if someone discovers these IDs, they cannot authenticate without:
# - Owning the nozomi-koborinai GitHub account
# - Running workflows from the koborin-ai repository
# This follows Google's Workload Identity Federation design where IDs are public-safe.

resource "google_iam_workload_identity_pool" "github_actions" {
  project                   = var.project_id
  workload_identity_pool_id = "github-actions-pool"
  display_name              = "github-actions-pool"
  description               = "Workload Identity Pool for GitHub Actions workflows"
}

resource "google_iam_workload_identity_pool_provider" "github-provider" {
  project                            = var.project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.github_actions.workload_identity_pool_id
  workload_identity_pool_provider_id = "actions-firebase-provider"
  display_name                       = "github-actions-provider"
  description                        = "GitHub Actions OIDC provider"

  # Only allow workflows from repositories owned by nozomi-koborinai
  attribute_condition = "assertion.repository_owner == \"nozomi-koborinai\""

  attribute_mapping = {
    "google.subject"             = "assertion.repository"
    "attribute.repository_owner" = "assertion.repository_owner"
  }

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

resource "google_service_account" "github-actions-sa" {
  project      = var.project_id
  account_id   = "github-actions-service"
  display_name = "github-actions-service"
  description  = "Service account for GitHub Actions to deploy via Terraform"
}

# Allow Workload Identity Pool to impersonate the service account
# Uses subject-based binding to restrict access to this specific repository only
# (nozomi-koborinai/koborin-ai). This is more restrictive than attribute-based
# principalSet binding which would allow all repos owned by nozomi-koborinai.
resource "google_service_account_iam_member" "github-wif-user" {
  service_account_id = google_service_account.github-actions-sa.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principal://iam.googleapis.com/projects/${var.project_number}/locations/global/workloadIdentityPools/${google_iam_workload_identity_pool.github_actions.workload_identity_pool_id}/subject/nozomi-koborinai/koborin-ai"
}

# Grant necessary roles to the GitHub Actions service account
resource "google_project_iam_member" "terraform-sa-roles-artifactregistry-admin" {
  project = var.project_id
  role    = "roles/artifactregistry.admin"
  member  = "serviceAccount:${google_service_account.github-actions-sa.email}"
}

resource "google_project_iam_member" "terraform-sa-roles-cloudbuild-builds-builder" {
  project = var.project_id
  role    = "roles/cloudbuild.builds.builder"
  member  = "serviceAccount:${google_service_account.github-actions-sa.email}"
}

resource "google_project_iam_member" "terraform-sa-roles-cloudbuild-builds-viewer" {
  project = var.project_id
  role    = "roles/cloudbuild.builds.viewer"
  member  = "serviceAccount:${google_service_account.github-actions-sa.email}"
}

resource "google_project_iam_member" "terraform-sa-roles-run-admin" {
  project = var.project_id
  role    = "roles/run.admin"
  member  = "serviceAccount:${google_service_account.github-actions-sa.email}"
}

resource "google_project_iam_member" "terraform-sa-roles-compute-admin" {
  project = var.project_id
  role    = "roles/compute.admin"
  member  = "serviceAccount:${google_service_account.github-actions-sa.email}"
}

resource "google_project_iam_member" "terraform-sa-roles-iap-admin" {
  project = var.project_id
  role    = "roles/iap.admin"
  member  = "serviceAccount:${google_service_account.github-actions-sa.email}"
}

resource "google_project_iam_member" "terraform-sa-roles-logging-admin" {
  project = var.project_id
  role    = "roles/logging.admin"
  member  = "serviceAccount:${google_service_account.github-actions-sa.email}"
}

resource "google_project_iam_member" "terraform-sa-roles-logging-viewer" {
  project = var.project_id
  role    = "roles/logging.viewer"
  member  = "serviceAccount:${google_service_account.github-actions-sa.email}"
}

resource "google_project_iam_member" "terraform-sa-roles-monitoring-admin" {
  project = var.project_id
  role    = "roles/monitoring.admin"
  member  = "serviceAccount:${google_service_account.github-actions-sa.email}"
}

resource "google_project_iam_member" "terraform-sa-roles-resourcemanager-projectIamAdmin" {
  project = var.project_id
  role    = "roles/resourcemanager.projectIamAdmin"
  member  = "serviceAccount:${google_service_account.github-actions-sa.email}"
}

resource "google_project_iam_member" "terraform-sa-roles-iam-serviceAccountUser" {
  project = var.project_id
  role    = "roles/iam.serviceAccountUser"
  member  = "serviceAccount:${google_service_account.github-actions-sa.email}"
}

resource "google_project_iam_member" "terraform-sa-roles-iam-serviceAccountAdmin" {
  project = var.project_id
  role    = "roles/iam.serviceAccountAdmin"
  member  = "serviceAccount:${google_service_account.github-actions-sa.email}"
}

resource "google_project_iam_member" "terraform-sa-roles-iam-workloadIdentityPoolAdmin" {
  project = var.project_id
  role    = "roles/iam.workloadIdentityPoolAdmin"
  member  = "serviceAccount:${google_service_account.github-actions-sa.email}"
}

resource "google_project_iam_member" "terraform-sa-roles-serviceusage-serviceUsageAdmin" {
  project = var.project_id
  role    = "roles/serviceusage.serviceUsageAdmin"
  member  = "serviceAccount:${google_service_account.github-actions-sa.email}"
}

resource "google_project_iam_member" "terraform-sa-roles-storage-objectAdmin" {
  project = var.project_id
  role    = "roles/storage.objectAdmin"
  member  = "serviceAccount:${google_service_account.github-actions-sa.email}"
}

# =============================================================================
# Outputs
# =============================================================================

output "global_ip_address" {
  description = "The global static IP address for the load balancer"
  value       = google_compute_global_address.lb.address
}

output "github_actions_sa_email" {
  description = "Email of the GitHub Actions service account"
  value       = google_service_account.github-actions-sa.email
}

output "workload_identity_provider" {
  description = "Full resource name of the Workload Identity Provider"
  value       = google_iam_workload_identity_pool_provider.github-provider.name
}

