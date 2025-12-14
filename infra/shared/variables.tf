# =============================================================================
# Input Variables
# =============================================================================

variable "project_id" {
  description = "Google Cloud Project ID."
  type        = string
}

variable "project_number" {
  description = "Google Cloud Project Number."
  type        = string
}

variable "iap_user" {
  description = "Email address of the user allowed to access dev environment via IAP."
  type        = string
}

variable "oauth_client_id" {
  description = "OAuth 2.0 Client ID for IAP (dev environment)."
  type        = string
}

variable "oauth_client_secret" {
  description = "OAuth 2.0 Client Secret for IAP (dev environment)."
  type        = string
  sensitive   = true
}

