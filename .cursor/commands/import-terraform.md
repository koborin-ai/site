# /import-terraform

## Overview

`/import-terraform` guides you through importing existing Google Cloud resources into the Terraform state. The agent relies on the Terraform MCP Server to retrieve the official provider documentation, builds the correct `terraform import` command for each resource type, and walks you through the process one resource at a time so that imports remain predictable and auditable.

## Usage

```text
/import-terraform <environment> <resource_type>
```

- `<environment>` (required): one of `shared`, `dev`, or `prod`.
- `<resource_type>` (required): Terraform resource type to import (for example `artifact_registry_repository`, `project_service`, `cloud_run_v2_service`).

**Examples:**

```text
/import-terraform shared artifact_registry_repository
/import-terraform dev cloud_run_v2_service
/import-terraform shared project_service
```

## Prerequisites

- Terraform HCL files exist under `infra/<environment>/`.
- Target resources already exist in Google Cloud.
- Terraform backend (GCS) is initialized for the relevant environment.
- You have authentication to Google Cloud (via `gcloud auth application-default login` or service account).

## Execution Flow (steps)

### 1. Confirm the environment and resource type

- Validate that the specified environment is one of `shared`, `dev`, or `prod`.
- Normalize the resource type (snake_case). If unclear, ask the user or suggest likely matches.

### 2. Retrieve the provider schema through the Terraform MCP Server

- Call `mcp_terraform_search_providers` with the Google provider namespace to locate the resource.
- Fetch the details via `mcp_terraform_get_provider_details`.

**Needed fields:**

- Import ID format (for example `projects/{{project}}/locations/{{location}}/repositories/{{repository_id}}`).
- Required and optional attributes.
- Provider-specific warnings.

### 3. Gather existing resource identifiers

Prompt the user for the GCP metadata:

- Project ID (for example `koborin-ai`).
- Region or location (`asia-northeast1` for most resources in this project).
- Resource name/ID.
- Any secondary identifiers (service name, domain, etc.).

### 4. Resolve the Terraform resource name from HCL files

- Inspect `infra/<environment>/main.tf` to find the Terraform resource block name.

```bash
cd infra/<environment>
grep -E "^resource \"google_" main.tf
```

### 5. Build and present the import command

Use the official import format plus the Terraform resource label identified above.

```bash
terraform import \
  'google_artifact_registry_repository.web' \
  'projects/koborin-ai/locations/asia-northeast1/repositories/koborin-ai-web'
```

Provide the user with:

```text
Please run the following command:

cd infra/shared
terraform init -backend-config="bucket=<BUCKET_NAME>"
terraform import \
  'google_artifact_registry_repository.web' \
  'projects/koborin-ai/locations/asia-northeast1/repositories/koborin-ai-web'

Expected result: Import successful!

Let me know "success" or share the exact error output.
```

### 6. Wait for the user to report the result

- **On success:** log completion and move to the next resource (if more remain).
- **On failure:** analyze the error:
  - Missing resource → ask the user to confirm existence in the Cloud Console.
  - Wrong format → re-check the provider docs and regenerate.
  - Permission denied → remind the user to authenticate with sufficient Terraform IAM roles.

### 7. Validate after all imports finish

Once every resource is imported:

```bash
terraform state list | grep <resource_type>
terraform plan -var="project_id=<PROJECT_ID>" -var="project_number=<PROJECT_NUMBER>" ...
# Expected: "No changes. Your infrastructure matches the configuration."
```

Handle drift accordingly:

- Minor drift (labels) → safe to `terraform apply` later.
- Significant drift (protocols, tiers) → investigate and reconcile before applying.

## AI analysis points

### Determine the resource type

When user input is vague (e.g., "Artifact Registry"), normalize the string to the Terraform type (`google_artifact_registry_repository`).

### Construct the correct import ID

Prefer explicit formats to avoid ambiguity. For Artifact Registry, always use `projects/{{project}}/locations/{{location}}/repositories/{{repository}}` rather than shortened variants.

### Handle batches

When importing multiple resources of the same type (e.g., many `google_project_service` entries):

1. List every item with its Terraform label.
2. Provide commands one at a time.
3. Wait for `ok` / `error: ...` before proceeding.

### Error handling patterns

- **"Resource already exists in state"** → confirm with `terraform state list` and skip.
- **"Resource not found"** → double-check identifiers or whether the resource lives in another project/region.
- **"Permission denied"** → ensure the caller has access; remind them that GitHub Actions with Workload Identity has the required roles.

## Notes

- Imports never mutate the underlying GCP resources—they only register them in state.
- Order generally does not matter, but importing API enablement before dependent resources keeps logs clear.
- Always run `terraform plan` right after importing to spot unintended changes.
- When using the shared GCS backend, supply the correct bucket via `-backend-config`.

## Implementation examples

### Example 1: Import the Artifact Registry repository

**Command:**

```text
/import-terraform shared artifact_registry_repository
```

**Conversation:**

```text
Terraform MCP Server → looking up documentation for google_artifact_registry_repository …
✅ Import format: projects/{{project}}/locations/{{location}}/repositories/{{repository_id}}

Please share the existing resource information:
- Project ID:
- Location (region):
- Repository ID:
```

**User:**

```text
Project ID: koborin-ai
Location: asia-northeast1
Repository ID: koborin-ai-web
```

**Agent:**

```text
Looking up the Terraform resource label in infra/shared/main.tf…
✅ Found: google_artifact_registry_repository.web

Run the following commands:

cd infra/shared
terraform init -backend-config="bucket=n-koborinai-me-backend"

terraform import \
  'google_artifact_registry_repository.web' \
  'projects/koborin-ai/locations/asia-northeast1/repositories/koborin-ai-web'

Let me know the result.
```

**User:**

```text
Import successful!
```

**Agent:**

```text
✅ Import complete.
Please run `terraform plan` with the required variables to confirm there is no drift:

terraform plan \
  -var="project_id=koborin-ai" \
  -var="project_number=<PROJECT_NUMBER>" \
  -var="iap_user=<IAP_USER>" \
  -var="oauth_client_id=<CLIENT_ID>" \
  -var="oauth_client_secret=<CLIENT_SECRET>"
```

### Example 2: Import a Cloud Run service

**Command:**

```text
/import-terraform dev cloud_run_v2_service
```

**Agent:**

```text
Terraform MCP Server → looking up documentation for google_cloud_run_v2_service …
✅ Import format: projects/{{project}}/locations/{{location}}/services/{{name}}

Please share the existing resource information:
- Project ID:
- Location (region):
- Service name:
```

**User:**

```text
Project ID: koborin-ai
Location: asia-northeast1
Service name: koborin-ai-web-dev
```

**Agent:**

```text
Looking up the Terraform resource label in infra/dev/main.tf…
✅ Found: google_cloud_run_v2_service.web

Run the following commands:

cd infra/dev
terraform init -backend-config="bucket=n-koborinai-me-backend"

terraform import \
  'google_cloud_run_v2_service.web' \
  'projects/koborin-ai/locations/asia-northeast1/services/koborin-ai-web-dev'

Let me know the result.
```

### Example 3: Import multiple project services

**Command:**

```text
/import-terraform shared project_service
```

**Agent:**

```text
✅ Import format: {{project_id}}/{{service_name}}
Found API services defined in the shared stack via for_each.

Prepare the environment:

cd infra/shared
terraform init -backend-config="bucket=n-koborinai-me-backend"

Type "ready" when initialization finishes.
```

**User:**

```text
ready
```

**Agent:**

```text
1/10 run.googleapis.com
terraform import 'google_project_service.apis["run.googleapis.com"]' 'koborin-ai/run.googleapis.com'
Reply "ok" or "error: <message>".
```

(Repeat for every API service. After the final `ok`, prompt the user to run `terraform plan`.)

## Best practices

### Before importing

1. Confirm the resource is declared in the HCL files under `infra/<environment>/`.
2. Double-check the correct environment and backend bucket.
3. Verify the GCP resource actually exists.

### During importing

- Import resources one at a time, waiting for confirmation after each.
- Address errors immediately before continuing.
- Use `terraform state list` periodically to avoid duplicates.

### After importing

- Always run `terraform plan` and document any drift.
- Treat minor label drift as acceptable to fix via `terraform apply` later.
- Investigate major drift (protocol, tier, auth settings) before applying.

## Error cases and mitigations

### `Resource already exists in state`

Cause: previously imported. Mitigation: `terraform state list | grep <resource>` and skip.

### `Resource not found`

Cause: wrong identifiers or resource absent. Mitigation: verify in the Cloud Console and correct project/region.

### `Permission 'XXX' denied`

Cause: insufficient IAM permissions. Mitigation: authenticate with a service account or run via GitHub Actions.

### Large drift during `plan`

Cause: configuration and real resource diverge. Mitigation: inspect the plan, adjust code, or align the resource manually before applying.

## Related commands

- `/rm-terraform-state`: remove entries from Terraform state when reverting imports.
- `/plan`: guide for running targeted Terraform plans.

## References

- `infra/` — Terraform HCL stacks (shared, dev, prod).
- `AGENTS.md` — state migration best practices.

