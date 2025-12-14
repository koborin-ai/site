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

  # APIs required for Cloud Run, Artifact Registry, Load Balancing, and IAM
  required_apis = [
    "run.googleapis.com",
    "compute.googleapis.com",
    "iam.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "artifactregistry.googleapis.com",
    "cloudbuild.googleapis.com",
    "iap.googleapis.com",
    "monitoring.googleapis.com",
    "logging.googleapis.com",
    "certificatemanager.googleapis.com",
  ]

  # Roles granted to the GitHub Actions service account
  terraform_sa_roles = [
    "roles/artifactregistry.admin",
    "roles/cloudbuild.builds.builder",
    "roles/cloudbuild.builds.viewer",
    "roles/run.admin",
    "roles/compute.admin",
    "roles/iap.admin",
    "roles/logging.admin",
    "roles/logging.viewer",
    "roles/monitoring.admin",
    "roles/resourcemanager.projectIamAdmin",
    "roles/iam.serviceAccountUser",
    "roles/iam.serviceAccountAdmin",
    "roles/iam.workloadIdentityPoolAdmin",
    "roles/serviceusage.serviceUsageAdmin",
    "roles/storage.objectAdmin",
  ]
}

# =============================================================================
# API Enablement
# =============================================================================

resource "google_project_service" "apis" {
  for_each = toset(local.required_apis)

  project                    = var.project_id
  service                    = each.value
  disable_dependent_services = false
  disable_on_destroy         = false
}

# =============================================================================
# Artifact Registry
# =============================================================================

resource "google_artifact_registry_repository" "web" {
  project       = var.project_id
  location      = local.region
  repository_id = "koborin-ai-web"
  description   = "Container images for koborin.ai web application (dev/prod)"
  format        = "DOCKER"

  docker_config {
    immutable_tags = true
  }

  depends_on = [google_project_service.apis]
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

  depends_on = [google_project_service.apis]
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

  depends_on = [google_project_service.apis]
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

  depends_on = [google_project_service.apis]
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

resource "google_compute_managed_ssl_certificate" "lb" {
  project = var.project_id
  name    = "koborin-ai-cert"

  managed {
    domains = ["koborin.ai", "dev.koborin.ai"]
  }

  lifecycle {
    create_before_destroy = true
  }

  depends_on = [google_project_service.apis]
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

resource "google_compute_target_https_proxy" "lb" {
  project          = var.project_id
  name             = "koborin-ai-https-proxy"
  url_map          = google_compute_url_map.lb.id
  ssl_certificates = [google_compute_managed_ssl_certificate.lb.id]

  lifecycle {
    create_before_destroy = true
  }
}

resource "google_compute_global_forwarding_rule" "lb" {
  project               = var.project_id
  name                  = "koborin-ai-forwarding-rule"
  target                = google_compute_target_https_proxy.lb.id
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

resource "google_iam_workload_identity_pool_provider" "github" {
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

resource "google_service_account" "github_actions" {
  project      = var.project_id
  account_id   = "github-actions-service"
  display_name = "github-actions-service"
  description  = "Service account for GitHub Actions to deploy via Terraform"
}

# Allow Workload Identity Pool to impersonate the service account
# Uses subject-based binding to restrict access to this specific repository only
# (nozomi-koborinai/koborin-ai). This is more restrictive than attribute-based
# principalSet binding which would allow all repos owned by nozomi-koborinai.
resource "google_service_account_iam_member" "github_wif" {
  service_account_id = google_service_account.github_actions.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principal://iam.googleapis.com/projects/${var.project_number}/locations/global/workloadIdentityPools/${google_iam_workload_identity_pool.github_actions.workload_identity_pool_id}/subject/nozomi-koborinai/koborin-ai"
}

# Grant necessary roles to the GitHub Actions service account
resource "google_project_iam_member" "github_actions" {
  for_each = toset(local.terraform_sa_roles)

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.github_actions.email}"
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
  value       = google_service_account.github_actions.email
}

output "workload_identity_provider" {
  description = "Full resource name of the Workload Identity Provider"
  value       = google_iam_workload_identity_pool_provider.github.name
}

