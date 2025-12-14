# =============================================================================
# Terraform Backend Configuration
# =============================================================================
# Backend bucket is configured via -backend-config at runtime:
#   terraform init -backend-config="bucket=<BUCKET_NAME>"

terraform {
  backend "gcs" {
    prefix = "dev"
  }
}

