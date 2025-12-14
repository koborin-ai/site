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

variable "image_uri" {
  description = "Container image URI to deploy to Cloud Run."
  type        = string
}

