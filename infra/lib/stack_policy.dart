// GCP API enablement and deployer IAM policy for the shared stack.
// Kept separate from SharedStack so the role/API lists are easy to review
// during import migration and IAM audits.

/// GCP APIs required before any dependent resource can be created.
const requiredGcpApis = [
  'run.googleapis.com',
  'compute.googleapis.com',
  'iam.googleapis.com',
  'cloudresourcemanager.googleapis.com',
  'artifactregistry.googleapis.com',
  'cloudbuild.googleapis.com',
  'iap.googleapis.com',
  'monitoring.googleapis.com',
  'logging.googleapis.com',
  'certificatemanager.googleapis.com',
  'aiplatform.googleapis.com',
];

/// Roles granted to the GitHub Actions deployer service account.
const deployerSaRoles = [
  'roles/artifactregistry.admin',
  'roles/cloudbuild.builds.builder',
  'roles/cloudbuild.builds.viewer',
  'roles/run.admin',
  'roles/compute.admin',
  'roles/iap.admin',
  'roles/logging.admin',
  'roles/logging.viewer',
  'roles/monitoring.admin',
  'roles/resourcemanager.projectIamAdmin',
  'roles/iam.serviceAccountUser',
  'roles/iam.serviceAccountAdmin',
  'roles/iam.workloadIdentityPoolAdmin',
  'roles/serviceusage.serviceUsageAdmin',
  'roles/storage.objectAdmin',
];
