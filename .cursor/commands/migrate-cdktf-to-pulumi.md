# Migrate CDKTF to Pulumi

This command provides a comprehensive guide for migrating existing CDKTF (Cloud Development Kit for Terraform) projects to Pulumi (TypeScript).

## Prerequisites

- CDKTF infrastructure already deployed
- Using GCS backend for state storage
- GitHub Actions CI/CD configured

## Migration Steps

### 1. Review Existing CDKTF Code

First, review your existing CDKTF code:

- Directory structure (`infrastructure/` or `infra/`)
- Resources in use (Cloud Run, Load Balancer, IAM, etc.)
- Environment variables and GitHub Secrets usage

### 2. Create Pulumi Project

```bash
mkdir -p infra/src/stacks
cd infra
npm init -y
npm install @pulumi/pulumi @pulumi/gcp
npm install -D typescript @types/node
```

### 3. Create Required Files

Create the following files:

- `infra/Pulumi.yaml` - Project configuration
- `infra/tsconfig.json` - TypeScript configuration
- `infra/src/index.ts` - Entry point
- `infra/src/config.ts` - Configuration helpers
- `infra/src/stacks/shared.ts` - Shared resources
- `infra/src/stacks/dev.ts` - Dev environment
- `infra/src/stacks/prod.ts` - Prod environment

### 4. CDKTF → Pulumi Code Conversion

#### Resource Mapping Table

| CDKTF | Pulumi |
|-------|--------|
| `new GoogleProvider()` | `gcp:` provider (automatic) |
| `new CloudRunV2Service()` | `gcp.cloudrunv2.Service` |
| `new ComputeGlobalAddress()` | `gcp.compute.GlobalAddress` |
| `new ComputeBackendService()` | `gcp.compute.BackendService` |
| `new ComputeUrlMap()` | `gcp.compute.URLMap` |
| `new IamWorkloadIdentityPool()` | `gcp.iam.WorkloadIdentityPool` |

#### Syntax Differences

**CDKTF:**

```typescript
new CloudRunV2Service(this, "web-dev", {
  name: "koborin-ai-web-dev",
  location: "asia-northeast1",
  template: {
    containers: [{ image: imageUri }]
  }
});
```

**Pulumi:**

```typescript
const webDev = new gcp.cloudrunv2.Service("web-dev", {
  name: "koborin-ai-web-dev",
  location: "asia-northeast1",
  template: {
    containers: [{ image: imageUri }]
  }
});
```

### 5. Import Existing Resources (CLI Method - Recommended)

Pulumi uses a different state format than Terraform, so you must import existing resources.

**⚠️ Important: Use CLI-based import, NOT code-based import options.**

#### Why CLI-based Import?

| Method | Description | Recommendation |
|--------|-------------|----------------|
| **CLI (`pulumi import`)** | One-time command, imports to state | ✅ Recommended |
| **Code (`import` option)** | Added to resource definition | ❌ Avoid |

Code-based import options cause issues:
- `[diff: ~protect]` warnings in every preview
- Confusion about which resources are imported
- Hard to know if import already happened

#### Step-by-Step Import Process

1. **Login to Pulumi Backend**

```bash
cd infra
export PULUMI_BACKEND_URL=gs://${BUCKET_NAME}/pulumi
export PULUMI_CONFIG_PASSPHRASE=""
pulumi login $PULUMI_BACKEND_URL
```

2. **Initialize Stacks**

```bash
pulumi stack init shared
pulumi stack init dev
pulumi stack init prod
```

3. **Configure Stacks**

```bash
# For each stack
pulumi stack select <stack-name>
pulumi config set gcp:project $PROJECT_ID
pulumi config set projectId $PROJECT_ID
pulumi config set projectNumber $PROJECT_NUMBER
# Add other required config...
```

4. **Import Resources by Stack**

**Dev Stack:**

```bash
pulumi stack select dev

# Cloud Run Service
pulumi import gcp:cloudrunv2/service:Service web-dev \
  "projects/${PROJECT_ID}/locations/asia-northeast1/services/koborin-ai-web-dev" --yes

# Cloud Run IAM Member
pulumi import gcp:cloudrunv2/serviceIamMember:ServiceIamMember web-dev-iap-invoker \
  "projects/${PROJECT_ID}/locations/asia-northeast1/services/koborin-ai-web-dev roles/run.invoker serviceAccount:service-${PROJECT_NUMBER}@gcp-sa-iap.iam.gserviceaccount.com" --yes
```

**Prod Stack:**

```bash
pulumi stack select prod

# Cloud Run Service
pulumi import gcp:cloudrunv2/service:Service web-prod \
  "projects/${PROJECT_ID}/locations/asia-northeast1/services/koborin-ai-web-prod" --yes

# Cloud Run IAM Member (allUsers)
pulumi import gcp:cloudrunv2/serviceIamMember:ServiceIamMember web-prod-invoker \
  "projects/${PROJECT_ID}/locations/asia-northeast1/services/koborin-ai-web-prod roles/run.invoker allUsers" --yes
```

**Shared Stack:**

```bash
pulumi stack select shared

# API Services (loop)
for api in run.googleapis.com compute.googleapis.com iam.googleapis.com cloudresourcemanager.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com iap.googleapis.com monitoring.googleapis.com logging.googleapis.com certificatemanager.googleapis.com; do
  name=$(echo $api | tr '.' '-')
  pulumi import "gcp:projects/service:Service" "api-${name}" "${PROJECT_ID}/${api}" --yes
done

# Artifact Registry
pulumi import gcp:artifactregistry/repository:Repository artifact-registry \
  "projects/${PROJECT_ID}/locations/asia-northeast1/repositories/koborin-ai-web" --yes

# Global IP
pulumi import gcp:compute/globalAddress:GlobalAddress global-ip \
  "projects/${PROJECT_ID}/global/addresses/koborin-ai-global-ip" --yes

# NEGs
pulumi import gcp:compute/regionNetworkEndpointGroup:RegionNetworkEndpointGroup dev-neg \
  "projects/${PROJECT_ID}/regions/asia-northeast1/networkEndpointGroups/koborin-ai-dev-neg" --yes
pulumi import gcp:compute/regionNetworkEndpointGroup:RegionNetworkEndpointGroup prod-neg \
  "projects/${PROJECT_ID}/regions/asia-northeast1/networkEndpointGroups/koborin-ai-prod-neg" --yes

# Backend Services
pulumi import gcp:compute/backendService:BackendService dev-backend \
  "projects/${PROJECT_ID}/global/backendServices/koborin-ai-dev-backend" --yes
pulumi import gcp:compute/backendService:BackendService prod-backend \
  "projects/${PROJECT_ID}/global/backendServices/koborin-ai-prod-backend" --yes

# SSL Certificate
pulumi import gcp:compute/managedSslCertificate:ManagedSslCertificate managed-cert \
  "projects/${PROJECT_ID}/global/sslCertificates/koborin-ai-cert" --yes

# URL Map
pulumi import gcp:compute/uRLMap:URLMap url-map \
  "projects/${PROJECT_ID}/global/urlMaps/koborin-ai-url-map" --yes

# HTTPS Proxy
pulumi import gcp:compute/targetHttpsProxy:TargetHttpsProxy https-proxy \
  "projects/${PROJECT_ID}/global/targetHttpsProxies/koborin-ai-https-proxy" --yes

# Forwarding Rule
pulumi import gcp:compute/globalForwardingRule:GlobalForwardingRule forwarding-rule \
  "projects/${PROJECT_ID}/global/forwardingRules/koborin-ai-forwarding-rule" --yes

# Workload Identity
pulumi import gcp:iam/workloadIdentityPool:WorkloadIdentityPool github-actions-pool \
  "projects/${PROJECT_ID}/locations/global/workloadIdentityPools/github-actions-pool" --yes
pulumi import gcp:iam/workloadIdentityPoolProvider:WorkloadIdentityPoolProvider github-provider \
  "projects/${PROJECT_ID}/locations/global/workloadIdentityPools/github-actions-pool/providers/actions-firebase-provider" --yes

# Service Account
pulumi import gcp:serviceaccount/account:Account github-actions-sa \
  "projects/${PROJECT_ID}/serviceAccounts/github-actions-service@${PROJECT_ID}.iam.gserviceaccount.com" --yes

# Service Account IAM
pulumi import gcp:serviceaccount/iAMMember:IAMMember github-wif-user \
  "projects/${PROJECT_ID}/serviceAccounts/github-actions-service@${PROJECT_ID}.iam.gserviceaccount.com roles/iam.workloadIdentityUser principal://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-actions-pool/subject/nozomi-koborinai/koborin-ai" --yes

# Project IAM Roles (loop)
SA_EMAIL="github-actions-service@${PROJECT_ID}.iam.gserviceaccount.com"
for role in roles/artifactregistry.admin roles/cloudbuild.builds.builder roles/cloudbuild.builds.viewer roles/run.admin roles/compute.admin roles/iap.admin roles/logging.admin roles/logging.viewer roles/monitoring.admin roles/resourcemanager.projectIamAdmin roles/iam.serviceAccountUser roles/iam.serviceAccountAdmin roles/iam.workloadIdentityPoolAdmin roles/serviceusage.serviceUsageAdmin roles/storage.objectAdmin; do
  name="deployer-sa-$(echo $role | tr '.' '-' | tr '/' '-')"
  pulumi import "gcp:projects/iAMMember:IAMMember" "${name}" "${PROJECT_ID} ${role} serviceAccount:${SA_EMAIL}" --yes
done
```

5. **Verify Import**

```bash
pulumi stack ls
# Should show resource counts for each stack

pulumi preview
# Should show minimal changes (only new resources or config diffs)
```

#### Import ID Formats Reference

| Resource Type | Import ID Format |
|---------------|------------------|
| `gcp:cloudrunv2/service:Service` | `projects/{project}/locations/{region}/services/{name}` |
| `gcp:cloudrunv2/serviceIamMember:ServiceIamMember` | `projects/{project}/locations/{region}/services/{name} {role} {member}` |
| `gcp:projects/service:Service` | `{project}/{api}` |
| `gcp:compute/globalAddress:GlobalAddress` | `projects/{project}/global/addresses/{name}` |
| `gcp:compute/backendService:BackendService` | `projects/{project}/global/backendServices/{name}` |
| `gcp:iap/webBackendServiceIamBinding:WebBackendServiceIamBinding` | `projects/{project}/iap_web/compute/services/{service}` |
| `gcp:iam/workloadIdentityPool:WorkloadIdentityPool` | `projects/{project}/locations/global/workloadIdentityPools/{pool}` |
| `gcp:serviceaccount/account:Account` | `projects/{project}/serviceAccounts/{email}` |
| `gcp:projects/iAMMember:IAMMember` | `{project} {role} {member}` |

### 6. Update GitHub Actions Workflows

#### Required Changes

1. `hashicorp/setup-terraform` → `pulumi/setup-pulumi@v2`
2. `terraform init/plan/apply` → `pulumi stack select/preview/up`
3. `infra/${{ env.TARGET_ENV }}` → `infra/` (single directory)

#### New GitHub Secrets

- `PULUMI_CONFIG_PASSPHRASE` - Pulumi encryption passphrase

#### Workflow Example

```yaml
- name: Setup Pulumi
  uses: pulumi/setup-pulumi@v2

- name: Configure Pulumi Stack
  working-directory: infra
  env:
    PULUMI_BACKEND_URL: gs://${{ env.BUCKET_NAME }}/pulumi
  run: |
    pulumi stack select ${{ env.PULUMI_STACK }} --create --non-interactive || true
    pulumi config set gcp:project ${{ env.PROJECT_ID }} --non-interactive
    pulumi config set imageUri ${{ env.IMAGE_URI }} --non-interactive

- name: Pulumi Preview
  uses: pulumi/actions@v6
  with:
    command: preview
    stack-name: ${{ env.PULUMI_STACK }}
    work-dir: infra
  env:
    PULUMI_BACKEND_URL: gs://${{ env.BUCKET_NAME }}/pulumi
```

### 7. Update Documentation

- `README.md` - Change Terraform → Pulumi references
- `AGENTS.md` - Update IaC tool descriptions
- `.github/release.yml` - Change label from `terraform` → `pulumi`

### 8. Delete Old Files

After migration is complete, delete:

- Old CDKTF/Terraform directory
- `.terraform.lock.hcl` files
- `Pulumi.*.yaml` files (if using dynamic CI/CD configuration)

## Checklist

- [ ] Create Pulumi project structure
- [ ] Convert CDKTF code to Pulumi TypeScript
- [ ] **Import existing resources via CLI (`pulumi import`)**
- [ ] Verify no diff with `pulumi preview`
- [ ] Update GitHub Actions workflows
- [ ] Add `PULUMI_CONFIG_PASSPHRASE` to GitHub Secrets
- [ ] Update documentation (README.md, AGENTS.md)
- [ ] Delete old CDKTF/Terraform files

## Important Notes

1. **No State Compatibility**: Terraform `.tfstate` and Pulumi state are not compatible. You must import resources.

2. **CLI Import Only**: Always use `pulumi import` command. Never use code-based `import` options in resource definitions.

3. **Passphrase Management**: When using GCS backend, `PULUMI_CONFIG_PASSPHRASE` is required. An empty string works but a proper value is recommended for security.

4. **CI/CD Only**: Avoid running `pulumi up` locally. Execute all changes through GitHub Actions.

5. **Resource Not Found on Import**: If `pulumi import` fails with "resource does not exist", the resource was not created by CDKTF. It will be created as a new resource on `pulumi up`.

## References

- [Pulumi GCP Provider](https://www.pulumi.com/registry/packages/gcp/)
- [Pulumi GitHub Actions](https://www.pulumi.com/docs/using-pulumi/continuous-delivery/github-actions/)
- [Pulumi Import](https://www.pulumi.com/docs/using-pulumi/adopting-pulumi/import/)
