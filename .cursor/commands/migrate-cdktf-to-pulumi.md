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

### 5. Import Existing Resources

Pulumi uses a different state format than Terraform, so you must import existing resources:

```bash
# Initialize stacks
pulumi stack init shared
pulumi stack init dev
pulumi stack init prod

# Import resources
pulumi import gcp:cloudrunv2/service:Service web-dev projects/{project}/locations/{region}/services/{service-name}
```

### 6. Update GitHub Actions Workflows

#### Required Changes

1. `hashicorp/setup-terraform` → `pulumi/actions@v6`
2. `terraform init/plan/apply` → `pulumi stack select/preview/up`
3. `infra/${{ env.TARGET_ENV }}` → `infra/` (single directory)

#### New GitHub Secrets

- `PULUMI_CONFIG_PASSPHRASE` - Pulumi encryption passphrase

#### Workflow Example

```yaml
- name: Setup Pulumi
  uses: pulumi/actions@v6
  with:
    command: version

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
- [ ] Import existing resources (`pulumi import`)
- [ ] Verify no diff with `pulumi preview`
- [ ] Update GitHub Actions workflows
- [ ] Add `PULUMI_CONFIG_PASSPHRASE` to GitHub Secrets
- [ ] Update documentation (README.md, AGENTS.md)
- [ ] Delete old CDKTF/Terraform files

## Important Notes

1. **No State Compatibility**: Terraform `.tfstate` and Pulumi state are not compatible. You must import resources.

2. **Passphrase Management**: When using GCS backend, `PULUMI_CONFIG_PASSPHRASE` is required. An empty string works but a proper value is recommended for security.

3. **CI/CD Only**: Avoid running `pulumi up` locally. Execute all changes through GitHub Actions.

## References

- [Pulumi GCP Provider](https://www.pulumi.com/registry/packages/gcp/)
- [Pulumi GitHub Actions](https://www.pulumi.com/docs/using-pulumi/continuous-delivery/github-actions/)
- [Pulumi Import](https://www.pulumi.com/docs/using-pulumi/adopting-pulumi/import/)
